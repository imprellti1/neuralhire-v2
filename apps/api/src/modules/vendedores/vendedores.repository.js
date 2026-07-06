import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { VendedoresQueries } from '../../database/queries/vendedores.queries.js';

const memoryVendedores = [];
const memoryVendedorFabricantes = [];
let databaseModeCache = null;

class VendedoresRepository extends BaseRepository {
  constructor(adapter = database) {
    super(adapter, { logContext: 'vendedores' });
  }
}

const repository = new VendedoresRepository();

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'vendedores' }); }
function normalizeText(value) { return String(value || '').trim(); }
function normalizeStatus(value) { return String(value || '').toLowerCase() === 'inativo' ? 'inativo' : 'ativo'; }
function normalizePagination(filters = {}) { const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1; const limit = Math.min(Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20, 100); return { page, limit }; }
function debugRepository(action, payload) { if (env.NODE_ENV !== 'production') console.debug(`[vendedores.repository] ${action}`, payload); }
async function isDatabaseMode() {
  if (databaseModeCache !== null) return databaseModeCache;
  try {
    await repository.one(VendedoresQueries.ping(), []);
    databaseModeCache = true;
  } catch (error) {
    databaseModeCache = false;
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') {
      debugRepository('databaseModeProbeFailed', { message: error?.message || null, code: error?.code || null });
    }
  }
  return databaseModeCache;
}

function listMemoryFabricantes(accountId, vendedorId) {
  return memoryVendedorFabricantes.filter((item) => item.account_id === accountId && item.vendedor_id === vendedorId);
}

async function hydrateVendedoresWithFabricantes(items = [], options = {}) {
  const hydrated = [];
  for (const item of items) {
    const vinculos = await listVendedorFabricantes(item.id, options);
    hydrated.push({ ...item, fabricantes: vinculos.items || [] });
  }
  return hydrated;
}

function whereSqlFromFilters(filters = {}) {
  const clauses = [];
  if (filters.status) clauses.push(`status = '${String(filters.status).replace(/'/g, "''")}'`);
  if (filters.search) {
    const search = String(filters.search).trim().replace(/'/g, "''");
    if (search) clauses.push(`(nome ILIKE '%${search}%' OR email ILIKE '%${search}%' OR telefone ILIKE '%${search}%')`);
  }
  return clauses.join(' AND ');
}

async function loadVendedorRows(accountId, filters = {}, options = {}) {
  const { page, limit } = normalizePagination(filters);
  const whereSql = whereSqlFromFilters(filters);
  const from = (page - 1) * limit;
  const totalRow = await repository.one(VendedoresQueries.count(whereSql ? `account_id = $1 AND ${whereSql}` : 'account_id = $1'), [accountId]).catch((error) => {
    if (error?.code === 'DATABASE_NOT_ONE') return { total: 0 };
    throw error;
  });
  const items = await repository.many(VendedoresQueries.list(whereSql), [accountId, limit, from]);
  return { items: await hydrateVendedoresWithFabricantes(items || [], options), total: Number(totalRow?.total || 0), page, limit, totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)) };
}

async function getVendedorRowById(id, accountId) {
  try {
    return await repository.one(VendedoresQueries.getById(), [accountId, id]);
  } catch (error) {
    if (error?.code === 'DATABASE_NOT_ONE') return null;
    throw error;
  }
}

export async function listVendedores(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); debugRepository('listVendedores', { accountId, filters });
  if (await isDatabaseMode()) return loadVendedorRows(accountId, filters, options);
  const { page, limit } = normalizePagination(filters);
  const items = memoryVendedores.filter((item) => item.account_id === accountId);
  const q = String(filters.search || '').trim().toLowerCase();
  const filtered = items.filter((item) => (!filters.status || item.status === filters.status) && (!q || [item.nome, item.email, item.telefone].some((v) => String(v || '').toLowerCase().includes(q))));
  const total = filtered.length; const from = (page - 1) * limit;
  return { items: await hydrateVendedoresWithFabricantes(filtered.slice(from, from + limit), options), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getVendedorById(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (await isDatabaseMode()) {
    const data = await getVendedorRowById(id, accountId);
    if (!data) throw new NotFoundError('Vendedor nao encontrado', { domain: 'vendedores', code: 'VENDEDOR_NOT_FOUND' });
    const vinculos = await listVendedorFabricantes(id, { accountId });
    return { ...data, fabricantes: vinculos.items || [] };
  }
  const item = memoryVendedores.find((row) => row.id === id && row.account_id === accountId); if (!item) throw new NotFoundError('Vendedor nao encontrado', { domain: 'vendedores', code: 'VENDEDOR_NOT_FOUND' }); return { ...item, fabricantes: listMemoryFabricantes(accountId, id).map((row) => ({ ...row })) };
}

export async function findVendedorById(id, options = {}) {
  const accountId = options.accountId || null;
  if (!accountId) return null;
  if (await isDatabaseMode()) return getVendedorRowById(id, accountId);
  return memoryVendedores.find((row) => row.id === id && row.account_id === accountId) || null;
}

export async function findVendedorByIdAnyAccount(id, options = {}) {
  const accountId = options.accountId || null;
  if (!accountId) return null;
  if (await isDatabaseMode()) {
    try {
      return await repository.one(VendedoresQueries.findByIdAnyAccount(), [id]);
    } catch (error) {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw error;
    }
  }
  return memoryVendedores.find((row) => row.id === id) || null;
}

export async function createVendedor(data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const payload = { account_id: accountId, user_id: data.user_id || null, nome: normalizeText(data.nome), email: data.email || null, telefone: data.telefone || null, status: normalizeStatus(data.status), observacoes: data.observacoes || null };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'vendedores' });
  if (await isDatabaseMode()) {
    const timestamp = new Date().toISOString();
    const inserted = await repository.one(VendedoresQueries.insert(), [randomUUID(), accountId, payload.user_id, payload.nome, payload.email, payload.telefone, payload.status, payload.observacoes, timestamp, timestamp]);
    if (Array.isArray(data.fabricante_ids) && data.fabricante_ids.length) await replaceVendedorFabricantes(inserted.id, data.fabricante_ids, options);
    return inserted;
  }
  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; memoryVendedores.push(item); if (Array.isArray(data.fabricante_ids)) await replaceVendedorFabricantes(item.id, data.fabricante_ids, options); return item;
}

export async function updateVendedor(id, data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const current = await getVendedorById(id, { accountId });
  const payload = { ...current, ...(data.nome !== undefined ? { nome: normalizeText(data.nome) } : {}), ...(data.email !== undefined ? { email: data.email || null } : {}), ...(data.telefone !== undefined ? { telefone: data.telefone || null } : {}), ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}), ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}), updated_at: new Date().toISOString() };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'vendedores' });
  if (await isDatabaseMode()) {
    const updated = await repository.one(VendedoresQueries.update(), [accountId, id, payload.user_id || null, payload.nome, payload.email, payload.telefone, payload.status, payload.observacoes, payload.updated_at]);
    return updated;
  }
  const idx = memoryVendedores.findIndex((row) => row.id === id && row.account_id === accountId); if (idx < 0) throw new NotFoundError('Vendedor nao encontrado', { domain: 'vendedores', code: 'VENDEDOR_NOT_FOUND' }); memoryVendedores[idx] = payload; return payload;
}

export async function updateVendedorStatus(id, status, options = {}) { return updateVendedor(id, { status }, options); }

export async function listVendedorFabricantes(vendedorId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (await isDatabaseMode()) {
    const rows = await repository.many(VendedoresQueries.listFabricantesByVendedor(), [accountId, vendedorId]);
    return { items: (rows || []).map((row) => ({ ...row, fabricantes: row.fabricantes || null })), total: (rows || []).length };
  }
  return { items: memoryVendedorFabricantes.filter((item) => item.account_id === accountId && item.vendedor_id === vendedorId), total: memoryVendedorFabricantes.length };
}

export async function replaceVendedorFabricantes(vendedorId, fabricanteIds = [], options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const ids = [...new Set((Array.isArray(fabricanteIds) ? fabricanteIds : []).map((id) => String(id).trim()).filter(Boolean))];
  if (await isDatabaseMode()) {
    const fabricanteRows = ids.length ? await repository.many(VendedoresQueries.listFabricantesByIds(), [accountId, ids]) : [];
    if ((fabricanteRows || []).length !== ids.length) throw new BadRequestError('Fabricante invalido para a conta', { domain: 'vendedores' });
    await repository.execute(VendedoresQueries.deleteFabricantesByVendedor(), [accountId, vendedorId]);
    if (ids.length) {
      const timestamp = new Date().toISOString();
      for (const fabricante_id of ids) {
        await repository.one(VendedoresQueries.insertFabricanteVinculos(), [randomUUID(), accountId, vendedorId, fabricante_id, 'ativo', timestamp, timestamp]);
      }
    }
    return listVendedorFabricantes(vendedorId, options);
  }
  const existing = memoryVendedorFabricantes.filter((row) => row.account_id === accountId && row.vendedor_id === vendedorId); for (const item of existing) { const idx = memoryVendedorFabricantes.findIndex((row) => row.id === item.id); if (idx >= 0) memoryVendedorFabricantes.splice(idx, 1); }
  for (const fabricante_id of ids) memoryVendedorFabricantes.push({ id: randomUUID(), account_id: accountId, vendedor_id: vendedorId, fabricante_id, status: 'ativo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return listVendedorFabricantes(vendedorId, options);
}

export function findVendedorByUserId(accountId, userId) { return memoryVendedores.find((row) => row.account_id === accountId && row.user_id === userId) || null; }

export function __resetMemoryVendedoresForTests() { memoryVendedores.length = 0; memoryVendedorFabricantes.length = 0; }
export function __loadMemoryVendedores(items = []) { memoryVendedores.length = 0; memoryVendedorFabricantes.length = 0; for (const item of items) memoryVendedores.push({ ...item }); }
