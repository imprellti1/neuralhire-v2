import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { createSqlBuilder } from '../../database/sql-builder.js';
import { buildCustomerMemory } from './customer-memory.builder.js';

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'customer-memory' });
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  return { page, limit: Math.min(rawLimit, 100) };
}

function normalizeSort(filters = {}) {
  const orderBy = String(filters.orderBy || filters.sortBy || 'last_rebuilt_at').trim();
  const orderDirection = String(filters.orderDirection || filters.sortDirection || 'DESC').trim().toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return { orderBy, orderDirection };
}

function resolveRiskScore(memory) {
  return memory?.behavior?.risco === 'alto' ? 85 : memory?.behavior?.risco === 'medio' ? 55 : 20;
}

function resolvePotentialScore(memory) {
  return memory?.behavior?.potencial === 'alto' ? 80 : memory?.behavior?.potencial === 'medio' ? 55 : 25;
}

function rowFromMemory(accountId, clienteId, memory) {
  const timestamp = new Date().toISOString();
  return {
    id: randomUUID(),
    account_id: accountId,
    cliente_id: clienteId,
    memory,
    risk_score: resolveRiskScore(memory),
    potential_score: resolvePotentialScore(memory),
    last_rebuilt_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp
  };
}

function buildMemoryFilters(filters = {}) {
  const builder = createSqlBuilder();
  if (filters.clienteId) builder.appendEquals('cliente_id', filters.clienteId);
  if (filters.clienteIds) builder.appendIn('cliente_id', Array.isArray(filters.clienteIds) ? filters.clienteIds : [filters.clienteIds]);
  if (filters.search) builder.appendCondition(`memory::text ILIKE ${builder.nextParam(`%${String(filters.search).trim()}%`)}`);
  if (filters.minRiskScore !== undefined && filters.minRiskScore !== null) builder.appendCondition(`risk_score >= ${builder.nextParam(Number(filters.minRiskScore))}`);
  if (filters.maxRiskScore !== undefined && filters.maxRiskScore !== null) builder.appendCondition(`risk_score <= ${builder.nextParam(Number(filters.maxRiskScore))}`);
  if (filters.minPotentialScore !== undefined && filters.minPotentialScore !== null) builder.appendCondition(`potential_score >= ${builder.nextParam(Number(filters.minPotentialScore))}`);
  if (filters.maxPotentialScore !== undefined && filters.maxPotentialScore !== null) builder.appendCondition(`potential_score <= ${builder.nextParam(Number(filters.maxPotentialScore))}`);
  return builder;
}

class CustomerMemoryRepository extends BaseRepository {
  constructor(databaseAdapter) {
    super(databaseAdapter, { logContext: 'customer-memory' });
  }

  async saveMemory(accountId, clienteId, memory) {
    assertAccountId(accountId);
    const payload = rowFromMemory(accountId, clienteId, memory);
    return this.transaction(async (tx) => {
      const existing = await tx.one(
        'SELECT * FROM customer_memories WHERE account_id = $1 AND cliente_id = $2 LIMIT 1',
        [accountId, clienteId]
      ).catch((error) => {
        if (error?.code === 'DATABASE_NOT_ONE') return null;
        throw error;
      });
      if (!existing) {
        return tx.one(
          `INSERT INTO customer_memories (
            id, account_id, cliente_id, memory, risk_score, potential_score, last_rebuilt_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            payload.id,
            payload.account_id,
            payload.cliente_id,
            payload.memory,
            payload.risk_score,
            payload.potential_score,
            payload.last_rebuilt_at,
            payload.created_at,
            payload.updated_at
          ]
        );
      }
      return tx.one(
        `UPDATE customer_memories
         SET memory = $3, risk_score = $4, potential_score = $5, last_rebuilt_at = $6, updated_at = $7
         WHERE account_id = $1 AND cliente_id = $2
         RETURNING *`,
        [
          accountId,
          clienteId,
          payload.memory,
          payload.risk_score,
          payload.potential_score,
          payload.last_rebuilt_at,
          payload.updated_at
        ]
      );
    });
  }

  async getPersistedCustomerMemory(clienteId, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    try {
      return await this.one(
        'SELECT * FROM customer_memories WHERE account_id = $1 AND cliente_id = $2 LIMIT 1',
        [accountId, clienteId]
      );
    } catch (error) {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      if (error?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNREFUSED') return null;
      throw new DatabaseError('Falha ao ler memoria do cliente', { details: error });
    }
  }

  async listPersistedCustomerMemories(filters = {}, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    const { page, limit } = normalizePagination(filters);
    const { orderBy, orderDirection } = normalizeSort(filters);
    const builder = buildMemoryFilters(filters);
    builder.appendEquals('account_id', accountId);
    const where = builder.toWhereClause();
    const offset = (page - 1) * limit;
    const orderSql = createSqlBuilder().appendOrder(orderBy, orderDirection).toSql().sql;
    const countRow = await this.one(`SELECT COUNT(*)::int AS total FROM customer_memories ${where.sql}`, where.params);
    const items = await this.many(
      `SELECT * FROM customer_memories ${where.sql} ${orderSql} LIMIT $${where.params.length + 1} OFFSET $${where.params.length + 2}`,
      [...where.params, limit, offset]
    );
    const total = Number(countRow?.total || 0);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async deletePersistedCustomerMemory(clienteId, options = {}) {
    const accountId = options.accountId || null;
    assertAccountId(accountId);
    try {
      return await this.one(
        'DELETE FROM customer_memories WHERE account_id = $1 AND cliente_id = $2 RETURNING *',
        [accountId, clienteId]
      );
    } catch (error) {
      if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Memoria nao encontrada', { code: 'CUSTOMER_MEMORY_NOT_FOUND', domain: 'customer-memory' });
      throw new DatabaseError('Falha ao remover memoria do cliente', { details: error });
    }
  }
}

const repository = new CustomerMemoryRepository(database);
let repositoryOverride = null;

function resolveRepository() {
  return repositoryOverride || repository;
}

export function __setCustomerMemoryDatabaseForTests(adapter) {
  repositoryOverride = adapter instanceof CustomerMemoryRepository ? adapter : new CustomerMemoryRepository(adapter);
}

export function __resetMemoryCustomerMemoryForTests() {
  repositoryOverride = null;
}

export function getCustomerMemoryRepositoryMode() {
  return { mode: 'database', supabaseConfigured: false };
}

export async function getPersistedCustomerMemory(clienteId, options = {}) {
  return resolveRepository().getPersistedCustomerMemory(clienteId, options);
}

export async function getCustomerMemory(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const persisted = await getPersistedCustomerMemory(clienteId, { accountId, context: options.context });
  if (persisted?.memory) return persisted.memory;
  const memory = await buildCustomerMemory(clienteId, { accountId, context: options.context });
  try {
    await resolveRepository().saveMemory(accountId, clienteId, memory);
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') throw error;
  }
  return memory;
}

export async function getCustomerMemorySummary(clienteId, options = {}) {
  const memory = await getCustomerMemory(clienteId, options);
  return {
    clienteId: memory.clienteId,
    summary: memory.summary,
    risk: memory.behavior.risco,
    potential: memory.behavior.potencial,
    diasSemCompra: memory.commercial.diasSemCompra,
    opportunities: memory.opportunities.slice(0, 3),
    alerts: memory.alerts.slice(0, 3)
  };
}

export async function rebuildCustomerMemory(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const memory = await buildCustomerMemory(clienteId, { accountId, context: options.context });
  try {
    await resolveRepository().saveMemory(accountId, clienteId, memory);
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') throw error;
  }
  return memory;
}

export async function listCustomerMemories(filters = {}, options = {}) {
  return resolveRepository().listPersistedCustomerMemories(filters, options);
}

export async function deleteCustomerMemory(clienteId, options = {}) {
  return resolveRepository().deletePersistedCustomerMemory(clienteId, options);
}

export function __createCustomerMemoryRepositoryForTests(adapter) {
  return new CustomerMemoryRepository(adapter);
}
