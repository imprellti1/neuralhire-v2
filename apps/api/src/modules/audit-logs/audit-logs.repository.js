import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError, DatabaseError } from '../../core/errors.js';
import { database } from '../../database/database.adapter.js';

const memoryAuditLogs = [];
let databaseOverride = null;

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'system-audit' });
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  return { page, limit: Math.min(rawLimit, 100) };
}

function resolveDatabase() {
  return databaseOverride || database;
}

function buildWhere(filters = {}, accountId) {
  const clauses = ['account_id = $1'];
  const params = [accountId];
  let idx = 2;

  const pushClause = (sql, value) => {
    clauses.push(sql.replace('$X', `$${idx}`));
    params.push(value);
    idx += 1;
  };

  if (filters.modulo) pushClause(`modulo = $X`, filters.modulo);
  if (filters.entidade) pushClause(`entidade = $X`, filters.entidade);
  if (filters.entidade_id) pushClause(`entidade_id = $X`, filters.entidade_id);
  if (filters.acao) pushClause(`acao = $X`, filters.acao);
  if (filters.status) pushClause(`status = $X`, filters.status);
  if (filters.user_id) pushClause(`user_id = $X`, filters.user_id);
  if (filters.search) {
    const q = String(filters.search).trim();
    if (q) {
      const like = `%${q}%`;
      clauses.push(`(descricao ILIKE $${idx} OR user_email ILIKE $${idx} OR user_nome ILIKE $${idx} OR erro_mensagem ILIKE $${idx})`);
      params.push(like);
      idx += 1;
    }
  }
  if (filters.data_inicial) pushClause(`created_at >= $X`, filters.data_inicial);
  if (filters.data_final) pushClause(`created_at <= $X`, filters.data_final);

  return { whereSql: clauses.join(' AND '), params };
}

export function getAuditLogsRepositoryMode() {
  return { mode: 'database', supabaseConfigured: false };
}

export function __setAuditLogsDatabaseForTests(adapter) {
  databaseOverride = adapter;
}

export function __resetAuditLogsForTests() {
  memoryAuditLogs.length = 0;
  databaseOverride = null;
}

export async function listAuditLogs(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const { page, limit } = normalizePagination(filters);
  const db = resolveDatabase();
  if (!db) {
    const items = memoryAuditLogs.filter((row) => row.account_id === accountId);
    return { items, total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
  }

  const { whereSql, params } = buildWhere(filters, accountId);
  try {
    const countRow = await db.one(`SELECT COUNT(*)::int AS total FROM system_audit_logs WHERE ${whereSql}`, params);
    const offset = (page - 1) * limit;
    const items = await db.many(
      `SELECT * FROM system_audit_logs WHERE ${whereSql} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const total = Number(countRow?.total || 0);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED' && error?.code !== 'DATABASE_ERROR') throw error;
    const items = memoryAuditLogs
      .filter((row) => row.account_id === accountId)
      .filter((row) => !filters.modulo || row.modulo === filters.modulo)
      .filter((row) => !filters.entidade || row.entidade === filters.entidade)
      .filter((row) => !filters.entidade_id || row.entidade_id === filters.entidade_id)
      .filter((row) => !filters.acao || row.acao === filters.acao)
      .filter((row) => !filters.status || row.status === filters.status)
      .filter((row) => !filters.user_id || row.user_id === filters.user_id)
      .filter((row) => {
        const q = String(filters.search || '').trim();
        if (!q) return true;
        const haystack = [row.descricao, row.user_email, row.user_nome, row.erro_mensagem].filter(Boolean).join(' ');
        return haystack.toLowerCase().includes(q.toLowerCase());
      })
      .filter((row) => !filters.data_inicial || String(row.created_at || '') >= String(filters.data_inicial))
      .filter((row) => !filters.data_final || String(row.created_at || '') <= String(filters.data_final))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const offset = (page - 1) * limit;
    const paged = items.slice(offset, offset + limit);
    return { items: paged, total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) };
  }
}

export function __seedAuditLogForTests(payload = {}, options = {}) {
  const accountId = options.accountId || payload.account_id || null;
  const row = {
    id: randomUUID(),
    account_id: accountId,
    modulo: payload.modulo || 'system',
    entidade: payload.entidade || 'geral',
    entidade_id: payload.entidade_id || null,
    acao: payload.acao || 'info',
    descricao: payload.descricao || '',
    status: payload.status || 'success',
    user_id: payload.user_id || null,
    user_email: payload.user_email || null,
    user_nome: payload.user_nome || null,
    erro_codigo: payload.erro_codigo || null,
    erro_mensagem: payload.erro_mensagem || null,
    created_at: payload.created_at || new Date().toISOString()
  };
  memoryAuditLogs.push(row);
  return row;
}

export async function getAuditLogById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const db = resolveDatabase();
  if (!db) throw new NotFoundError('Log nao encontrado', { code: 'AUDIT_LOG_NOT_FOUND', domain: 'system-audit' });
  let data;
  try {
    const row = await db.query(
      'SELECT * FROM system_audit_logs WHERE account_id = $1 AND id = $2 LIMIT 1',
      [accountId, id]
    );
    data = Array.isArray(row) ? row[0] : row;
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED' && error?.code !== 'DATABASE_ERROR') throw error;
    data = memoryAuditLogs.find((item) => item.account_id === accountId && item.id === id) || null;
  }
  if (!data) throw new NotFoundError('Log nao encontrado', { code: 'AUDIT_LOG_NOT_FOUND', domain: 'system-audit' });
  return data;
}

export async function createAuditLog(row = {}, options = {}) {
  const accountId = options.accountId || row.account_id || null;
  assertAccountId(accountId);
  const db = resolveDatabase();
  if (!db) throw new DatabaseError('Falha ao registrar log de auditoria', { domain: 'system-audit' });
  const payload = {
    id: row.id || randomUUID(),
    account_id: accountId,
    modulo: row.modulo || 'system',
    entidade: row.entidade || 'geral',
    entidade_id: row.entidade_id || null,
    acao: row.acao || 'info',
    descricao: row.descricao || '',
    status: row.status || 'success',
    user_id: row.user_id || null,
    user_email: row.user_email || null,
    user_nome: row.user_nome || null,
    erro_codigo: row.erro_codigo || null,
    erro_mensagem: row.erro_mensagem || null,
    created_at: row.created_at || new Date().toISOString()
  };
  try {
    const inserted = await db.one(
      `INSERT INTO system_audit_logs (
      id, account_id, modulo, entidade, entidade_id, acao, descricao, status,
      user_id, user_email, user_nome, erro_codigo, erro_mensagem, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14
    ) RETURNING *`,
    [
      payload.id,
      payload.account_id,
      payload.modulo,
      payload.entidade,
      payload.entidade_id,
      payload.acao,
      payload.descricao,
      payload.status,
      payload.user_id,
      payload.user_email,
      payload.user_nome,
      payload.erro_codigo,
      payload.erro_mensagem,
      payload.created_at
      ]
    );
    return inserted;
  } catch (error) {
    if (error?.code !== 'ECONNREFUSED' && error?.code !== 'DATABASE_ERROR') throw error;
    memoryAuditLogs.push(payload);
    return payload;
  }
}
