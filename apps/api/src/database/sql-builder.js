import { DatabaseError } from './database.errors.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeDirection(direction) {
  const normalized = String(direction || 'ASC').trim().toUpperCase();
  return normalized === 'DESC' ? 'DESC' : 'ASC';
}

function normalizeColumn(column) {
  if (!isNonEmptyString(column)) {
    throw new DatabaseError('Coluna SQL obrigatoria', { code: 'DATABASE_INVALID_COLUMN' });
  }
  const normalized = column.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(normalized)) {
    throw new DatabaseError('Coluna SQL invalida', { code: 'DATABASE_INVALID_COLUMN' });
  }
  return normalized;
}

export class SqlBuilder {
  constructor() {
    this.clauses = [];
    this.params = [];
  }

  nextParam(value) {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  appendCondition(condition) {
    if (!isNonEmptyString(condition)) {
      throw new DatabaseError('Condicao SQL obrigatoria', { code: 'DATABASE_INVALID_CONDITION' });
    }
    this.clauses.push(condition.trim().replace(/\s+/g, ' '));
    return this;
  }

  appendEquals(column, value) {
    return this.appendCondition(`${normalizeColumn(column)} = ${this.nextParam(value)}`);
  }

  appendLike(column, value) {
    return this.appendCondition(`${normalizeColumn(column)} ILIKE ${this.nextParam(value)}`);
  }

  appendIn(column, values) {
    if (!Array.isArray(values) || values.length === 0) {
      throw new DatabaseError('Lista IN obrigatoria', { code: 'DATABASE_INVALID_IN_LIST' });
    }
    const placeholders = values.map((value) => this.nextParam(value)).join(', ');
    return this.appendCondition(`${normalizeColumn(column)} IN (${placeholders})`);
  }

  appendIsNull(column) {
    return this.appendCondition(`${normalizeColumn(column)} IS NULL`);
  }

  appendPagination(limit, offset) {
    if (limit !== undefined && limit !== null) {
      if (!Number.isInteger(limit) || limit < 0) {
        throw new DatabaseError('Limit invalido', { code: 'DATABASE_INVALID_LIMIT' });
      }
      this.appendCondition(`LIMIT ${this.nextParam(limit)}`);
    }
    if (offset !== undefined && offset !== null) {
      if (!Number.isInteger(offset) || offset < 0) {
        throw new DatabaseError('Offset invalido', { code: 'DATABASE_INVALID_OFFSET' });
      }
      this.appendCondition(`OFFSET ${this.nextParam(offset)}`);
    }
    return this;
  }

  appendOrder(column, direction) {
    return this.appendCondition(`ORDER BY ${normalizeColumn(column)} ${normalizeDirection(direction)}`);
  }

  toWhereClause() {
    if (!this.clauses.length) return { sql: '', params: [] };
    return { sql: `WHERE ${this.clauses.join(' AND ')}`, params: [...this.params] };
  }

  toSql() {
    if (!this.clauses.length) return { sql: '', params: [] };
    return { sql: this.clauses.join(' AND '), params: [...this.params] };
  }
}

export function createSqlBuilder() {
  return new SqlBuilder();
}

export function buildWhere(appendFn) {
  const builder = createSqlBuilder();
  if (typeof appendFn === 'function') appendFn(builder);
  return builder.toWhereClause();
}

export function buildLimitOffset(limit, offset) {
  const builder = createSqlBuilder();
  builder.appendPagination(limit, offset);
  return builder.toSql();
}

export function buildOrderBy(column, direction) {
  return { sql: `ORDER BY ${normalizeColumn(column)} ${normalizeDirection(direction)}`, params: [] };
}
