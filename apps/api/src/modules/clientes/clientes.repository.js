import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { applyOwnerFilter, assertCanAccessOwner } from '../../core/commercial-scope.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

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

function filterMemoryClientes(items, filters = {}, accountId) {
  let result = items.filter((item) => item.account_id === accountId);
  if (filters.owner_user_id) result = result.filter((item) => item.owner_user_id === filters.owner_user_id);

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
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (scopedFilters.owner_user_id) query = query.eq('owner_user_id', scopedFilters.owner_user_id);
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

  const filtered = filterMemoryClientes(memoryClientes, scopedFilters, accountId);
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
    if (options.context) assertCanAccessOwner(options.context, data.owner_user_id);
    return data;
  }

  const item = memoryClientes.find((cliente) => cliente.id === id && cliente.account_id === accountId);
  if (!item) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
  if (options.context) assertCanAccessOwner(options.context, item.owner_user_id);
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
      metadata: data.metadata || {}
    };
    payload.owner_user_id = data.owner_user_id || data.vendedor_id || null;

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
    owner_user_id: data.owner_user_id || data.vendedor_id || null,
    vendedor_id: data.owner_user_id || data.vendedor_id || null,
    createdAt: new Date().toISOString()
  };

  memoryClientes.push(cliente);
  return cliente;
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
