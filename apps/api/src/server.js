import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import { migrate } from './migrate.js';
import { query, withTransaction, closePool, hasDatabaseUrl } from './db/pool.js';
import { verifyTelegramInitData, getDevTelegramUser } from './auth/telegram.js';
import { createSession, requireAuth } from './auth/session.js';
import { publicUser, upsertTelegramUser } from './services/users.js';
import { getPrimaryWallet, publicWallet, upsertWallet, createWalletNonce } from './services/wallets.js';
import { HttpError, badRequest, notFound, forbidden } from './services/errors.js';
import { parseTonToNano, parseTokenAmount, quoteBuy, quoteSell, quoteToPublic } from './services/bondingCurve.js';
import { tokenToPublic, getTokenById } from './services/tokens.js';
import { getCandles, normalizeInterval, tokenToLiveTick, upsertTradeCandles } from './services/candles.js';
import { buildCommentPayload, buildTonConnectTransaction } from './ton/tonConnect.js';
import { buildJettonDeployPlan, getJettonDeployConfigStatus } from './ton/jettonDeployer.js';
import { verifyTonTransaction } from './ton/chainVerifier.js';
import { createStonFiGraduationDraft } from './ton/stonfiAdapter.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const startedAt = new Date();
const startupState = {
  migration: 'not_started',
  migrationError: null,
};
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(__dirname, '../../web/dist');

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',').map((x) => x.trim()).filter(Boolean) || true }));
app.use(express.json({ limit: '1mb' }));
app.use(pinoHttp({ logger }));

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const createTokenSchema = z.object({
  name: z.string().trim().min(2).max(80),
  ticker: z.string().trim().min(2).max(12).transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')),
  description: z.string().trim().max(2000).default(''),
  imageUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  telegramUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  targetLiquidityTon: z.string().default('100'),
  basePriceTon: z.string().default('0.001'),
  slopeTon: z.string().default('0.000001'),
});

const quoteSchema = z.object({
  side: z.enum(['buy', 'sell']).default('buy'),
  amount: z.string().default('100'),
});

const prepareTradeSchema = z.object({
  side: z.enum(['buy', 'sell']).default('buy'),
  amount: z.string().default('100'),
  walletAddress: z.string().min(3).max(128),
});

const confirmTradeSchema = z.object({
  txHash: z.string().min(3).max(256),
});

function envPublicUrl() {
  return (process.env.PUBLIC_APP_URL || `http://localhost:${port}`).replace(/\/$/, '');
}

function getConfigWarnings() {
  const warnings = [];
  if (!hasDatabaseUrl()) warnings.push('DATABASE_URL is missing');
  if (process.env.NODE_ENV === 'production' && (!process.env.APP_SECRET || process.env.APP_SECRET.length < 32)) {
    warnings.push('APP_SECRET should be at least 32 chars in production');
  }
  if (process.env.NODE_ENV === 'production' && !process.env.TELEGRAM_BOT_TOKEN) {
    warnings.push('TELEGRAM_BOT_TOKEN is missing; Telegram auth will fail');
  }
  if (!process.env.PLATFORM_TON_ADDRESS) warnings.push('PLATFORM_TON_ADDRESS is missing; trade preparation will fail');
  return warnings;
}

async function getBootstrapPayload(userRow) {
  const [wallet, tokensResult] = await Promise.all([
    getPrimaryWallet(userRow.id),
    query(
      `
      SELECT t.*, COUNT(th.user_id) AS holder_count
      FROM tokens t
      LEFT JOIN token_holders th ON th.token_id = t.id AND th.balance_atomic > 0
      WHERE t.moderation_status != 'blocked'
      GROUP BY t.id
      ORDER BY
        CASE t.status
          WHEN 'funding' THEN 1
          WHEN 'awaiting_deploy' THEN 2
          WHEN 'deploy_submitted' THEN 3
          WHEN 'liquidity_pending' THEN 4
          WHEN 'graduated' THEN 5
          ELSE 6
        END,
        t.created_at DESC
      LIMIT 100
      `,
    ),
  ]);

  const statsResult = await query(
    `
    SELECT
      COUNT(*)::int AS token_count,
      COALESCE(SUM(raised_ton_nano), 0)::text AS total_raised_nano,
      COALESCE(SUM(fee_collected_nano), 0)::text AS total_fees_nano
    FROM tokens
    `,
  );

  return {
    me: publicUser(userRow, publicWallet(wallet)),
    tokens: tokensResult.rows.map((row) => tokenToPublic(row, row.holder_count)),
    stats: statsResult.rows[0],
    config: {
      tonNetwork: process.env.TON_NETWORK || 'mainnet',
      platformFeeBps: Number(process.env.PLATFORM_FEE_BPS || 100),
      platformAddress: process.env.PLATFORM_TON_ADDRESS || null,
      publicAppUrl: envPublicUrl(),
      jettonDeploy: getJettonDeployConfigStatus(),
    },
  };
}

async function maybeGraduate(client, token) {
  const raised = BigInt(token.raised_ton_nano || '0');
  const target = BigInt(token.target_liquidity_nano || '0');
  if (target <= 0n || raised < target || !['funding', 'curve_locked'].includes(token.status)) return null;

  const draft = await createStonFiGraduationDraft(token);
  await client.query(`UPDATE tokens SET status = 'liquidity_pending', updated_at = now() WHERE id = $1`, [token.id]);
  const event = await client.query(
    `
    INSERT INTO dex_graduation_events (token_id, status, dex_name, liquidity_ton_nano, token_liquidity_atomic, raw_payload)
    VALUES ($1, 'pending', 'stonfi', $2, $3, $4)
    RETURNING *
    `,
    [token.id, token.raised_ton_nano, token.current_supply_atomic, JSON.stringify(draft)],
  );
  return event.rows[0];
}

// Railway healthcheck must be a fast liveness probe.
// Do not depend on PostgreSQL here: if DATABASE_URL is wrong, Railway would kill
// the replica before you can even open logs. Use /ready for DB/config checks.
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    name: 'TONKET',
    version: '1.2.0-candles',
    uptimeSec: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    migration: startupState.migration,
  });
});

app.get('/ready', asyncHandler(async (_req, res) => {
  const warnings = getConfigWarnings();
  let db = null;
  let dbOk = false;

  try {
    const result = await query('SELECT now() AS now');
    db = result.rows[0].now;
    dbOk = true;
  } catch (error) {
    warnings.push(`Database is not ready: ${error.message}`);
  }

  const ready = dbOk && startupState.migration === 'done' && startupState.migrationError === null;
  res.status(ready ? 200 : 503).json({
    ok: ready,
    name: 'TONKET',
    version: '1.2.0-candles',
    dbOk,
    dbTime: db,
    migration: startupState.migration,
    migrationError: startupState.migrationError,
    warnings,
  });
}));

app.get('/tonconnect-manifest.json', (_req, res) => {
  res.json({
    url: envPublicUrl(),
    name: 'TONKET',
    iconUrl: `${envPublicUrl()}/icon.svg`,
    termsOfUseUrl: `${envPublicUrl()}/terms`,
    privacyPolicyUrl: `${envPublicUrl()}/privacy`,
  });
});

app.post('/api/auth/telegram', asyncHandler(async (req, res) => {
  const { initData } = z.object({ initData: z.string().optional().default('') }).parse(req.body || {});
  const telegramUser = initData
    ? verifyTelegramInitData(initData, process.env.TELEGRAM_BOT_TOKEN)
    : getDevTelegramUser();

  const user = await withTransaction((client) => upsertTelegramUser(client, telegramUser));
  const session = await createSession({
    userId: user.id,
    userAgent: req.headers['user-agent'] || null,
    ip: req.ip,
  });

  const wallet = await getPrimaryWallet(user.id);
  res.status(201).json({
    sessionToken: session.token,
    expiresAt: session.expiresAt,
    me: publicUser(user, publicWallet(wallet)),
  });
}));

app.get('/api/bootstrap', requireAuth, asyncHandler(async (req, res) => {
  res.json(await getBootstrapPayload(req.user));
}));

app.get('/api/me', requireAuth, asyncHandler(async (req, res) => {
  const wallet = await getPrimaryWallet(req.user.id);
  res.json({ me: publicUser(req.user, publicWallet(wallet)) });
}));

app.post('/api/wallet/nonce', requireAuth, asyncHandler(async (_req, res) => {
  res.json({ nonce: createWalletNonce() });
}));

app.post('/api/wallet/connect', requireAuth, asyncHandler(async (req, res) => {
  const input = z.object({
    address: z.string().min(3).max(128),
    network: z.string().max(32).optional().default(process.env.TON_NETWORK || 'mainnet'),
    publicKey: z.string().max(256).optional().nullable(),
    tonProof: z.any().optional().nullable(),
  }).parse(req.body);

  const wallet = await withTransaction((client) => upsertWallet(client, {
    userId: req.user.id,
    address: input.address,
    network: input.network,
    publicKey: input.publicKey,
    tonProof: input.tonProof,
  }));

  res.status(201).json({ wallet: publicWallet(wallet) });
}));

app.get('/api/tokens', requireAuth, asyncHandler(async (_req, res) => {
  const result = await query(
    `
    SELECT t.*, COUNT(th.user_id) AS holder_count
    FROM tokens t
    LEFT JOIN token_holders th ON th.token_id = t.id AND th.balance_atomic > 0
    WHERE t.moderation_status != 'blocked'
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT 100
    `,
  );
  res.json({ tokens: result.rows.map((row) => tokenToPublic(row, row.holder_count)) });
}));

app.get('/api/tokens/:id', requireAuth, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT t.*, COUNT(th.user_id) AS holder_count FROM tokens t LEFT JOIN token_holders th ON th.token_id = t.id AND th.balance_atomic > 0 WHERE t.id = $1 GROUP BY t.id`,
    [req.params.id],
  );
  if (result.rowCount === 0) throw notFound('Token not found');
  res.json({ token: tokenToPublic(result.rows[0], result.rows[0].holder_count) });
}));

app.get('/api/tokens/:id/candles', requireAuth, asyncHandler(async (req, res) => {
  const interval = normalizeInterval(req.query.interval);
  const limit = Math.max(1, Math.min(Number(req.query.limit || 250), 1000));

  const token = await getTokenById({ query }, req.params.id, false);
  if (!token) throw notFound('Token not found');

  const candles = await getCandles({ query }, token.id, { interval, limit });
  res.json({ interval, limit, candles });
}));

app.get('/api/tokens/:id/tick', requireAuth, asyncHandler(async (req, res) => {
  const token = await getTokenById({ query }, req.params.id, false);
  if (!token) throw notFound('Token not found');
  res.json({ tick: tokenToLiveTick(token) });
}));

app.get('/api/jetton/metadata/:id.json', asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM tokens WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) throw notFound('Token not found');
  const token = result.rows[0];
  res.json({
    name: token.name,
    symbol: token.ticker,
    description: token.description,
    image: token.image_url || `${envPublicUrl()}/icon.svg`,
    decimals: String(token.decimals || 9),
  });
}));

app.post('/api/tokens', requireAuth, asyncHandler(async (req, res) => {
  const input = createTokenSchema.parse(req.body);
  if (input.ticker.length < 2) throw badRequest('Ticker must contain at least 2 latin letters or digits');

  const token = await withTransaction(async (client) => {
    const inserted = await client.query(
      `
      INSERT INTO tokens (
        creator_user_id, name, ticker, description, image_url, website_url, telegram_url, twitter_url,
        target_liquidity_nano, base_price_nano, slope_nano, fee_bps, platform_contract_address, metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
      `,
      [
        req.user.id,
        input.name,
        input.ticker,
        input.description,
        input.imageUrl || null,
        input.websiteUrl || null,
        input.telegramUrl || null,
        input.twitterUrl || null,
        parseTonToNano(input.targetLiquidityTon).toString(),
        parseTonToNano(input.basePriceTon).toString(),
        parseTonToNano(input.slopeTon).toString(),
        Number(process.env.PLATFORM_FEE_BPS || 100),
        process.env.PLATFORM_TON_ADDRESS || null,
        JSON.stringify({ created_from: 'telegram_mini_app' }),
      ],
    );
    return inserted.rows[0];
  });

  const deployPlan = buildJettonDeployPlan(token);
  if (deployPlan.ready) {
    await query('UPDATE tokens SET jetton_master_address = $1, jetton_content_uri = $2, updated_at = now() WHERE id = $3', [
      deployPlan.jettonMasterAddress,
      deployPlan.contentUri,
      token.id,
    ]);
    token.jetton_master_address = deployPlan.jettonMasterAddress;
    token.jetton_content_uri = deployPlan.contentUri;
  }

  res.status(201).json({ token: tokenToPublic(token), deployPlan });
}));

app.post('/api/tokens/:id/deploy/prepare', requireAuth, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM tokens WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) throw notFound('Token not found');
  const token = result.rows[0];
  if (token.creator_user_id !== req.user.id && req.user.role !== 'admin') throw forbidden('Only creator can deploy this token');
  const deployPlan = buildJettonDeployPlan(token);
  res.json({ deployPlan });
}));

app.post('/api/tokens/:id/deploy/confirm', requireAuth, asyncHandler(async (req, res) => {
  const { txHash } = z.object({ txHash: z.string().min(3).max(256) }).parse(req.body);
  const updated = await withTransaction(async (client) => {
    const token = await getTokenById(client, req.params.id, true);
    if (!token) throw notFound('Token not found');
    if (token.creator_user_id !== req.user.id && req.user.role !== 'admin') throw forbidden('Only creator can confirm deploy');
    const deployPlan = buildJettonDeployPlan(token);
    await client.query(
      `UPDATE tokens SET status = 'deploy_submitted', jetton_master_address = COALESCE(jetton_master_address, $1), jetton_content_uri = COALESCE(jetton_content_uri, $2), jetton_deploy_tx_hash = $3, updated_at = now() WHERE id = $4`,
      [deployPlan.jettonMasterAddress || null, deployPlan.contentUri || null, txHash, token.id],
    );
    const reread = await getTokenById(client, token.id, false);
    return reread;
  });
  res.json({ token: tokenToPublic(updated), status: 'deploy_submitted' });
}));

app.post('/api/tokens/:id/activate', requireAuth, asyncHandler(async (req, res) => {
  const updated = await withTransaction(async (client) => {
    const token = await getTokenById(client, req.params.id, true);
    if (!token) throw notFound('Token not found');
    if (token.creator_user_id !== req.user.id && req.user.role !== 'admin') throw forbidden('Only creator can activate token');
    if (!token.jetton_master_address) throw badRequest('Deploy Jetton first or configure Jetton deployment');
    await client.query(`UPDATE tokens SET status = 'funding', updated_at = now() WHERE id = $1`, [token.id]);
    return getTokenById(client, token.id, false);
  });
  res.json({ token: tokenToPublic(updated) });
}));

app.post('/api/tokens/:id/quote', requireAuth, asyncHandler(async (req, res) => {
  const input = quoteSchema.parse(req.body || {});
  const result = await query('SELECT * FROM tokens WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) throw notFound('Token not found');
  const token = result.rows[0];
  const amountAtomic = parseTokenAmount(input.amount, token.decimals || 9);
  const quote = input.side === 'buy'
    ? quoteBuy({ supplyAtomic: token.current_supply_atomic, amountAtomic, basePriceNano: token.base_price_nano, slopeNano: token.slope_nano, feeBps: token.fee_bps })
    : quoteSell({ supplyAtomic: token.current_supply_atomic, amountAtomic, basePriceNano: token.base_price_nano, slopeNano: token.slope_nano, feeBps: token.fee_bps });
  res.json({ quote: quoteToPublic(quote) });
}));

app.post('/api/tokens/:id/trades/prepare', requireAuth, asyncHandler(async (req, res) => {
  const input = prepareTradeSchema.parse(req.body || {});
  if (!process.env.PLATFORM_TON_ADDRESS) throw badRequest('PLATFORM_TON_ADDRESS is not configured');

  const prepared = await withTransaction(async (client) => {
    const token = await getTokenById(client, req.params.id, true);
    if (!token) throw notFound('Token not found');
    if (token.status !== 'funding') throw badRequest(`Token is not open for bonding curve trades. Current status: ${token.status}`);

    const amountAtomic = parseTokenAmount(input.amount, token.decimals || 9);
    const quote = input.side === 'buy'
      ? quoteBuy({ supplyAtomic: token.current_supply_atomic, amountAtomic, basePriceNano: token.base_price_nano, slopeNano: token.slope_nano, feeBps: token.fee_bps })
      : quoteSell({ supplyAtomic: token.current_supply_atomic, amountAtomic, basePriceNano: token.base_price_nano, slopeNano: token.slope_nano, feeBps: token.fee_bps });

    if (input.side === 'sell') {
      const holding = await client.query('SELECT balance_atomic FROM token_holders WHERE token_id = $1 AND user_id = $2', [token.id, req.user.id]);
      const balance = BigInt(holding.rows[0]?.balance_atomic || '0');
      if (balance < BigInt(amountAtomic)) throw badRequest('Not enough token balance to sell');
    }

    const comment = `TONKET:${input.side}:${token.id}:${req.user.id}:${Date.now()}`;
    const payload = buildCommentPayload(comment);
    const tonAmount = input.side === 'buy'
      ? quote.totalTonNano
      : BigInt(Math.round(Number(process.env.TRADE_FORWARD_AMOUNT_TON || '0.035') * 1_000_000_000)).toString();

    const trade = await client.query(
      `
      INSERT INTO trades (
        token_id, user_id, wallet_address, side, token_amount_atomic, gross_ton_nano, fee_ton_nano, net_ton_nano,
        price_start_nano, price_end_nano, supply_before_atomic, supply_after_atomic, ton_payload, expires_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now() + interval '10 minutes')
      RETURNING *
      `,
      [
        token.id,
        req.user.id,
        input.walletAddress,
        input.side,
        quote.amountAtomic,
        quote.grossTonNano,
        quote.feeTonNano,
        quote.netTonNano,
        quote.priceStartNano,
        quote.priceEndNano,
        quote.supplyBeforeAtomic,
        quote.supplyAfterAtomic,
        payload,
      ],
    );

    return {
      token,
      trade: trade.rows[0],
      quote,
      transaction: buildTonConnectTransaction({
        to: process.env.PLATFORM_TON_ADDRESS,
        amountNano: tonAmount,
        payload,
      }),
    };
  });

  res.status(201).json({
    tradeId: prepared.trade.id,
    quote: quoteToPublic(prepared.quote),
    transaction: prepared.transaction,
  });
}));

app.post('/api/trades/:id/confirm', requireAuth, asyncHandler(async (req, res) => {
  const input = confirmTradeSchema.parse(req.body || {});

  const output = await withTransaction(async (client) => {
    const tradeResult = await client.query('SELECT * FROM trades WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.user.id]);
    if (tradeResult.rowCount === 0) throw notFound('Trade not found');
    const trade = tradeResult.rows[0];
    if (trade.status !== 'prepared') throw badRequest(`Trade already ${trade.status}`);
    if (new Date(trade.expires_at).getTime() < Date.now()) throw badRequest('Trade expired');

    const token = await getTokenById(client, trade.token_id, true);
    if (!token) throw notFound('Token not found');
    if (String(token.current_supply_atomic) !== String(trade.supply_before_atomic)) {
      throw badRequest('Curve moved. Please prepare a fresh quote');
    }

    const verification = await verifyTonTransaction(input.txHash, { trade, token });
    const requireVerify = process.env.REQUIRE_CHAIN_VERIFICATION === 'true';
    if (requireVerify && !verification.verified) throw badRequest('Transaction is not verified on-chain yet');

    if (trade.side === 'buy') {
      await client.query(
        `
        UPDATE tokens SET
          current_supply_atomic = $1,
          raised_ton_nano = raised_ton_nano + $2,
          fee_collected_nano = fee_collected_nano + $3,
          last_price_nano = $4,
          updated_at = now()
        WHERE id = $5
        `,
        [trade.supply_after_atomic, trade.gross_ton_nano, trade.fee_ton_nano, trade.price_end_nano, token.id],
      );

      await client.query(
        `
        INSERT INTO token_holders (token_id, user_id, balance_atomic, avg_entry_ton_nano)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (token_id, user_id) DO UPDATE SET
          balance_atomic = token_holders.balance_atomic + EXCLUDED.balance_atomic,
          avg_entry_ton_nano = EXCLUDED.avg_entry_ton_nano,
          updated_at = now()
        `,
        [token.id, req.user.id, trade.token_amount_atomic, trade.price_end_nano],
      );
    } else {
      await client.query(
        `UPDATE token_holders SET balance_atomic = balance_atomic - $1, updated_at = now() WHERE token_id = $2 AND user_id = $3`,
        [trade.token_amount_atomic, token.id, req.user.id],
      );
      await client.query(
        `
        UPDATE tokens SET
          current_supply_atomic = $1,
          raised_ton_nano = GREATEST(raised_ton_nano - $2::numeric, 0),
          fee_collected_nano = fee_collected_nano + $3,
          last_price_nano = $4,
          updated_at = now()
        WHERE id = $5
        `,
        [trade.supply_after_atomic, trade.gross_ton_nano, trade.fee_ton_nano, trade.price_end_nano, token.id],
      );
    }

    await client.query(
      `UPDATE trades SET status = 'confirmed', ton_tx_hash = $1, confirmed_at = now(), metadata = metadata || $2::jsonb WHERE id = $3`,
      [input.txHash, JSON.stringify({ verification }), trade.id],
    );

    const updatedToken = await getTokenById(client, token.id, true);
    await client.query(
      `INSERT INTO price_snapshots (token_id, price_nano, supply_atomic, raised_ton_nano) VALUES ($1,$2,$3,$4)`,
      [token.id, trade.price_end_nano, updatedToken.current_supply_atomic, updatedToken.raised_ton_nano],
    );
    await upsertTradeCandles(client, trade, new Date());
    const graduation = await maybeGraduate(client, updatedToken);
    const finalToken = await getTokenById(client, token.id, false);
    return { token: finalToken, graduation };
  });

  res.json({ token: tokenToPublic(output.token), graduation: output.graduation });
}));

app.use(express.static(webDist, { fallthrough: true }));
app.get('*', (_req, res) => {
  res.sendFile(path.join(webDist, 'index.html'));
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Validation error', details: error.flatten() });
    return;
  }
  const status = error instanceof HttpError ? error.status : error.status || 500;
  const message = status >= 500 ? 'Internal server error' : error.message;
  if (status >= 500) logger.error(error);
  res.status(status).json({ error: message, details: error.details });
});

async function main() {
  const warnings = getConfigWarnings();
  for (const warning of warnings) logger.warn({ warning }, 'configuration warning');

  const server = app.listen(port, host, () => {
    logger.info({ host, port }, `TONKET listening on ${host}:${port}`);
  });

  // Run migrations after binding the port so Railway healthcheck can pass even
  // while PostgreSQL is waking up. API routes will still report DB errors until
  // /ready is healthy.
  startupState.migration = 'running';
  migrate()
    .then(() => {
      startupState.migration = 'done';
      startupState.migrationError = null;
      logger.info('database migrations finished');
    })
    .catch((error) => {
      startupState.migration = 'failed';
      startupState.migrationError = error.message;
      logger.error(error, 'database migrations failed');
    });

  const shutdown = async () => {
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error(error, 'fatal startup error');
  process.exit(1);
});
