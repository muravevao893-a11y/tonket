import pg from 'pg';

const { Pool } = pg;

let poolInstance = null;

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) {
    throw new Error('DATABASE_URL is required. Add a PostgreSQL database to Railway and set DATABASE_URL=${{Postgres.DATABASE_URL}}.');
  }
  return url.trim();
}

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

export function getPool() {
  if (poolInstance) return poolInstance;

  poolInstance = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10_000),
  });

  poolInstance.on('error', (error) => {
    console.error('[postgres] idle client error', error);
  });

  return poolInstance;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!poolInstance) return;
  await poolInstance.end();
  poolInstance = null;
}
