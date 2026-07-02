import { logger } from '../core/logger.js';
import { DatabaseError } from './database.errors.js';
import { buildLimitOffset, buildOrderBy, createSqlBuilder } from './sql-builder.js';

function maskSql(sql) {
  return String(sql || '').trim().replace(/\s+/g, ' ').slice(0, 500);
}

function normalizeError(error, sql) {
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

function validateSql(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new DatabaseError('SQL obrigatorio', { code: 'DATABASE_INVALID_SQL' });
  }
}

function validateParams(params) {
  if (params === undefined) return [];
  if (!Array.isArray(params)) {
    throw new DatabaseError('SQL params devem ser um array', { code: 'DATABASE_INVALID_PARAMS' });
  }
  return params;
}

function normalizeIdentifier(value, code, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DatabaseError(message, { code });
  }
  const normalized = value.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(normalized)) {
    throw new DatabaseError(message, { code });
  }
  return normalized;
}

export class BaseRepository {
  constructor(databaseAdapter, options = {}) {
    if (!databaseAdapter) {
      throw new DatabaseError('Database adapter obrigatorio', { code: 'DATABASE_ADAPTER_REQUIRED' });
    }
    this.database = databaseAdapter;
    this.logContext = options.logContext || 'database_repository';
  }

  async query(sql, params = []) {
    validateSql(sql);
    const safeParams = validateParams(params);
    const startedAt = Date.now();
    try {
      const result = await this.database.query(sql, safeParams);
      logger.info('database_repository_query', { domain: this.logContext, durationMs: Date.now() - startedAt, sql: maskSql(sql) });
      return result;
    } catch (error) {
      logger.error('database_repository_query_failed', { domain: this.logContext, durationMs: Date.now() - startedAt, sql: maskSql(sql), code: error?.code || null });
      throw normalizeError(error, sql);
    }
  }

  async one(sql, params = []) {
    const rows = await this.query(sql, params);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new DatabaseError(`Expected exactly one row, received ${Array.isArray(rows) ? rows.length : 0}`, { code: 'DATABASE_NOT_ONE' });
    }
    return rows[0];
  }

  async many(sql, params = []) {
    return this.query(sql, params);
  }

  async execute(sql, params = []) {
    validateSql(sql);
    const safeParams = validateParams(params);
    const startedAt = Date.now();
    try {
      const result = await this.database.execute(sql, safeParams);
      logger.info('database_repository_execute', { domain: this.logContext, durationMs: Date.now() - startedAt, sql: maskSql(sql) });
      return result;
    } catch (error) {
      logger.error('database_repository_execute_failed', { domain: this.logContext, durationMs: Date.now() - startedAt, sql: maskSql(sql), code: error?.code || null });
      throw normalizeError(error, sql);
    }
  }

  async transaction(callback) {
    if (typeof callback !== 'function') {
      throw new DatabaseError('Callback de transacao obrigatorio', { code: 'DATABASE_INVALID_TRANSACTION_CALLBACK' });
    }
    try {
      return await this.database.transaction(async (tx) => {
        const scoped = {
          query: (sql, params = []) => this.queryWithClient(tx, sql, params),
          one: (sql, params = []) => this.oneWithClient(tx, sql, params),
          many: (sql, params = []) => this.manyWithClient(tx, sql, params),
          execute: (sql, params = []) => this.executeWithClient(tx, sql, params)
        };
        return callback(scoped);
      });
    } catch (error) {
      throw normalizeError(error);
    }
  }

  async queryWithClient(client, sql, params = []) {
    validateSql(sql);
    const safeParams = validateParams(params);
    try {
      return await client.query(sql, safeParams);
    } catch (error) {
      throw normalizeError(error, sql);
    }
  }

  async oneWithClient(client, sql, params = []) {
    const rows = await this.queryWithClient(client, sql, params);
    if (!Array.isArray(rows) || rows.length !== 1) {
      throw new DatabaseError(`Expected exactly one row, received ${Array.isArray(rows) ? rows.length : 0}`, { code: 'DATABASE_NOT_ONE' });
    }
    return rows[0];
  }

  async manyWithClient(client, sql, params = []) {
    return this.queryWithClient(client, sql, params);
  }

  async executeWithClient(client, sql, params = []) {
    const rows = await this.queryWithClient(client, sql, params);
    return { rowCount: Array.isArray(rows) ? rows.length : 0, rows: Array.isArray(rows) ? rows : [] };
  }

  buildLimitOffset(limit, offset) {
    return buildLimitOffset(limit, offset);
  }

  buildOrderBy(column, direction) {
    return buildOrderBy(column, direction);
  }

  appendWhere() {
    return createSqlBuilder();
  }

  appendFilters() {
    return createSqlBuilder();
  }

  appendPagination(limit, offset) {
    return buildLimitOffset(limit, offset);
  }

  async count(sql, params = []) {
    const row = await this.one(sql, params);
    return Number(row?.count || row?.total || 0);
  }

  async exists(sql, params = []) {
    const row = await this.one(sql, params);
    return Boolean(row?.exists ?? row?.present ?? row?.found ?? row?.count ?? row?.total);
  }

  async findById(table, idColumn, id, options = {}) {
    if (typeof table !== 'string' || !table.trim()) {
      throw new DatabaseError('Tabela obrigatoria', { code: 'DATABASE_INVALID_TABLE' });
    }
    const safeTable = normalizeIdentifier(table, 'DATABASE_INVALID_TABLE', 'Tabela obrigatoria');
    const safeIdColumn = normalizeIdentifier(idColumn, 'DATABASE_INVALID_ID_COLUMN', 'Coluna de id obrigatoria');
    const deletedColumn = options.deletedColumn || null;
    const where = [`${safeIdColumn} = $1`];
    const params = [id];
    if (deletedColumn) where.push(`${normalizeIdentifier(deletedColumn, 'DATABASE_INVALID_COLUMN', 'Coluna SQL invalida')} IS NULL`);
    return this.one(`SELECT * FROM ${safeTable} WHERE ${where.join(' AND ')}`, params);
  }

  async softDelete(table, idColumn, id, options = {}) {
    if (typeof table !== 'string' || !table.trim()) {
      throw new DatabaseError('Tabela obrigatoria', { code: 'DATABASE_INVALID_TABLE' });
    }
    const safeTable = normalizeIdentifier(table, 'DATABASE_INVALID_TABLE', 'Tabela obrigatoria');
    const safeIdColumn = normalizeIdentifier(idColumn, 'DATABASE_INVALID_ID_COLUMN', 'Coluna de id obrigatoria');
    const deletedColumn = normalizeIdentifier(options.deletedColumn || 'deleted_at', 'DATABASE_INVALID_COLUMN', 'Coluna SQL invalida');
    return this.execute(`UPDATE ${safeTable} SET ${deletedColumn} = NOW() WHERE ${safeIdColumn} = $1`, [id]);
  }
}
