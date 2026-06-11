import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryIaMemorias = [];
const validTipos = new Set(['regra_negocio','decisao_tecnica','ponto_retomada','bug_corrigido','arquitetura','roadmap','comercial','operacional','prompt','observacao']);
const validStatus = new Set(['ativa','arquivada']);

function assertAccountId(accountId) { if (!accountId) throw new BadRequestError('accountId obrigatorio'); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function normalizeTags(tags) { if (tags === undefined) return undefined; if (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string')) throw new BadRequestError('tags invalida'); return tags.map((t) => t.trim()).filter(Boolean); }
function normalizePayload(data = {}, partial = false) {
  const out = {};
  if (!partial || data.tipo !== undefined) { const v = String(data.tipo || '').trim(); if (!v) throw new BadRequestError('tipo obrigatorio'); if (!validTipos.has(v)) throw new BadRequestError('tipo invalido'); out.tipo = v; }
  if (!partial || data.titulo !== undefined) { const v = String(data.titulo || '').trim(); if (!v) throw new BadRequestError('titulo obrigatorio'); out.titulo = v; }
  if (!partial || data.conteudo !== undefined) { const v = String(data.conteudo || '').trim(); if (!v) throw new BadRequestError('conteudo obrigatorio'); out.conteudo = v; }
  const tags = normalizeTags(data.tags); if (tags !== undefined) out.tags = tags;
  if (data.prioridade !== undefined) { const n = Number(data.prioridade); if (!Number.isFinite(n)) throw new BadRequestError('prioridade invalida'); out.prioridade = n; }
  if (data.origem !== undefined) out.origem = String(data.origem || '').trim() || null;
  if (data.modulo !== undefined) out.modulo = String(data.modulo || '').trim() || null;
  if (data.status !== undefined) { const s = String(data.status || '').trim(); if (!validStatus.has(s)) throw new BadRequestError('status invalido'); out.status = s; }
  if (data.metadata !== undefined) out.metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  return out;
}
function matchesSearch(item, q) { if (!q) return true; const hay = [item.titulo, item.conteudo, item.modulo, ...(item.tags || [])].join(' ').toLowerCase(); return hay.includes(q); }
function matchesFilters(item, filters = {}) { if (filters.tipo && String(item.tipo) !== String(filters.tipo)) return false; if (filters.modulo && String(item.modulo || '') !== String(filters.modulo)) return false; if (filters.tag && !(item.tags || []).map(String).includes(String(filters.tag))) return false; if (filters.status && String(item.status) !== String(filters.status)) return false; if (!filters.status && item.status !== 'ativa') return false; return matchesSearch(item, String(filters.search || '').trim().toLowerCase()); }

export async function listIaMemorias(filters = {}, options = {}) {
  assertAccountId(options.accountId);
  const effective = { ...filters };
  if (!effective.status) effective.status = 'ativa';
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let q = supabase.from('ia_memorias').select('*', { count: 'exact' }).eq('account_id', options.accountId).order('updated_at', { ascending: false });
    if (effective.tipo) q = q.eq('tipo', effective.tipo);
    if (effective.modulo) q = q.eq('modulo', effective.modulo);
    if (effective.tag) q = q.contains('tags', [effective.tag]);
    if (effective.status) q = q.eq('status', effective.status);
    if (effective.search) q = q.or(`titulo.ilike.%${effective.search}%,conteudo.ilike.%${effective.search}%,modulo.ilike.%${effective.search}%`);
    const { data, error, count } = await q;
    if (error) throw new DatabaseError('Falha ao listar memorias', { details: error });
    return { items: data || [], total: count || 0 };
  }
  const items = memoryIaMemorias.filter((item) => item.account_id === options.accountId && matchesFilters(item, effective)).map(clone);
  return { items, total: items.length };
}

export async function searchIaMemorias(filters = {}, options = {}) { return listIaMemorias({ ...filters, search: filters.search || filters.q || '' }, options); }

export async function getIaMemoriaById(id, options = {}) {
  assertAccountId(options.accountId);
  if (mode() === 'supabase') { const supabase = getSupabaseClient(); const { data, error } = await supabase.from('ia_memorias').select('*').eq('account_id', options.accountId).eq('id', id).maybeSingle(); if (error) throw new DatabaseError('Falha ao buscar memoria', { details: error }); if (!data) throw new NotFoundError('Memoria nao encontrada'); return data; }
  const item = memoryIaMemorias.find((m) => m.account_id === options.accountId && m.id === id); if (!item) throw new NotFoundError('Memoria nao encontrada'); return clone(item);
}

export async function createIaMemoria(data = {}, options = {}) {
  assertAccountId(options.accountId);
  const payload = normalizePayload(data);
  const row = { id: randomUUID(), account_id: options.accountId, ...payload, tags: payload.tags || [], prioridade: payload.prioridade ?? 0, origem: payload.origem || null, modulo: payload.modulo || null, status: payload.status || 'ativa', metadata: payload.metadata || {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (mode() === 'supabase') { const supabase = getSupabaseClient(); const { data: inserted, error } = await supabase.from('ia_memorias').insert(row).select('*').single(); if (error) throw new DatabaseError('Falha ao criar memoria', { details: error }); return inserted; }
  memoryIaMemorias.push(row); return clone(row);
}

export async function updateIaMemoria(id, data = {}, options = {}) {
  assertAccountId(options.accountId);
  const payload = normalizePayload(data, true);
  if (mode() === 'supabase') { const supabase = getSupabaseClient(); const { data: updated, error } = await supabase.from('ia_memorias').update({ ...payload, updated_at: new Date().toISOString() }).eq('account_id', options.accountId).eq('id', id).select('*').single(); if (error) throw new DatabaseError('Falha ao atualizar memoria', { details: error }); if (!updated) throw new NotFoundError('Memoria nao encontrada'); return updated; }
  const idx = memoryIaMemorias.findIndex((m) => m.account_id === options.accountId && m.id === id); if (idx < 0) throw new NotFoundError('Memoria nao encontrada'); memoryIaMemorias[idx] = { ...memoryIaMemorias[idx], ...payload, updated_at: new Date().toISOString() }; return clone(memoryIaMemorias[idx]);
}

export async function deleteIaMemoria(id, options = {}) { return updateIaMemoria(id, { status: 'arquivada' }, options); }
export function __resetMemoryIaMemoriasForTests() { memoryIaMemorias.length = 0; }

