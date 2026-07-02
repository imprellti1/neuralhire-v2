import { getPostgresPool } from './postgres.driver.js';

export function getDatabasePool() {
  return getPostgresPool(process.env.DATABASE_URL || '', {
    connectionTimeoutMillis: process.env.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: process.env.DATABASE_IDLE_TIMEOUT_MS,
    max: process.env.DATABASE_POOL_MAX
  });
}
