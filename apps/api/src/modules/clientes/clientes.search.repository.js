import { ForbiddenError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { ClientesSearchQueries } from '../../database/queries/clientes-search.queries.js';
import { createSqlBuilder } from '../../database/sql-builder.js';

const defaultLimit = 20;
const maxLimit = 100;

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
  }
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : defaultLimit;
  return { page, limit: Math.min(rawLimit, maxLimit) };
}

function normalizeSort(filters = {}) {
  const allowed = new Set(['created_at', 'nome', 'email', 'documento', 'telefone', 'cidade', 'codigo', 'ativo']);
  const orderBy = String(filters.orderBy || filters.sortBy || 'created_at').trim();
  const safeOrderBy = allowed.has(orderBy) ? orderBy : 'created_at';
  const orderDirection = String(filters.orderDirection || filters.sortDirection || 'DESC').trim().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return { orderBy: safeOrderBy, orderDirection };
}

function buildClienteSearchFilters(accountId, filters = {}) {
  const builder = createSqlBuilder();
  builder.appendEquals('account_id', accountId);

  if (filters.vendedor_id) {
    builder.appendEquals('vendedor_id', filters.vendedor_id);
  }

  if (typeof filters.ativo === 'boolean') {
    builder.appendCondition(`ativo = ${builder.nextParam(filters.ativo)}`);
  }

  const search = String(filters.search || filters.q || '').trim();
  if (search) {
    const like = `%${search}%`;
    const param = builder.nextParam(like);
    builder.appendCondition(`(
      nome ILIKE ${param}
      OR email ILIKE ${param}
      OR documento ILIKE ${param}
      OR telefone ILIKE ${param}
      OR cidade ILIKE ${param}
      OR codigo ILIKE ${param}
    )`);
  }

  return builder.toWhereClause();
}

export class ClientesSearchRepository extends BaseRepository {
  constructor(databaseAdapter) {
    super(databaseAdapter, { logContext: 'clientes-search' });
  }

  async list(filters = {}, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const { page, limit } = normalizePagination(filters);
    const { orderBy, orderDirection } = normalizeSort(filters);
    const where = buildClienteSearchFilters(accountId, filters);
    const offset = (page - 1) * limit;
    const orderSql = createSqlBuilder().appendOrder(orderBy, orderDirection).toSql().sql;
    const countRow = await this.one(ClientesSearchQueries.countByWhere(where.sql), where.params);
    const items = await this.many(
      ClientesSearchQueries.listByWhere(where.sql, orderSql, `$${where.params.length + 1}`, `$${where.params.length + 2}`),
      [...where.params, limit, offset]
    );
    const total = Number(countRow?.total || 0);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async search(filters = {}, options = {}) {
    return this.list(filters, options);
  }
}

export const clientesSearchRepository = new ClientesSearchRepository(database);
