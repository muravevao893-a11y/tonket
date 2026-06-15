CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id TEXT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  photo_url TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  chain TEXT NOT NULL DEFAULT 'ton',
  network TEXT NOT NULL DEFAULT 'mainnet',
  public_key TEXT,
  ton_proof_nonce TEXT,
  ton_proof_payload JSONB,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, address)
);

CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  ticker TEXT NOT NULL CHECK (ticker ~ '^[A-Z0-9]{2,12}$'),
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  website_url TEXT,
  telegram_url TEXT,
  twitter_url TEXT,

  status TEXT NOT NULL DEFAULT 'awaiting_deploy' CHECK (status IN (
    'awaiting_deploy',
    'deploy_submitted',
    'funding',
    'curve_locked',
    'liquidity_pending',
    'graduated',
    'paused',
    'failed'
  )),

  decimals INTEGER NOT NULL DEFAULT 9 CHECK (decimals BETWEEN 0 AND 18),
  fee_bps INTEGER NOT NULL DEFAULT 100 CHECK (fee_bps BETWEEN 0 AND 1000),

  jetton_master_address TEXT,
  jetton_content_uri TEXT,
  jetton_deploy_tx_hash TEXT,
  platform_contract_address TEXT,

  target_liquidity_nano NUMERIC(78,0) NOT NULL,
  raised_ton_nano NUMERIC(78,0) NOT NULL DEFAULT 0,
  fee_collected_nano NUMERIC(78,0) NOT NULL DEFAULT 0,
  current_supply_atomic NUMERIC(78,0) NOT NULL DEFAULT 0,
  virtual_supply_atomic NUMERIC(78,0) NOT NULL DEFAULT 0,

  curve_formula TEXT NOT NULL DEFAULT 'linear' CHECK (curve_formula IN ('linear')),
  base_price_nano NUMERIC(78,0) NOT NULL,
  slope_nano NUMERIC(78,0) NOT NULL,
  last_price_nano NUMERIC(78,0) NOT NULL DEFAULT 0,

  dex_name TEXT DEFAULT 'stonfi',
  dex_pool_address TEXT,
  stonfi_tx_hash TEXT,
  graduated_at TIMESTAMPTZ,

  moderation_status TEXT NOT NULL DEFAULT 'clean' CHECK (moderation_status IN ('clean', 'review', 'blocked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT positive_target_liquidity CHECK (target_liquidity_nano > 0),
  CONSTRAINT positive_base_price CHECK (base_price_nano > 0),
  CONSTRAINT non_negative_slope CHECK (slope_nano >= 0),
  CONSTRAINT non_negative_supply CHECK (current_supply_atomic >= 0),
  CONSTRAINT non_negative_raised CHECK (raised_ton_nano >= 0)
);

CREATE INDEX IF NOT EXISTS idx_tokens_status_created ON tokens(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_ticker ON tokens(ticker);
CREATE INDEX IF NOT EXISTS idx_tokens_progress ON tokens(raised_ton_nano, target_liquidity_nano);

CREATE TABLE IF NOT EXISTS token_holders (
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  balance_atomic NUMERIC(78,0) NOT NULL DEFAULT 0,
  avg_entry_ton_nano NUMERIC(78,0) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(token_id, user_id),
  CONSTRAINT non_negative_balance CHECK (balance_atomic >= 0)
);

CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  wallet_address TEXT,
  side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'submitted', 'confirmed', 'failed', 'expired')),
  token_amount_atomic NUMERIC(78,0) NOT NULL,
  gross_ton_nano NUMERIC(78,0) NOT NULL,
  fee_ton_nano NUMERIC(78,0) NOT NULL,
  net_ton_nano NUMERIC(78,0) NOT NULL,
  price_start_nano NUMERIC(78,0) NOT NULL,
  price_end_nano NUMERIC(78,0) NOT NULL,
  supply_before_atomic NUMERIC(78,0) NOT NULL,
  supply_after_atomic NUMERIC(78,0) NOT NULL,
  ton_tx_hash TEXT,
  ton_payload TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trades_token_created ON trades(token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_created ON trades(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  price_nano NUMERIC(78,0) NOT NULL,
  supply_atomic NUMERIC(78,0) NOT NULL,
  raised_ton_nano NUMERIC(78,0) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_snapshots_token_created ON price_snapshots(token_id, created_at DESC);

CREATE TABLE IF NOT EXISTS dex_graduation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed')),
  dex_name TEXT NOT NULL DEFAULT 'stonfi',
  liquidity_ton_nano NUMERIC(78,0) NOT NULL,
  token_liquidity_atomic NUMERIC(78,0) NOT NULL DEFAULT 0,
  pool_address TEXT,
  tx_hash TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
