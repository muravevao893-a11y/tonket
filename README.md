# TONKET — Railway + Telegram frontend gray-screen hotfix

Этот архив — hotfix поверх `tonket-candles-ready`.

Что исправлено:

- Добавлен официальный Telegram WebApp script в `apps/web/index.html`:
  `https://telegram.org/js/telegram-web-app.js`
- Добавлен React ErrorBoundary. Если фронт падает, Mini App теперь показывает ошибку, а не серый экран.
- Добавлен boot diagnostics экран: `/health`, `/ready`, Telegram WebApp object, initData, origin.
- API-клиент теперь явно ловит ситуацию, когда backend вместо JSON возвращает HTML `index.html`.
- Добавлен timeout API-запросов.
- React переведен на стабильную ветку `18.3.1`, чтобы снизить риск конфликтов с WebView/TonConnect.
- Исправлен stale-state баг при синхронизации кошелька.

## Локальный запуск

```bash
cp .env.example .env
```

Для локального браузера поставь:

```env
ALLOW_DEV_AUTH=true
```

Запуск:

```bash
docker compose up --build
```

Открыть:

```text
http://localhost:8080
```

## Railway

Обязательные переменные:

```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
APP_SECRET=длинный_секрет_минимум_32_символа
TELEGRAM_BOT_TOKEN=токен_бота
PUBLIC_APP_URL=https://твой-домен.up.railway.app
CORS_ORIGIN=https://твой-домен.up.railway.app
ALLOW_DEV_AUTH=false
TON_NETWORK=mainnet
PLATFORM_TON_ADDRESS=UQ_или_EQ_адрес
PLATFORM_ADMIN_TON_ADDRESS=UQ_или_EQ_адрес
PLATFORM_FEE_BPS=100
JETTON_METADATA_BASE_URL=https://твой-домен.up.railway.app/api/jetton/metadata
```

После деплоя проверь:

```text
https://твой-домен.up.railway.app/health
https://твой-домен.up.railway.app/ready
```

Если `/health` зелёный, а `/ready` красный — фронт живой, проблема в PostgreSQL/env.

## Важно для Telegram Mini App

В BotFather нужно указать Web App URL именно на Railway-домен:

```text
https://твой-домен.up.railway.app
```

Открывать нужно через кнопку Mini App/бота. Если просто вставить ссылку в браузер Telegram, `initData` может не прийти.
