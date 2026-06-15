import crypto from 'node:crypto';
import { badRequest, unauthorized } from '../services/errors.js';

function parseInitData(initData) {
  const params = new URLSearchParams(initData);
  const data = {};
  for (const [key, value] of params.entries()) data[key] = value;
  return data;
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string') throw unauthorized('Telegram initData is missing');
  if (!botToken) throw unauthorized('TELEGRAM_BOT_TOKEN is not configured');

  const parsed = parseInitData(initData);
  const receivedHash = parsed.hash;
  if (!receivedHash) throw unauthorized('Telegram initData hash is missing');

  const checkString = Object.entries(parsed)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

  if (!timingSafeEqualHex(calculatedHash, receivedHash)) {
    throw unauthorized('Invalid Telegram initData signature');
  }

  const authDate = Number(parsed.auth_date || 0);
  const maxAgeSeconds = Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86400);
  if (!Number.isFinite(authDate) || authDate <= 0) throw unauthorized('Invalid Telegram auth_date');
  if (Date.now() / 1000 - authDate > maxAgeSeconds) throw unauthorized('Telegram initData expired');

  let user;
  try {
    user = JSON.parse(parsed.user || '{}');
  } catch {
    throw badRequest('Cannot parse Telegram user payload');
  }

  if (!user?.id) throw unauthorized('Telegram user id is missing');

  return {
    telegramId: String(user.id),
    username: user.username || null,
    firstName: user.first_name || null,
    lastName: user.last_name || null,
    languageCode: user.language_code || null,
    photoUrl: user.photo_url || null,
    isPremium: Boolean(user.is_premium),
    raw: parsed,
  };
}

export function getDevTelegramUser() {
  if (process.env.ALLOW_DEV_AUTH !== 'true') throw unauthorized('Open this app inside Telegram');
  return {
    telegramId: String(process.env.DEV_TELEGRAM_ID || '100000001'),
    username: process.env.DEV_USERNAME || 'local_builder',
    firstName: process.env.DEV_FIRST_NAME || 'Local',
    lastName: process.env.DEV_LAST_NAME || 'Dev',
    languageCode: 'en',
    photoUrl: process.env.DEV_PHOTO_URL || null,
    isPremium: false,
    raw: { dev: true },
  };
}
