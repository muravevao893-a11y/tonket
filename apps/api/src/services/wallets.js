import crypto from 'node:crypto';
import { query } from '../db/pool.js';

export function createWalletNonce() {
  return crypto.randomBytes(24).toString('base64url');
}

export async function getPrimaryWallet(userId) {
  const result = await query(
    `SELECT * FROM user_wallets WHERE user_id = $1 ORDER BY connected_at DESC LIMIT 1`,
    [userId],
  );
  return result.rows[0] || null;
}

export function publicWallet(row) {
  if (!row) return null;
  return {
    address: row.address,
    network: row.network,
    publicKey: row.public_key,
    isVerified: row.is_verified,
    connectedAt: row.connected_at,
  };
}

export async function upsertWallet(client, { userId, address, network, publicKey, tonProof }) {
  const result = await client.query(
    `
    INSERT INTO user_wallets (user_id, address, network, public_key, ton_proof_payload, is_verified)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, address) DO UPDATE SET
      network = EXCLUDED.network,
      public_key = COALESCE(EXCLUDED.public_key, user_wallets.public_key),
      ton_proof_payload = COALESCE(EXCLUDED.ton_proof_payload, user_wallets.ton_proof_payload),
      updated_at = now()
    RETURNING *
    `,
    [userId, address, network || process.env.TON_NETWORK || 'mainnet', publicKey || null, tonProof ? JSON.stringify(tonProof) : null, false],
  );
  return result.rows[0];
}
