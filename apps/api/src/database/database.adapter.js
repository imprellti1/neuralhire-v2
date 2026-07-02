import { logger } from '../core/logger.js';
import { DatabaseError } from './database.errors.js';
import { getDatabasePool } from './database.pool.js';
import { runTransaction } from './database.transaction.js';

function maskSql(sql) {
  return String(sql || '').trim().replace(/\s+/g, ' ').slice(0, 500);
}

function normalizePgError(error, sql) {
  if (error instanceof DatabaseError) return error;
  return new DatabaseError(error?.message || 'Database error', {
    code: error?.code || 'DATABASE_ERROR',
    sqlstate: error?.code || null,
    details: error?.detail || error?.details || null,
    hint: error?.hint || null,
    cause: error,
    sql: sql ? maskSql(sql) : null
  });
}

async function executeQuery(client, sql, params = []) {
  const startedAt = Date.now();
  try {
    const result = await client.query(sql, params);
    const durationMs = Date.now() - startedAt;
    const rowCount = Number.isInteger(result?.rowCount) ? result.rowCount : (Array.isArray(result?.rows) ? result.rows.length : 0);
    logger.info('database_query', {
      domain: 'database',
      durationMs,
      rowCount,
      sql: maskSql(sql)
    });
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.error('database_query_failed', {
      domain: 'database',
      durationMs,
      sql: maskSql(sql),
      code: error?.code || null
    });
    throw normalizePgError(error, sql);
  }
}

function createTransactionClient(client) {
  return {
    async query(sql, params = []) {
      const result = await executeQuery(client, sql, params);
      return result.rows || [];
    }
  };
}

function resolvePool(poolOrFactory) {
  return typeof poolOrFactory === 'function' ? poolOrFactory() : poolOrFactory;
}

export function createDatabaseAdapter(poolOrFactory = getDatabasePool) {
  let poolInstance = null;
  function getPool() {
    if (!poolInstance) {
      poolInstance = resolvePool(poolOrFactory);
    }
    return poolInstance;
  }
  async function query(sql, params = []) {
    const result = await executeQuery(getPool(), sql, params);
    return result.rows || [];
  }

  return {
    query,
    async one(sql, params = []) {
      const rows = await query(sql, params);
      if (rows.length !== 1) {
        throw new DatabaseError(`Expected exactly one row, received ${rows.length}`, { code: 'DATABASE_NOT_ONE' });
      }
      return rows[0];
    },
    async many(sql, params = []) {
      return query(sql, params);
    },
    async execute(sql, params = []) {
      const result = await executeQuery(getPool(), sql, params);
      return {
        rowCount: result.rowCount || 0,
        rows: result.rows || []
      };
    },
    async transaction(callback) {
      return runTransaction(getPool(), callback, {
        createTransactionClient,
        normalizeError: normalizePgError
      });
    }
  };
}

export const database = createDatabaseAdapter();
export { DatabaseError } from './database.errors.js';
