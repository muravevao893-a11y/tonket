# TONKET Railway Candles Ready

TONKET is a Telegram Mini App / Web3 meme-pad skeleton for TON with PostgreSQL, Telegram auth, TonConnect, Jetton deploy adapter, bonding curve trading, and now real backend-driven candlestick charts.

## What is new in 1.2.0

- Added `trade_candles` PostgreSQL table for OHLCV candles.
- Added candle aggregation on every confirmed trade.
- Added backend endpoints:
  - `GET /api/tokens/:id/candles?interval=1m&limit=350`
  - `GET /api/tokens/:id/tick`
- Added production React component: `apps/web/src/components/LiveCandleChart.tsx`.
- Added mobile token detail sheet with chart, timeframe selector, OHLC readout, fit button, buy/sell panel.
- Added `lightweight-charts` from TradingView.
- No mock candle data: chart reads confirmed trades and live price from backend.

## Local launch

```bash
cp .env.example .env
```

For local browser testing without Telegram, set:

```env
ALLOW_DEV_AUTH=true
```

Then run with Docker:

```bash
docker compose up --build
```

Open:

```text
http://localhost:8080
```

Or run manually:

```bash
npm install
npm run build
npm run start
```

## Railway deploy

Railway should use the root project.

Required variables:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_SECRET=your_long_random_secret
TELEGRAM_BOT_TOKEN=your_bot_token
PUBLIC_APP_URL=https://your-domain.up.railway.app
CORS_ORIGIN=https://your-domain.up.railway.app
ALLOW_DEV_AUTH=false
TON_NETWORK=mainnet
PLATFORM_TON_ADDRESS=UQ_or_EQ_platform_address
PLATFORM_ADMIN_TON_ADDRESS=UQ_or_EQ_admin_address
PLATFORM_FEE_BPS=100
JETTON_METADATA_BASE_URL=https://your-domain.up.railway.app/api/jetton/metadata
```

Optional Jetton deploy config:

```env
JETTON_MASTER_CODE_BOC_BASE64=...
JETTON_WALLET_CODE_BOC_BASE64=...
```

Healthchecks:

```text
/health  - liveness, does not depend on DB
/ready   - DB and migration readiness
```

## Candle API

### Get historical candles

```http
GET /api/tokens/:id/candles?interval=1m&limit=350
Authorization: Bearer <sessionToken>
```

Response:

```json
{
  "interval": "1m",
  "limit": 350,
  "candles": [
    { "time": 1781491200, "open": 0.001, "high": 0.0012, "low": 0.0009, "close": 0.0011, "volumeTon": "12.4", "volumeTokenAtomic": "100000000000", "tradesCount": 3 }
  ]
}
```

### Get live tick

```http
GET /api/tokens/:id/tick
Authorization: Bearer <sessionToken>
```

Response:

```json
{
  "tick": { "time": 1781491201, "price": 0.0011, "priceTon": "0.0011" }
}
```

## Component

Main component:

```text
apps/web/src/components/LiveCandleChart.tsx
```

Props:

```ts
historicalData: Array<{ time: number | string; open: number; high: number; low: number; close: number }>;
liveTick: { time: number | string; price: number } | null;
```

The component creates the TradingView chart once, uses `setData()` only for historical candles, and uses `update()` for incoming live ticks.

## Verification performed

```text
✅ npm install --package-lock=false --ignore-scripts
✅ npm run build
✅ node --check apps/api/src/server.js
✅ node --check apps/api/src/services/candles.js
✅ npm run test:curve
```

Note: local Node was v22, while Railway/Docker uses Node 20 as configured in `package.json` and Dockerfile.
