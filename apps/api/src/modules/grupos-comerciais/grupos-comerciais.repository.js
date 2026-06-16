import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

const memoryGrupos = [];
const memoryVinculos = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'grupos-comerciais' });
}
function validateNome(nome) {
  const normalized = String(nome || '').trim();
  if (normalized.length < 2) throw new ValidationError('Nome invalido', { code: 'VALIDATION_ERROR', domain: 'grupos-comerciais' });
  return normalized;
}
function normalizeBoolean(value, fallback = true) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}
function repoMode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function clone(item) { return item ? { ...item } : item; }

export async function listGruposComerciais(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    let q = supabase.from('grupos_comerciais').select('*', { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
    if (!filters.includeInactive) q = q.eq('ativo', true);
    const { data, error } = await q;
    if (error) throw new DatabaseError('Falha ao listar grupos comerciais', { details: error });
    return { items: data || [], total: data?.length || 0 };
  }
  const items = memoryGrupos.filter((g) => g.account_id === accountId && (filters.includeInactive || g.ativo)).map(clone);
  return { items, total: items.length };
}

export async function getGrupoComercialById(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('grupos_comerciais').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar grupo comercial', { details: error });
    if (!data) throw new NotFoundError('Grupo comercial nao encontrado', { code: 'GRUPO_COMERCIAL_NOT_FOUND', domain: 'grupos-comerciais' });
    return data;
  }
  const item = memoryGrupos.find((g) => g.account_id === accountId && g.id === id);
  if (!item) throw new NotFoundError('Grupo comercial nao encontrado', { code: 'GRUPO_COMERCIAL_NOT_FOUND', domain: 'grupos-comerciais' });
  return clone(item);
}

export async function createGrupoComercial(data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const payload = { account_id: accountId, nome: validateNome(data.nome), descricao: data.descricao || null, ativo: normalizeBoolean(data.ativo, true) };
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: inserted, error } = await supabase.from('grupos_comerciais').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar grupo comercial', { details: error });
    return inserted;
  }
  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryGrupos.push(item);
  return clone(item);
}

export async function updateGrupoComercial(id, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await getGrupoComercialById(id, { accountId });
  const payload = {};
  if (data.nome !== undefined) payload.nome = validateNome(data.nome);
  if (data.descricao !== undefined) payload.descricao = data.descricao || null;
  if (data.ativo !== undefined) payload.ativo = normalizeBoolean(data.ativo, true);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase.from('grupos_comerciais').update({ ...payload, updated_at: new Date().toISOString() }).eq('account_id', accountId).eq('id', id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar grupo comercial', { details: error });
    return updated;
  }
  const idx = memoryGrupos.findIndex((g) => g.account_id === accountId && g.id === id);
  memoryGrupos[idx] = { ...memoryGrupos[idx], ...payload, updated_at: new Date().toISOString() };
  return clone(memoryGrupos[idx]);
}

export async function deleteGrupoComercial(id, options = {}) { return updateGrupoComercial(id, { ativo: false }, options); }

async function assertGrupoExists(accountId, grupoId) { await getGrupoComercialById(grupoId, { accountId }); }
async function assertClienteExists(accountId, clienteId) { const { getClienteById } = await import('../clientes/clientes.repository.js'); await getClienteById(clienteId, { accountId }); }

async function loadClienteSnapshot(accountId, clienteId) {
  const { getClienteById } = await import('../clientes/clientes.repository.js');
  try {
    const cliente = await getClienteById(clienteId, { accountId });
    return cliente ? {
      id: cliente.id,
      nome: cliente.nome || null,
      razao_social: cliente.razao_social || null,
      documento: cliente.documento || null,
      codigo: cliente.codigo || null,
      cidade: cliente.cidade || null,
      estado: cliente.estado || null
    } : null;
  } catch {
    return null;
  }
}

export async function listGrupoComercialClientes(grupoId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await assertGrupoExists(accountId, grupoId);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('grupo_comercial_clientes').select('id, account_id, grupo_comercial_id, cliente_id, created_at').eq('account_id', accountId).eq('grupo_comercial_id', grupoId).order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar clientes do grupo', { details: error });
    const items = await Promise.all((data || []).map(async (item) => ({ ...item, cliente: await loadClienteSnapshot(accountId, item.cliente_id) })));
    return { items };
  }
  const items = await Promise.all(memoryVinculos.filter((v) => v.account_id === accountId && v.grupo_comercial_id === grupoId).map(async (item) => ({ ...clone(item), cliente: await loadClienteSnapshot(accountId, item.cliente_id) })));
  return { items };
}

export async function addClientesToGrupo(grupoId, clienteIds = [], options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await assertGrupoExists(accountId, grupoId);
  const uniqueIds = [...new Set((Array.isArray(clienteIds) ? clienteIds : [clienteIds]).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!uniqueIds.length) throw new ValidationError('clienteIds obrigatorio', { code: 'VALIDATION_ERROR', domain: 'grupos-comerciais' });
  for (const clienteId of uniqueIds) await assertClienteExists(accountId, clienteId);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const rows = uniqueIds.map((cliente_id) => ({ account_id: accountId, grupo_comercial_id: grupoId, cliente_id }));
    const { data, error } = await supabase.from('grupo_comercial_clientes').upsert(rows, { onConflict: 'account_id,grupo_comercial_id,cliente_id' }).select('id, account_id, grupo_comercial_id, cliente_id, created_at');
    if (error) throw new DatabaseError('Falha ao vincular clientes ao grupo', { details: error });
    return { items: data || [] };
  }
  const created = [];
  for (const clienteId of uniqueIds) {
    const exists = memoryVinculos.find((v) => v.account_id === accountId && v.grupo_comercial_id === grupoId && v.cliente_id === clienteId);
    if (!exists) {
      const item = { id: randomUUID(), account_id: accountId, grupo_comercial_id: grupoId, cliente_id: clienteId, created_at: new Date().toISOString() };
      memoryVinculos.push(item);
      created.push(clone(item));
    }
  }
  return { items: created };
}

export async function removeClienteFromGrupo(grupoId, clienteId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await assertGrupoExists(accountId, grupoId); await assertClienteExists(accountId, clienteId);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('grupo_comercial_clientes').delete().eq('account_id', accountId).eq('grupo_comercial_id', grupoId).eq('cliente_id', clienteId);
    if (error) throw new DatabaseError('Falha ao remover cliente do grupo', { details: error });
    return { ok: true };
  }
  const idx = memoryVinculos.findIndex((v) => v.account_id === accountId && v.grupo_comercial_id === grupoId && v.cliente_id === clienteId);
  if (idx >= 0) memoryVinculos.splice(idx, 1);
  return { ok: true };
}

export async function getGruposComerciaisByClienteId(clienteId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (repoMode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('grupo_comercial_clientes').select('grupo_comercial_id, grupos_comerciais:grupos_comerciais ( id, nome, descricao, ativo )').eq('account_id', accountId).eq('cliente_id', clienteId);
    if (error) throw new DatabaseError('Falha ao buscar grupos do cliente', { details: error });
    return (data || []).map((row) => row?.grupos_comerciais || null).filter((g) => g && g.ativo !== false).map((g) => ({ id: g.id, nome: g.nome, descricao: g.descricao || null }));
  }
  return memoryVinculos.filter((v) => v.account_id === accountId && v.cliente_id === clienteId).map((v) => memoryGrupos.find((g) => g.id === v.grupo_comercial_id && g.account_id === accountId)).filter((g) => g && g.ativo !== false).map((g) => ({ id: g.id, nome: g.nome, descricao: g.descricao || null }));
}

export function __resetMemoryGruposComerciaisForTests() { memoryGrupos.length = 0; memoryVinculos.length = 0; }
