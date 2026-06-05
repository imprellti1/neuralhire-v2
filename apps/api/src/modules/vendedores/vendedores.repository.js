import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ConflictError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryVendedores = [];
const memoryVendedorFabricantes = [];

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'vendedores' }); }
function normalizeText(value) { return String(value || '').trim(); }
function normalizeStatus(value) { return String(value || '').toLowerCase() === 'inativo' ? 'inativo' : 'ativo'; }
function normalizePagination(filters = {}) { const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1; const limit = Math.min(Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20, 100); return { page, limit }; }
function isSupabaseMode() { return isSupabaseConfigured(); }
function debugRepository(action, payload) { if (env.NODE_ENV !== 'production') console.debug(`[vendedores.repository] ${action}`, payload); }

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

export async function listVendedores(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); const { page, limit } = normalizePagination(filters); debugRepository('listVendedores', { accountId, filters });
  if (isSupabaseMode()) {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let q = supabase.from('vendedores').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.search) { const search = String(filters.search).trim(); if (search) q = q.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%`); }
    const from = (page - 1) * limit; const to = from + limit - 1;
    const { data, error, count } = await q.range(from, to); if (error) throw new DatabaseError('Falha ao listar vendedores', { details: error });
    return { items: await hydrateVendedoresWithFabricantes(data || [], options), total: count || 0, page, limit, totalPages: Math.max(1, Math.ceil((count || 0) / limit)) };
  }
  const items = memoryVendedores.filter((item) => item.account_id === accountId);
  const q = String(filters.search || '').trim().toLowerCase();
  const filtered = items.filter((item) => (!filters.status || item.status === filters.status) && (!q || [item.nome, item.email, item.telefone].some((v) => String(v || '').toLowerCase().includes(q))));
  const total = filtered.length; const from = (page - 1) * limit;
  return { items: await hydrateVendedoresWithFabricantes(filtered.slice(from, from + limit), options), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function getVendedorById(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (isSupabaseMode()) { const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel'); const { data, error } = await supabase.from('vendedores').select('*').eq('account_id', accountId).eq('id', id).maybeSingle(); if (error) throw new DatabaseError('Falha ao buscar vendedor', { details: error }); if (!data) throw new NotFoundError('Vendedor nao encontrado', { domain: 'vendedores', code: 'VENDEDOR_NOT_FOUND' }); const vinculos = await listVendedorFabricantes(id, { accountId }); return { ...data, fabricantes: vinculos.items || [] }; }
  const item = memoryVendedores.find((row) => row.id === id && row.account_id === accountId); if (!item) throw new NotFoundError('Vendedor nao encontrado', { domain: 'vendedores', code: 'VENDEDOR_NOT_FOUND' }); return { ...item, fabricantes: listMemoryFabricantes(accountId, id).map((row) => ({ ...row })) };
}

export async function createVendedor(data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const payload = { account_id: accountId, user_id: data.user_id || null, nome: normalizeText(data.nome), email: data.email || null, telefone: data.telefone || null, status: normalizeStatus(data.status), observacoes: data.observacoes || null };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'vendedores' });
  if (isSupabaseMode()) { const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel'); const { data: inserted, error } = await supabase.from('vendedores').insert(payload).select('*').single(); if (error) throw new DatabaseError('Falha ao criar vendedor', { details: error }); if (Array.isArray(data.fabricante_ids) && data.fabricante_ids.length) await replaceVendedorFabricantes(inserted.id, data.fabricante_ids, options); return inserted; }
  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; memoryVendedores.push(item); if (Array.isArray(data.fabricante_ids)) await replaceVendedorFabricantes(item.id, data.fabricante_ids, options); return item;
}

export async function updateVendedor(id, data, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const current = await getVendedorById(id, { accountId });
  const payload = { ...current, ...(data.nome !== undefined ? { nome: normalizeText(data.nome) } : {}), ...(data.email !== undefined ? { email: data.email || null } : {}), ...(data.telefone !== undefined ? { telefone: data.telefone || null } : {}), ...(data.status !== undefined ? { status: normalizeStatus(data.status) } : {}), ...(data.observacoes !== undefined ? { observacoes: data.observacoes || null } : {}), updated_at: new Date().toISOString() };
  if (!payload.nome) throw new BadRequestError('Nome obrigatorio', { domain: 'vendedores' });
  if (isSupabaseMode()) { const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel'); const { data: updated, error } = await supabase.from('vendedores').update(payload).eq('id', id).eq('account_id', accountId).select('*').single(); if (error) throw new DatabaseError('Falha ao atualizar vendedor', { details: error }); return updated; }
  const idx = memoryVendedores.findIndex((row) => row.id === id && row.account_id === accountId); if (idx < 0) throw new NotFoundError('Vendedor nao encontrado', { domain: 'vendedores', code: 'VENDEDOR_NOT_FOUND' }); memoryVendedores[idx] = payload; return payload;
}

export async function updateVendedorStatus(id, status, options = {}) { return updateVendedor(id, { status }, options); }

export async function listVendedorFabricantes(vendedorId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (isSupabaseMode()) { const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel'); const { data, error } = await supabase.from('vendedor_fabricantes').select('*, fabricantes(*)').eq('account_id', accountId).eq('vendedor_id', vendedorId).order('created_at', { ascending: false }); if (error) throw new DatabaseError('Falha ao listar vinculos', { details: error }); return { items: data || [], total: (data || []).length }; }
  return { items: memoryVendedorFabricantes.filter((item) => item.account_id === accountId && item.vendedor_id === vendedorId), total: memoryVendedorFabricantes.length };
}

export async function replaceVendedorFabricantes(vendedorId, fabricanteIds = [], options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const ids = [...new Set((Array.isArray(fabricanteIds) ? fabricanteIds : []).map((id) => String(id).trim()).filter(Boolean))];
  if (isSupabaseMode()) { const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel'); const { data: fabricanteRows, error: fabricanteError } = await supabase.from('fabricantes').select('id, account_id').eq('account_id', accountId).in('id', ids); if (fabricanteError) throw new DatabaseError('Falha ao validar fabricantes', { details: fabricanteError }); if ((fabricanteRows || []).length !== ids.length) throw new BadRequestError('Fabricante invalido para a conta', { domain: 'vendedores' }); const { error: deleteError } = await supabase.from('vendedor_fabricantes').delete().eq('account_id', accountId).eq('vendedor_id', vendedorId); if (deleteError) throw new DatabaseError('Falha ao atualizar vinculos', { details: deleteError }); if (ids.length) { const payload = ids.map((fabricante_id) => ({ account_id: accountId, vendedor_id: vendedorId, fabricante_id, status: 'ativo' })); const { error: insertError } = await supabase.from('vendedor_fabricantes').insert(payload); if (insertError) throw new DatabaseError('Falha ao criar vinculos', { details: insertError }); } return listVendedorFabricantes(vendedorId, options); }
  const existing = memoryVendedorFabricantes.filter((row) => row.account_id === accountId && row.vendedor_id === vendedorId); for (const item of existing) { const idx = memoryVendedorFabricantes.findIndex((row) => row.id === item.id); if (idx >= 0) memoryVendedorFabricantes.splice(idx, 1); }
  for (const fabricante_id of ids) memoryVendedorFabricantes.push({ id: randomUUID(), account_id: accountId, vendedor_id: vendedorId, fabricante_id, status: 'ativo', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  return listVendedorFabricantes(vendedorId, options);
}

export function findVendedorByUserId(accountId, userId) { return memoryVendedores.find((row) => row.account_id === accountId && row.user_id === userId) || null; }

export function __resetMemoryVendedoresForTests() { memoryVendedores.length = 0; memoryVendedorFabricantes.length = 0; }
export function __loadMemoryVendedores(items = []) { memoryVendedores.length = 0; memoryVendedorFabricantes.length = 0; for (const item of items) memoryVendedores.push({ ...item }); }
