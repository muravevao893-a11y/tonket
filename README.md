# TONKET Railway Fullstack

TONKET is a Telegram Mini App skeleton for a TON meme-pad / bonding-curve launchpad.
This version is built for Railway deployment and removes demo UI/data: the frontend renders only backend data from PostgreSQL.

## What is included

- React + TypeScript + Tailwind mobile-first Telegram Mini App UI.
- Node.js + Express backend served from the same Railway service.
- PostgreSQL migrations and production schema.
- Telegram Mini App `initData` authentication with HMAC verification.
- Real Telegram profile sync: Telegram ID, username, first/last name, premium flag, language and avatar URL.
- Real TonConnect UI wallet connection in the frontend.
- Backend wallet sync into `user_wallets`.
- Backend-driven token list, token creation, bonding-curve pricing, trade preparation and confirmation flow.
- Jetton deploy transaction preparation through TonConnect **when audited Jetton Master/Wallet BOC values are configured**.
- Railway `railway.json`, `Procfile`, `Dockerfile`, `.env.example`, static frontend serving from API.
- STON.fi graduation event draft table/adapter for the next production integration step.

## Important production note

The project does **not** fake token deployment. To prepare a real Jetton deployment transaction, you must provide audited TON Jetton contract BOCs:

```env
JETTON_MASTER_CODE_BOC_BASE64=...
JETTON_WALLET_CODE_BOC_BASE64=...
PLATFORM_ADMIN_TON_ADDRESS=...
```

Without these values, token creation still saves the token in PostgreSQL, but the API returns a clear `deployPlan.ready=false` response. This is intentional: fake “created token” UI is dangerous and useless in production.

## Local launch

```bash
cp .env.example .env
# For local browser testing only:
# set ALLOW_DEV_AUTH=true in .env

docker compose up --build
```

Open:

```text
http://localhost:8080
```

Health check:

```text
http://localhost:8080/health
```

## Local launch without Docker

Terminal 1:

```bash
cp .env.example .env
npm install
npm run migrate
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

Open:

```text
http://localhost:5173
```

## Railway deployment

1. Push this folder to GitHub.
2. Create a Railway project from the repo.
3. Add a PostgreSQL plugin/service.
4. Set variables in the app service:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_SECRET=<64+ random chars>
TELEGRAM_BOT_TOKEN=<your bot token>
PUBLIC_APP_URL=https://<your-app>.up.railway.app
CORS_ORIGIN=https://<your-app>.up.railway.app
ALLOW_DEV_AUTH=false
TON_NETWORK=mainnet
PLATFORM_TON_ADDRESS=<your platform contract/address>
PLATFORM_ADMIN_TON_ADDRESS=<your admin TON address>
PLATFORM_FEE_BPS=100
JETTON_METADATA_BASE_URL=https://<your-app>.up.railway.app/api/jetton/metadata
```

5. Deploy. Railway uses `railway.json`:

```bash
npm install && npm run build
npm run start
```

6. In BotFather, set the Mini App URL to:

```text
https://<your-app>.up.railway.app
```

## Recommended next hardening before real money

- Deploy audited platform bonding-curve smart contract. The current backend prepares TonConnect messages to `PLATFORM_TON_ADDRESS`; production should verify every transaction before crediting balances.
- Implement TON Center/TonAPI transaction verification and set `REQUIRE_CHAIN_VERIFICATION=true`.
- Add TonConnect `ton_proof` signature verification for wallet ownership.
- Add upload/pinning for Jetton metadata images, ideally via IPFS or trusted object storage.
- Replace STON.fi draft adapter with full STON.fi SDK/API pool creation and liquidity provision flow after contract audit.
- Add admin moderation for token names/images/descriptions.
- Add rate limits and anti-spam for token creation/trading.

## Useful commands

```bash
npm run test:curve
npm run build
npm run start
```

## Project structure

```text
apps/api   Express backend, migrations, TON adapters
apps/web   React Telegram Mini App frontend
```
