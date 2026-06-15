# TONKET — TMA Blank Screen Fix

Railway-ready fullstack Telegram Mini App with backend-driven token list, Telegram auth, TonConnect, Jetton deploy adapter, OHLCV candles and a safer frontend boot process.

## What this hotfix changes

- Adds a visible HTML bootloader inside `#root`, so Telegram will never show a silent gray screen if the JS bundle fails.
- Adds global `window.onerror` and `unhandledrejection` handlers before React starts.
- Changes `main.tsx` to dynamically import the app and render a fatal boot screen if module loading fails.
- Adds `height: 100%` / `overflow` fixes for Telegram WebView.
- Adds Vite `build.target = es2018` for safer Telegram WebView compatibility.
- Adds `/favicon.ico` and no-cache headers for HTML, so Telegram/Railway do not keep stale broken frontend HTML.
- Keeps `/health` fast and `/ready` for DB/config checks.

## Local run

```bash
cp .env.example .env
# for local browser testing only
# ALLOW_DEV_AUTH=true

docker compose up --build
```

Open:

```text
http://localhost:8080
```

## Railway deploy

Required variables:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_SECRET=long_random_secret_at_least_32_chars
TELEGRAM_BOT_TOKEN=your_bot_token
PUBLIC_APP_URL=https://your-domain.up.railway.app
CORS_ORIGIN=https://your-domain.up.railway.app
ALLOW_DEV_AUTH=false
TON_NETWORK=mainnet
PLATFORM_TON_ADDRESS=UQ_or_EQ_address
PLATFORM_ADMIN_TON_ADDRESS=UQ_or_EQ_address
PLATFORM_FEE_BPS=100
JETTON_METADATA_BASE_URL=https://your-domain.up.railway.app/api/jetton/metadata
JETTON_MASTER_CODE_BOC_BASE64=...
JETTON_WALLET_CODE_BOC_BASE64=...
```

After deploy check:

```text
https://your-domain.up.railway.app/health
https://your-domain.up.railway.app/ready
```

## Telegram checklist

1. BotFather → `/setmenubutton` or `/newapp` must point to your current Railway URL.
2. The URL must be HTTPS.
3. `PUBLIC_APP_URL` and `CORS_ORIGIN` must match the same Railway domain.
4. If Telegram still shows old UI, change the URL query once, for example `https://your-domain.up.railway.app/?v=2`, because Telegram clients cache web apps aggressively.
