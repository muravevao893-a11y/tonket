import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { migrate } from './migrate.js';
import { query, withTransaction, closePool } from './db.js';
import {
  parseTonToNano,
  parseTokenAmount,
  formatNanoTon,
  formatTokenAmount,
  priceAtSupply,
  quoteBuy,
  quoteSell,
  publicQuote
} from './bondingCurve.js';
import { buildTonConnectTransaction } from './ton/tonConnectPayload.js';
import { createStonFiPoolDraft } from './ton/stonfiAdapter.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const port = Number(process.env.PORT || 8080);
const platformAddress = process.env.PLATFORM_TON_ADDRESS;

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

const userSchema = z.object({
  telegramId: z.string().min(1).max(64),
  username: z.string().max(64).optional().nullable(),
  firstName: z.string().max(128).optional().nullable(),
  lastName: z.string().max(128).optional().nullable(),
  walletAddress: z.string().max(128).optional().nullable()
});

const createTokenSchema = z.object({
  telegramId: z.string().min(1).max(64),
  name: z.string().min(2).max(80),
  ticker: z.string().min(2).max(12).transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  description: z.string().max(2000).optional().default(''),
  imageUrl: z.string().url().optional().nullable(),
  targetLiquidityTon: z.string().default('100'),
  basePriceTon: z.string().default('0.01'),
  slopeTon: z.string().default('0.0000005')
});

const quoteQuerySchema = z.object({
  side: z.enum(['buy', 'sell']).default('buy'),
  amount: z.string().default('100')
});

const prepareTradeSchema = z.object({
  side: z.enum(['buy', 'sell']),
  amount: z.string().min(1)
});

const confirmTradeSchema = z.object({
  telegramId: z.string().min(1).max(64),
  side: z.enum(['buy', 'sell']),
  amount: z.string().min(1),
  walletAddress: z.string().min(2).max(128),
  tonTxHash: z.string().min(3).max(256)
});

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function upsertUser(client, input) {
  const result = await client.query(
    `
    INSERT INTO app_users (telegram_id, username, first_name, last_name, wallet_address)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = COALESCE(EXCLUDED.username, app_users.username),
      first_name = COALESCE(EXCLUDED.first_name, app_users.first_name),
      last_name = COALESCE(EXCLUDED.last_name, app_users.last_name),
      wallet_address = COALESCE(EXCLUDED.wallet_address, app_users.wallet_address)
    RETURNING *;
    `,
    [input.telegramId, input.username || null, input.firstName || null, input.lastName || null, input.walletAddress || null]
  );
  return result.rows[0];
}

function tokenToPublic(row) {
  const currentPriceNano = priceAtSupply({
    supplyAtomic: row.current_supply_atomic,
    basePriceNano: row.base_price_nano,
    slopeNano: row.slope_nano
  }).toString();
  const raised = BigInt(row.raised_ton_nano);
  const target = BigInt(row.target_liquidity_nano);
  const progressBps = target === 0n ? 0 : Number((raised * 10_000n) / target);

  return {
    id: row.id,
    name: row.name,
    ticker: row.ticker,
    description: row.description,
    imageUrl: row.image_url,
    status: row.status,
    feeBps: row.fee_bps,
    jettonMasterAddress: row.jetton_master_address,
    platformContractAddress: row.platform_contract_address,
    currentSupplyAtomic: row.current_supply_atomic,
    currentSupply: formatTokenAmount(row.current_supply_atomic),
    raisedTonNano: row.raised_ton_nano,
    raisedTon: formatNanoTon(row.raised_ton_nano),
    targetLiquidityNano: row.target_liquidity_nano,
    targetLiquidityTon: formatNanoTon(row.target_liquidity_nano),
    basePriceTon: formatNanoTon(row.base_price_nano),
    slopeTon: formatNanoTon(row.slope_nano),
    currentPriceNano,
    currentPriceTon: formatNanoTon(currentPriceNano),
    progressBps,
    progressPercent: Math.min(100, progressBps / 100),
    dexName: row.dex_name,
    dexPoolAddress: row.dex_pool_address,
    createdAt: row.created_at,
    graduatedAt: row.graduated_at
  };
}

async function getTokenForUpdate(client, tokenId) {
  const result = await client.query('SELECT * FROM tokens WHERE id = $1 FOR UPDATE', [tokenId]);
  if (result.rowCount === 0) {
    const error = new Error('Token not found');
    error.status = 404;
    throw error;
  }
  return result.rows[0];
}

function quoteForToken(token, side, amountAtomic) {
  const common = {
    supplyAtomic: token.current_supply_atomic,
    amountAtomic,
    basePriceNano: token.base_price_nano,
    slopeNano: token.slope_nano,
    feeBps: token.fee_bps
  };
  return side === 'buy' ? quoteBuy(common) : quoteSell(common);
}

async function maybeCreateGraduationEvent(client, token) {
  const raised = BigInt(token.raised_ton_nano);
  const target = BigInt(token.target_liquidity_nano);
  if (raised < target || !['funding', 'curve_locked'].includes(token.status)) return null;

  const draft = await createStonFiPoolDraft({ token });
  await client.query(
    `
    UPDATE tokens
    SET status = 'liquidity_pending'
    WHERE id = $1;
    `,
    [token.id]
  );
  const event = await client.query(
    `
    INSERT INTO dex_graduation_events (
      token_id,
      status,
      dex_name,
      liquidity_ton_nano,
      token_liquidity_atomic,
      raw_payload
    )
    VALUES ($1, 'pending', 'stonfi', $2, $3, $4)
    RETURNING *;
    `,
    [token.id, token.raised_ton_nano, '0', JSON.stringify(draft)]
  );
  return event.rows[0];
}

app.get('/health', asyncHandler(async (_req, res) => {
  const db = await query('SELECT now() AS now');
  res.json({ ok: true, name: 'TONKET API', dbTime: db.rows[0].now });
}));

app.post('/api/users/upsert', asyncHandler(async (req, res) => {
  const input = userSchema.parse(req.body);
  const user = await withTransaction((client) => upsertUser(client, input));
  res.status(201).json({ user });
}));

app.get('/api/tokens', asyncHandler(async (_req, res) => {
  const result = await query(
    `
    SELECT * FROM tokens
    ORDER BY
      CASE status
        WHEN 'funding' THEN 1
        WHEN 'liquidity_pending' THEN 2
        WHEN 'graduated' THEN 3
        ELSE 4
      END,
      created_at DESC
    LIMIT 100;
    `
  );
  res.json({ tokens: result.rows.map(tokenToPublic) });
}));

app.post('/api/tokens', asyncHandler(async (req, res) => {
  const input = createTokenSchema.parse(req.body);
  if (input.ticker.length < 2) throw new Error('Ticker must contain at least 2 latin letters or digits');

  const targetLiquidityNano = parseTonToNano(input.targetLiquidityTon).toString();
  const basePriceNano = parseTonToNano(input.basePriceTon).toString();
  const slopeNano = parseTonToNano(input.slopeTon).toString();

  const created = await withTransaction(async (client) => {
    const user = await upsertUser(client, { telegramId: input.telegramId });
    const token = await client.query(
      `
      INSERT INTO tokens (
        creator_user_id,
        name,
        ticker,
        description,
        image_url,
        target_liquidity_nano,
        base_price_nano,
        slope_nano,
        last_price_nano,
        platform_contract_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9)
      RETURNING *;
      `,
      [
        user.id,
        input.name,
        input.ticker,
        input.description,
        input.imageUrl || null,
        targetLiquidityNano,
        basePriceNano,
        slopeNano,
        platformAddress || null
      ]
    );
    return token.rows[0];
  });

  res.status(201).json({ token: tokenToPublic(created) });
}));

app.get('/api/tokens/:id', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM tokens WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Token not found' });

  const trades = await query(
    `
    SELECT side, token_amount_atomic, gross_ton_nano, fee_nano, net_ton_nano, wallet_address, ton_tx_hash, created_at
    FROM trades
    WHERE token_id = $1
    ORDER BY created_at DESC
    LIMIT 30;
    `,
    [req.params.id]
  );

  res.json({
    token: tokenToPublic(result.rows[0]),
    trades: trades.rows.map((trade) => ({
      ...trade,
      tokenAmount: formatTokenAmount(trade.token_amount_atomic),
      grossTon: formatNanoTon(trade.gross_ton_nano),
      feeTon: formatNanoTon(trade.fee_nano),
      netTon: formatNanoTon(trade.net_ton_nano)
    }))
  });
}));

app.get('/api/tokens/:id/quote', asyncHandler(async (req, res) => {
  const input = quoteQuerySchema.parse(req.query);
  const result = await query('SELECT * FROM tokens WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Token not found' });

  const token = result.rows[0];
  if (token.status !== 'funding') return res.status(409).json({ error: `Trading is not available while token status is ${token.status}` });

  const amountAtomic = parseTokenAmount(input.amount);
  const quote = quoteForToken(token, input.side, amountAtomic);
  res.json({ token: tokenToPublic(token), quote: publicQuote(quote) });
}));

app.post('/api/tokens/:id/trades/prepare', asyncHandler(async (req, res) => {
  const input = prepareTradeSchema.parse(req.body);
  const result = await query('SELECT * FROM tokens WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Token not found' });

  const token = result.rows[0];
  if (token.status !== 'funding') return res.status(409).json({ error: `Trading is not available while token status is ${token.status}` });

  const amountAtomic = parseTokenAmount(input.amount);
  const quote = quoteForToken(token, input.side, amountAtomic);

  // For buy: wallet sends TON to platform contract.
  // For sell: production flow should call platform contract with Jetton transfer / burn logic.
  const amountNano = input.side === 'buy' ? quote.totalTonNano : '1';
  const comment = `TONKET:${input.side}:${token.id}:${quote.amountAtomic}`;
  const transaction = buildTonConnectTransaction({
    address: platformAddress,
    amountNano,
    comment
  });

  res.json({
    token: tokenToPublic(token),
    quote: publicQuote(quote),
    tonConnectTransaction: transaction,
    productionWarning: input.side === 'sell'
      ? 'Sell flow is a local MVP placeholder. Production must transfer Jettons to the platform contract and verify on-chain event.'
      : 'Production must verify sender, amount and payload on-chain before confirming trade.'
  });
}));

app.post('/api/tokens/:id/trades/confirm', asyncHandler(async (req, res) => {
  const input = confirmTradeSchema.parse(req.body);
  const amountAtomic = parseTokenAmount(input.amount);

  const result = await withTransaction(async (client) => {
    const user = await upsertUser(client, {
      telegramId: input.telegramId,
      walletAddress: input.walletAddress
    });

    const token = await getTokenForUpdate(client, req.params.id);
    if (token.status !== 'funding') {
      const error = new Error(`Trading is not available while token status is ${token.status}`);
      error.status = 409;
      throw error;
    }

    if (input.side === 'sell') {
      const holding = await client.query(
        'SELECT * FROM holdings WHERE user_id = $1 AND token_id = $2 FOR UPDATE',
        [user.id, token.id]
      );
      const balance = holding.rowCount ? BigInt(holding.rows[0].balance_atomic) : 0n;
      if (balance < amountAtomic) {
        const error = new Error('Not enough token balance to sell');
        error.status = 409;
        throw error;
      }
    }

    const tradeQuote = quoteForToken(token, input.side, amountAtomic);
    const supplyAfter = tradeQuote.supplyAfterAtomic;
    const raisedAfter = input.side === 'buy'
      ? (BigInt(token.raised_ton_nano) + BigInt(tradeQuote.grossTonNano)).toString()
      : (BigInt(token.raised_ton_nano) - BigInt(tradeQuote.grossTonNano)).toString();

    if (BigInt(raisedAfter) < 0n) {
      const error = new Error('Curve reserve is not enough to process sell');
      error.status = 409;
      throw error;
    }

    const tokenUpdate = await client.query(
      `
      UPDATE tokens
      SET
        current_supply_atomic = $1,
        raised_ton_nano = $2,
        fee_collected_nano = fee_collected_nano + $3,
        last_price_nano = $4
      WHERE id = $5
      RETURNING *;
      `,
      [
        supplyAfter,
        raisedAfter,
        tradeQuote.feeNano,
        tradeQuote.priceEndNano,
        token.id
      ]
    );

    if (input.side === 'buy') {
      await client.query(
        `
        INSERT INTO holdings (user_id, token_id, balance_atomic)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, token_id) DO UPDATE SET
          balance_atomic = holdings.balance_atomic + EXCLUDED.balance_atomic;
        `,
        [user.id, token.id, tradeQuote.amountAtomic]
      );
    } else {
      await client.query(
        `
        UPDATE holdings
        SET balance_atomic = balance_atomic - $3
        WHERE user_id = $1 AND token_id = $2;
        `,
        [user.id, token.id, tradeQuote.amountAtomic]
      );
    }

    const trade = await client.query(
      `
      INSERT INTO trades (
        token_id,
        user_id,
        side,
        status,
        token_amount_atomic,
        gross_ton_nano,
        fee_nano,
        net_ton_nano,
        price_start_nano,
        price_end_nano,
        supply_before_atomic,
        supply_after_atomic,
        wallet_address,
        ton_tx_hash,
        raw_payload,
        confirmed_at
      )
      VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
      RETURNING *;
      `,
      [
        token.id,
        user.id,
        input.side,
        tradeQuote.amountAtomic,
        tradeQuote.grossTonNano,
        tradeQuote.feeNano,
        tradeQuote.netTonNano,
        tradeQuote.priceStartNano,
        tradeQuote.priceEndNano,
        tradeQuote.supplyBeforeAtomic,
        tradeQuote.supplyAfterAtomic,
        input.walletAddress,
        input.tonTxHash,
        JSON.stringify({ localSimulation: true })
      ]
    );

    await client.query(
      `
      INSERT INTO price_snapshots (token_id, supply_atomic, price_nano, raised_ton_nano)
      VALUES ($1, $2, $3, $4);
      `,
      [token.id, supplyAfter, tradeQuote.priceEndNano, raisedAfter]
    );

    const graduationEvent = await maybeCreateGraduationEvent(client, tokenUpdate.rows[0]);
    const finalToken = graduationEvent
      ? { ...tokenUpdate.rows[0], status: 'liquidity_pending' }
      : tokenUpdate.rows[0];

    return {
      token: finalToken,
      trade: trade.rows[0],
      quote: tradeQuote,
      graduationEvent
    };
  });

  res.status(201).json({
    token: tokenToPublic(result.token),
    trade: {
      ...result.trade,
      tokenAmount: formatTokenAmount(result.trade.token_amount_atomic),
      grossTon: formatNanoTon(result.trade.gross_ton_nano),
      feeTon: formatNanoTon(result.trade.fee_nano),
      netTon: formatNanoTon(result.trade.net_ton_nano)
    },
    quote: publicQuote(result.quote),
    graduationEvent: result.graduationEvent
  });
}));

app.use((error, _req, res, _next) => {
  const status = error.status || (error.name === 'ZodError' ? 400 : 500);
  const message = error.name === 'ZodError'
    ? error.errors.map((item) => `${item.path.join('.')}: ${item.message}`).join('; ')
    : error.message || 'Internal server error';

  if (status >= 500) logger.error({ error }, 'request failed');
  res.status(status).json({ error: message });
});

async function start() {
  await migrate();
  app.listen(port, () => {
    logger.info({ port }, 'TONKET API started');
  });
}

process.on('SIGINT', async () => {
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closePool();
  process.exit(0);
});

start().catch((error) => {
  logger.error({ error }, 'failed to start API');
  process.exit(1);
});
