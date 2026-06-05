import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { applyOwnerFilter, getUserIdFromContext } from '../../core/commercial-scope.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { findVendedorByUserId } from '../vendedores/vendedores.repository.js';

const memoryClientes = [];

function normalizePagination(filters = {}) {
  const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1;
  const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20;
  const limit = Math.min(rawLimit, 100);
  return { page, limit };
}

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', {
      code: 'TENANT_REQUIRED',
      domain: 'clientes-crm',
      details: { reason: 'account_id_missing' }
    });
  }
}

function debugRepository(action, payload) {
  if (env.NODE_ENV === 'production') return;
  console.debug(`[clientes.repository] ${action}`, payload);
}

function resolveVendedorScope(accountId, context = {}) {
  const role = String(context?.auth?.role || '').toLowerCase();
  if (role !== 'sales') return null;
  const userId = getUserIdFromContext(context);
  return findVendedorByUserId(accountId, userId) || (userId ? { id: userId } : null);
}

function getClienteScopeId(cliente = {}) {
  return String(cliente.vendedor_id || cliente.owner_user_id || '').trim() || null;
}

function filterMemoryClientes(items, filters = {}, accountId) {
  let result = items.filter((item) => item.account_id === accountId);
  if (filters.vendedor_id) result = result.filter((item) => String(item.vendedor_id || '') === String(filters.vendedor_id));

  if (typeof filters.ativo === 'boolean') {
    result = result.filter((item) => item.ativo === filters.ativo);
  }

  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    result = result.filter((item) => [item.nome, item.email, item.documento].some((v) => String(v || '').toLowerCase().includes(q)));
  }

  return result;
}

export function getClientesRepositoryMode() {
  return {
    mode: isSupabaseConfigured() ? 'supabase' : 'memory',
    supabaseConfigured: isSupabaseConfigured()
  };
}

export async function listClientes(filters = {}, options = {}) {
  const { page, limit } = normalizePagination(filters);
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  const repositoryMode = getClientesRepositoryMode();
  debugRepository('listClientes', { repositoryMode, accountId, filters });

  const scopedFilters = options.context ? applyOwnerFilter(options.context, filters) : filters;
  const vendedor = resolveVendedorScope(accountId, options.context);
  const effectiveVendedorId = vendedor?.id || scopedFilters.vendedor_id || null;
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (effectiveVendedorId) query = query.eq('vendedor_id', effectiveVendedorId);
    if (scopedFilters.search) {
      const search = String(scopedFilters.search).trim();
      if (search) query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,documento.ilike.%${search}%`);
    }

    if (typeof scopedFilters.ativo === 'boolean') query = query.eq('ativo', scopedFilters.ativo);

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new DatabaseError('Falha ao listar clientes', { details: error });

    const total = count || 0;
    return { items: data || [], total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  const filtered = filterMemoryClientes(memoryClientes, { ...scopedFilters, vendedor_id: effectiveVendedorId }, accountId);
  const total = filtered.length;
  const from = (page - 1) * limit;
  return {
    items: filtered.slice(from, from + limit),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };
}

export async function getClienteById(id, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('clientes').select('*').eq('account_id', accountId).eq('id', id).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar cliente', { details: error });
    if (!data) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
    if (options.context && String(options.context?.auth?.role || '').toLowerCase() === 'sales') {
      const vendedor = resolveVendedorScope(accountId, options.context);
      if (!vendedor || String(getClienteScopeId(data)) !== String(vendedor.id)) {
        throw new ForbiddenError('Sem permissao para acessar este registro', { code: 'VENDEDOR_SCOPE_FORBIDDEN', domain: 'clientes-crm' });
      }
    }
    return data;
  }

  const item = memoryClientes.find((cliente) => cliente.id === id && cliente.account_id === accountId);
  if (!item) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
  if (options.context && String(options.context?.auth?.role || '').toLowerCase() === 'sales') {
    const vendedor = resolveVendedorScope(accountId, options.context);
    if (!vendedor || String(getClienteScopeId(item)) !== String(vendedor.id)) {
      throw new ForbiddenError('Sem permissao para acessar este registro', { code: 'VENDEDOR_SCOPE_FORBIDDEN', domain: 'clientes-crm' });
    }
  }
  return item;
}

export async function createCliente(data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);

  const repositoryMode = getClientesRepositoryMode();
  debugRepository('createCliente', { repositoryMode, accountId, filters: null });

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const vendedor = resolveVendedorScope(accountId, options.context);
    const vendedorId = vendedor?.id || data.vendedor_id || null;

    const payload = {
      account_id: accountId,
      nome: data.nome,
      documento: data.documento || null,
      email: data.email || null,
      telefone: data.telefone || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
      metadata: data.metadata || {},
      vendedor_id: vendedorId,
      owner_user_id: vendedorId
    };

    const { data: inserted, error } = await supabase.from('clientes').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar cliente', { details: error });
    return inserted;
  }

  const cliente = {
    id: randomUUID(),
    account_id: accountId,
    nome: data.nome,
    documento: data.documento || null,
    email: data.email || null,
    telefone: data.telefone || null,
    cidade: data.cidade || null,
    estado: data.estado || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
    metadata: data.metadata || {},
    vendedor_id: (options.context && String(options.context?.auth?.role || '').toLowerCase() === 'sales')
      ? (resolveVendedorScope(accountId, options.context)?.id || null)
      : (data.vendedor_id || null),
    owner_user_id: (options.context && String(options.context?.auth?.role || '').toLowerCase() === 'sales')
      ? (getUserIdFromContext(options.context) || resolveVendedorScope(accountId, options.context)?.id || null)
      : (data.vendedor_id || data.owner_user_id || null),
    createdAt: new Date().toISOString()
  };

  memoryClientes.push(cliente);
  return cliente;
}

export async function updateCliente(id, data, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const current = await getClienteById(id, { accountId, context: options.context });
  const role = String(options.context?.auth?.role || '').toLowerCase();
  const vendedor = role === 'sales' ? resolveVendedorScope(accountId, options.context) : null;
  if (role === 'sales' && (!vendedor || String(getClienteScopeId(current)) !== String(vendedor.id))) {
    throw new ForbiddenError('Sem permissao para acessar este registro', { code: 'VENDEDOR_SCOPE_FORBIDDEN', domain: 'clientes-crm' });
  }
  const next = {
    ...current,
    ...(data.nome !== undefined ? { nome: data.nome } : {}),
    ...(data.documento !== undefined ? { documento: data.documento || null } : {}),
    ...(data.email !== undefined ? { email: data.email || null } : {}),
    ...(data.telefone !== undefined ? { telefone: data.telefone || null } : {}),
    ...(data.cidade !== undefined ? { cidade: data.cidade || null } : {}),
    ...(data.estado !== undefined ? { estado: data.estado || null } : {}),
    ...(data.tags !== undefined ? { tags: Array.isArray(data.tags) ? data.tags : [] } : {}),
    ...(data.ativo !== undefined ? { ativo: typeof data.ativo === 'boolean' ? data.ativo : current.ativo } : {}),
    ...(data.metadata !== undefined ? { metadata: data.metadata || {} } : {})
  };
  if (role === 'sales') next.vendedor_id = vendedor?.id || getClienteScopeId(current) || null;
  else if (data.vendedor_id !== undefined) next.vendedor_id = data.vendedor_id || null;

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('clientes').update({
      nome: next.nome,
      documento: next.documento,
      email: next.email,
      telefone: next.telefone,
      cidade: next.cidade,
      estado: next.estado,
      tags: next.tags,
      ativo: next.ativo,
      metadata: next.metadata,
      vendedor_id: next.vendedor_id,
      owner_user_id: next.vendedor_id,
      updated_at: new Date().toISOString()
    }).eq('account_id', accountId).eq('id', id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar cliente', { details: error });
    return updated;
  }

  const idx = memoryClientes.findIndex((cliente) => cliente.id === id && cliente.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
  memoryClientes[idx] = { ...next, id, account_id: accountId, updated_at: new Date().toISOString(), owner_user_id: next.vendedor_id };
  return memoryClientes[idx];
}

export function __resetMemoryClientesForTests() {
  memoryClientes.length = 0;
}

export function __dumpMemoryClientes() {
  return memoryClientes.map((item) => ({ ...item }));
}

export function __loadMemoryClientes(items = []) {
  memoryClientes.length = 0;
  for (const item of items) {
    memoryClientes.push({ ...item });
  }
}
