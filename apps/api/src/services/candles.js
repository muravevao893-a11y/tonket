import { formatNanoTon, priceAtSupply } from './bondingCurve.js';

export const CANDLE_INTERVALS = Object.freeze({
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
});

export function normalizeInterval(interval) {
  const value = String(interval || '1m');
  if (!Object.prototype.hasOwnProperty.call(CANDLE_INTERVALS, value)) return '1m';
  return value;
}

function toBigIntString(value, fallback = '0') {
  if (value === null || value === undefined || value === '') return fallback;
  return BigInt(String(value)).toString();
}

function floorBucket(dateInput, interval) {
  const seconds = CANDLE_INTERVALS[normalizeInterval(interval)];
  const ms = new Date(dateInput).getTime();
  const bucketSeconds = Math.floor(ms / 1000 / seconds) * seconds;
  return new Date(bucketSeconds * 1000);
}

export function candleToPublic(row) {
  return {
    time: Math.floor(new Date(row.bucket_at).getTime() / 1000),
    open: Number(formatNanoTon(row.open_nano, 9)),
    high: Number(formatNanoTon(row.high_nano, 9)),
    low: Number(formatNanoTon(row.low_nano, 9)),
    close: Number(formatNanoTon(row.close_nano, 9)),
    volumeTon: formatNanoTon(row.volume_ton_nano, 6),
    volumeTokenAtomic: String(row.volume_token_atomic),
    tradesCount: Number(row.trades_count || 0),
  };
}

export async function upsertTradeCandles(client, trade, confirmedAt = new Date()) {
  const priceNano = toBigIntString(trade.price_end_nano, '1');
  const tokenAmountAtomic = toBigIntString(trade.token_amount_atomic);
  const tonVolumeNano = toBigIntString(trade.gross_ton_nano);

  for (const interval of Object.keys(CANDLE_INTERVALS)) {
    const bucketAt = floorBucket(confirmedAt, interval);
    await client.query(
      `
      INSERT INTO trade_candles (
        token_id, interval_text, bucket_at, open_nano, high_nano, low_nano, close_nano,
        volume_token_atomic, volume_ton_nano, trades_count
      )
      VALUES ($1,$2,$3,$4,$4,$4,$4,$5,$6,1)
      ON CONFLICT (token_id, interval_text, bucket_at) DO UPDATE SET
        high_nano = GREATEST(trade_candles.high_nano, EXCLUDED.high_nano),
        low_nano = LEAST(trade_candles.low_nano, EXCLUDED.low_nano),
        close_nano = EXCLUDED.close_nano,
        volume_token_atomic = trade_candles.volume_token_atomic + EXCLUDED.volume_token_atomic,
        volume_ton_nano = trade_candles.volume_ton_nano + EXCLUDED.volume_ton_nano,
        trades_count = trade_candles.trades_count + 1,
        updated_at = now()
      `,
      [trade.token_id, interval, bucketAt.toISOString(), priceNano, tokenAmountAtomic, tonVolumeNano],
    );
  }
}

export async function getCandles(clientOrPool, tokenId, { interval = '1m', limit = 250 } = {}) {
  const safeInterval = normalizeInterval(interval);
  const safeLimit = Math.max(1, Math.min(Number(limit || 250), 1000));
  const result = await clientOrPool.query(
    `
    SELECT *
    FROM trade_candles
    WHERE token_id = $1 AND interval_text = $2
    ORDER BY bucket_at DESC
    LIMIT $3
    `,
    [tokenId, safeInterval, safeLimit],
  );

  return result.rows.reverse().map(candleToPublic);
}

export function tokenToLiveTick(token) {
  const priceNano = priceAtSupply({
    supplyAtomic: token.current_supply_atomic,
    basePriceNano: token.base_price_nano,
    slopeNano: token.slope_nano,
  }).toString();

  return {
    time: Math.floor(Date.now() / 1000),
    price: Number(formatNanoTon(priceNano, 9)),
    priceTon: formatNanoTon(priceNano, 9),
  };
}
