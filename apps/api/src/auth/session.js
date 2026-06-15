import crypto from 'node:crypto';
import { query } from '../db/pool.js';
import { unauthorized, forbidden } from '../services/errors.js';

const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export async function createSession({ userId, userAgent, ip }) {
  const token = randomToken();
  const tokenHash = sha256(token);
  const ipHash = ip ? sha256(`${process.env.APP_SECRET || 'dev'}:${ip}`) : null;
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await query(
    `
    INSERT INTO user_sessions (user_id, token_hash, user_agent, ip_hash, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [userId, tokenHash, userAgent || null, ipHash, expiresAt.toISOString()],
  );

  return { token, expiresAt };
}

export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) throw unauthorized('Missing session token');

    const result = await query(
      `
      SELECT s.id AS session_id, u.*
      FROM user_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
      LIMIT 1
      `,
      [sha256(token)],
    );

    if (result.rowCount === 0) throw unauthorized('Invalid or expired session');
    const user = result.rows[0];
    if (user.is_blocked) throw forbidden('Account is blocked');
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
