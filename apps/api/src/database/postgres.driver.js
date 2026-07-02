import { Pool } from 'pg';

let poolSingleton = null;

function toInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createPostgresPool(connectionString, options = {}) {
  return new Pool({
    connectionString,
    max: toInteger(options.max, 10),
    idleTimeoutMillis: toInteger(options.idleTimeoutMillis, 30000),
    connectionTimeoutMillis: toInteger(options.connectionTimeoutMillis, 10000)
  });
}

export function getPostgresPool(connectionString, options = {}) {
  if (poolSingleton) return poolSingleton;
  poolSingleton = createPostgresPool(connectionString, options);
  return poolSingleton;
}

export async function closePostgresPool() {
  if (!poolSingleton) return;
  const current = poolSingleton;
  poolSingleton = null;
  await current.end();
}

