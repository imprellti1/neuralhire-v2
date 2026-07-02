import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, NotFoundError } from '../../core/errors.js';
import { database } from '../../database/database.adapter.js';
import { IaMemoriasQueries } from '../../database/queries/ia-memorias.queries.js';

const validTipos = new Set(['regra_negocio', 'decisao_tecnica', 'ponto_retomada', 'bug_corrigido', 'arquitetura', 'roadmap', 'comercial', 'operacional', 'prompt', 'observacao']);
const validStatus = new Set(['ativa', 'arquivada']);

let databaseOverride = null;

function assertAccountId(accountId) {
  if (!accountId) throw new BadRequestError('accountId obrigatorio');
}

function resolveDatabase() {
  return databaseOverride || database;
}

function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) throw new BadRequestError('tags invalida');
  return tags.map((t) => t.trim()).filter(Boolean);
}

function normalizePayload(data = {}, partial = false) {
  const out = {};
  if (!partial || data.tipo !== undefined) {
    const v = String(data.tipo || '').trim();
    if (!v) throw new BadRequestError('tipo obrigatorio');
    if (!validTipos.has(v)) throw new BadRequestError('tipo invalido');
    out.tipo = v;
  }
  if (!partial || data.titulo !== undefined) {
    const v = String(data.titulo || '').trim();
    if (!v) throw new BadRequestError('titulo obrigatorio');
    out.titulo = v;
  }
  if (!partial || data.conteudo !== undefined) {
    const v = String(data.conteudo || '').trim();
    if (!v) throw new BadRequestError('conteudo obrigatorio');
    out.conteudo = v;
  }
  const tags = normalizeTags(data.tags);
  if (tags !== undefined) out.tags = tags;
  if (data.prioridade !== undefined) {
    const n = Number(data.prioridade);
    if (!Number.isFinite(n)) throw new BadRequestError('prioridade invalida');
    out.prioridade = n;
  }
  if (data.origem !== undefined) out.origem = String(data.origem || '').trim() || null;
  if (data.modulo !== undefined) out.modulo = String(data.modulo || '').trim() || null;
  if (data.status !== undefined) {
    const s = String(data.status || '').trim();
    if (!validStatus.has(s)) throw new BadRequestError('status invalido');
    out.status = s;
  }
  if (data.metadata !== undefined) out.metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  return out;
}

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  return { page, limit: Math.min(rawLimit, 100) };
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

  if (filters.tipo) pushClause('tipo = $X', filters.tipo);
  if (filters.modulo) pushClause('modulo = $X', filters.modulo);
  if (filters.tag) pushClause('$X = ANY(tags)', filters.tag);
  if (filters.status) pushClause('status = $X', filters.status);
  if (filters.search) {
    const q = String(filters.search).trim();
    if (q) {
      const like = `%${q}%`;
      clauses.push(`(titulo ILIKE $${idx} OR conteudo ILIKE $${idx} OR modulo ILIKE $${idx})`);
      params.push(like);
      idx += 1;
    }
  }

  return { whereSql: clauses.join(' AND '), params };
}

function rowFromInput(data, options = {}, id = randomUUID()) {
  const payload = normalizePayload(data);
  const timestamp = new Date().toISOString();
  return {
    id,
    account_id: options.accountId,
    tipo: payload.tipo,
    titulo: payload.titulo,
    conteudo: payload.conteudo,
    tags: payload.tags || [],
    prioridade: payload.prioridade ?? 0,
    origem: payload.origem || null,
    modulo: payload.modulo || null,
    status: payload.status || 'ativa',
    metadata: payload.metadata || {},
    created_at: timestamp,
    updated_at: timestamp
  };
}

export function __setIaMemoriasDatabaseForTests(adapter) {
  databaseOverride = adapter;
}

export function __resetIaMemoriasForTests() {
  databaseOverride = null;
}

export function getIaMemoriasRepositoryMode() {
  return { mode: 'database', supabaseConfigured: false };
}

export async function listIaMemorias(filters = {}, options = {}) {
  assertAccountId(options.accountId);
  const effective = { ...filters };
  if (!effective.status) effective.status = 'ativa';
  const { page, limit } = normalizePagination(effective);
  const db = resolveDatabase();
  try {
    const { whereSql, params } = buildWhere(effective, options.accountId);
    const countRow = await db.one(IaMemoriasQueries.countByWhere(whereSql), params);
    const offset = (page - 1) * limit;
    const items = await db.many(IaMemoriasQueries.listByWhere(whereSql, `$${params.length + 1}`, `$${params.length + 2}`), [...params, limit, offset]);
    const total = Number(countRow?.total || 0);
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  } catch (error) {
    throw error instanceof DatabaseError ? error : new DatabaseError('Falha ao listar memorias', { details: error });
  }
}

export async function searchIaMemorias(filters = {}, options = {}) {
  return listIaMemorias({ ...filters, search: filters.search || filters.q || '' }, options);
}

export async function getIaMemoriaById(id, options = {}) {
  assertAccountId(options.accountId);
  const db = resolveDatabase();
  try {
    const data = await db.one(IaMemoriasQueries.getById(), [options.accountId, id]);
    if (!data) throw new NotFoundError('Memoria nao encontrada');
    return data;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Memoria nao encontrada');
    throw error instanceof DatabaseError ? error : new DatabaseError('Falha ao buscar memoria', { details: error });
  }
}

export async function createIaMemoria(data = {}, options = {}) {
  assertAccountId(options.accountId);
  const row = rowFromInput(data, options);
  const db = resolveDatabase();
  try {
    return await db.one(IaMemoriasQueries.insert(), [
        row.id,
        row.account_id,
        row.tipo,
        row.titulo,
        row.conteudo,
        row.tags,
        row.prioridade,
        row.origem,
        row.modulo,
        row.status,
        row.metadata,
        row.created_at,
        row.updated_at
    ]);
  } catch (error) {
    throw error instanceof DatabaseError ? error : new DatabaseError('Falha ao criar memoria', { details: error });
  }
}

export async function updateIaMemoria(id, data = {}, options = {}) {
  assertAccountId(options.accountId);
  const payload = normalizePayload(data, true);
  const db = resolveDatabase();
  const sets = [];
  const params = [options.accountId, id];
  let idx = 3;

  const addSet = (column, value) => {
    sets.push(`${column} = $${idx}`);
    params.push(value);
    idx += 1;
  };

  if (payload.tipo !== undefined) addSet('tipo', payload.tipo);
  if (payload.titulo !== undefined) addSet('titulo', payload.titulo);
  if (payload.conteudo !== undefined) addSet('conteudo', payload.conteudo);
  if (payload.tags !== undefined) addSet('tags', payload.tags);
  if (payload.prioridade !== undefined) addSet('prioridade', payload.prioridade);
  if (payload.origem !== undefined) addSet('origem', payload.origem);
  if (payload.modulo !== undefined) addSet('modulo', payload.modulo);
  if (payload.status !== undefined) addSet('status', payload.status);
  if (payload.metadata !== undefined) addSet('metadata', payload.metadata);
  addSet('updated_at', new Date().toISOString());

  try {
    const updated = await db.one(IaMemoriasQueries.update(sets.join(', ')), params);
    if (!updated) throw new NotFoundError('Memoria nao encontrada');
    return updated;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    if (error?.code === 'DATABASE_NOT_ONE') throw new NotFoundError('Memoria nao encontrada');
    throw error instanceof DatabaseError ? error : new DatabaseError('Falha ao atualizar memoria', { details: error });
  }
}

export async function deleteIaMemoria(id, options = {}) {
  return updateIaMemoria(id, { status: 'arquivada' }, options);
}
