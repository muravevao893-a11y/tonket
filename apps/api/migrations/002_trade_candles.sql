CREATE TABLE IF NOT EXISTS trade_candles (
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  interval_text TEXT NOT NULL CHECK (interval_text IN ('1m', '5m', '15m', '1h', '4h', '1d')),
  bucket_at TIMESTAMPTZ NOT NULL,
  open_nano NUMERIC(78,0) NOT NULL,
  high_nano NUMERIC(78,0) NOT NULL,
  low_nano NUMERIC(78,0) NOT NULL,
  close_nano NUMERIC(78,0) NOT NULL,
  volume_token_atomic NUMERIC(78,0) NOT NULL DEFAULT 0,
  volume_ton_nano NUMERIC(78,0) NOT NULL DEFAULT 0,
  trades_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (token_id, interval_text, bucket_at),
  CONSTRAINT candle_positive_open CHECK (open_nano > 0),
  CONSTRAINT candle_positive_high CHECK (high_nano > 0),
  CONSTRAINT candle_positive_low CHECK (low_nano > 0),
  CONSTRAINT candle_positive_close CHECK (close_nano > 0),
  CONSTRAINT candle_ohlc_valid CHECK (high_nano >= low_nano AND high_nano >= open_nano AND high_nano >= close_nano AND low_nano <= open_nano AND low_nano <= close_nano),
  CONSTRAINT candle_volume_non_negative CHECK (volume_token_atomic >= 0 AND volume_ton_nano >= 0 AND trades_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_trade_candles_token_interval_time
  ON trade_candles(token_id, interval_text, bucket_at DESC);
