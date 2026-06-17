import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { DatabaseError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors.js';
import { applyOwnerFilter, getUserIdFromContext } from '../../core/commercial-scope.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { findVendedorByUserId } from '../vendedores/vendedores.repository.js';
import { buildEnrichmentUpdateFromBrasilApi, buildEnrichmentUpdateFromCnpjWs, fetchBrasilApiCnpj, fetchCnpjWsCnpj, isValidCnpj, normalizeCnpj } from './clientes.enrichment.js';
import { calcularScoreCliente } from './clientes.score.service.js';
import { geocodificarEndereco, montarEnderecoCliente } from './clientes.geocoding.service.js';

const memoryClientes = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

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

function normalizeDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function logSupabaseError(action, error, context = {}) {
  console.error(`[clientes.repository] ${action}`, {
    accountId: context.accountId || null,
    clienteId: context.clienteId || null,
    message: error?.message || null,
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null
  });
}

function computeCommercialStatusFromDays(daysSinceLastPurchase) {
  if (!Number.isFinite(daysSinceLastPurchase)) return 'sem_pedido';
  if (daysSinceLastPurchase <= 60) return 'ativo';
  if (daysSinceLastPurchase <= 120) return 'em_risco';
  return 'inativo';
}

function isValidCommercialPedido(pedido = {}) {
  const status = String(pedido.status || '').trim().toLowerCase();
  if (!status) return false;
  if (['cancelado', 'rejeitado', 'estornado'].includes(status)) return false;
  const metadata = pedido.metadata && typeof pedido.metadata === 'object' ? pedido.metadata : {};
  if (['cancelado', 'rejeitado', 'estornado'].includes(String(metadata.status || '').trim().toLowerCase())) return false;
  if (['cancelado', 'rejeitado', 'estornado'].includes(String(metadata.situacao || '').trim().toLowerCase())) return false;
  return true;
}

function resolvePurchaseDate(pedido = {}) {
  return normalizeDateValue(pedido.data_faturamento) || normalizeDateValue(pedido.data_emissao) || normalizeDateValue(pedido.created_at) || normalizeDateValue(pedido.createdAt);
}

export async function listClientePedidos(accountId, clienteId) {
  const repositoryMode = getClientesRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('pedidos')
      .select('id, account_id, cliente_id, status, total, data_emissao, data_faturamento, metadata, created_at')
      .eq('account_id', accountId)
      .eq('cliente_id', clienteId)
      .order('data_faturamento', { ascending: false, nullsLast: true })
      .order('data_emissao', { ascending: false, nullsLast: true })
      .order('created_at', { ascending: false })
      .limit(250);
    if (error) {
      logSupabaseError('listClientePedidos error', error, { accountId, clienteId });
      debugRepository('listClientePedidos fallback vazio', { accountId, clienteId });
      return [];
    }
    return data || [];
  }

  const { __dumpMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  return (snapshot.pedidos || []).filter((pedido) => pedido.account_id === accountId && pedido.cliente_id === clienteId);
}

export async function listClientePedidoItens(accountId, pedidoIds = [], pedidosFallback = []) {
  const ids = [...new Set((Array.isArray(pedidoIds) ? pedidoIds : [pedidoIds]).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const repositoryMode = getClientesRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const query = supabase.from('pedido_itens').select('*').eq('account_id', accountId).in('pedido_id', ids);
    const { data, error } = await query;
    if (!error) return data || [];
    debugRepository('listClientePedidoItens fallback', { accountId, ids, error: error?.message || error });
    return (Array.isArray(pedidosFallback) ? pedidosFallback : []).flatMap((pedido) => Array.isArray(pedido?.itens) ? pedido.itens.map((item) => ({ ...item, pedido_id: pedido.id })) : []);
  }
  return (Array.isArray(pedidosFallback) ? pedidosFallback : []).flatMap((pedido) => Array.isArray(pedido?.itens) ? pedido.itens.map((item) => ({ ...item, pedido_id: pedido.id })) : []);
}

async function persistClientCommercialHistory(cliente, payload, options = {}) {
  const accountId = options.accountId || null;
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('clientes').update(payload).eq('account_id', accountId).eq('id', cliente.id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar historico comercial do cliente', { details: error });
    return data;
  }

  const idx = memoryClientes.findIndex((item) => item.id === cliente.id && item.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
  memoryClientes[idx] = { ...memoryClientes[idx], ...payload, updated_at: new Date().toISOString() };
  return memoryClientes[idx];
}

export async function recalculateClientCommercialHistory(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const cliente = await getClienteById(clienteId, { accountId, context: options.context });
  const pedidos = await listClientePedidos(accountId, cliente.id);
  const pedidosValidos = (pedidos || []).filter(isValidCommercialPedido);
  if (!pedidosValidos.length) {
    return persistClientCommercialHistory(cliente, { ultima_compra_em: null, status_comercial: 'sem_pedido' }, { accountId });
  }

  const compras = pedidosValidos
    .map((pedido) => ({ pedido, data: resolvePurchaseDate(pedido) }))
    .filter((entry) => entry.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());

  if (!compras.length) {
    return persistClientCommercialHistory(cliente, { ultima_compra_em: null, status_comercial: 'sem_pedido' }, { accountId });
  }

  const ultimaCompra = compras[0].data;
  const hoje = options.now instanceof Date ? options.now : new Date(options.now || new Date());
  const diffMs = hoje.getTime() - ultimaCompra.getTime();
  const daysSinceLastPurchase = Number.isFinite(diffMs) ? Math.floor(diffMs / 86400000) : Number.NaN;
  const status_comercial = computeCommercialStatusFromDays(daysSinceLastPurchase);

  return persistClientCommercialHistory(cliente, {
    ultima_compra_em: ultimaCompra.toISOString(),
    status_comercial
  }, { accountId });
}

export async function recalculateClientsCommercialHistory(clienteIds = [], options = {}) {
  const uniqueIds = [...new Set((Array.isArray(clienteIds) ? clienteIds : [clienteIds]).map((id) => String(id || '').trim()).filter(Boolean))];
  const results = [];
  const warnings = [];
  for (const clienteId of uniqueIds) {
    try {
      results.push(await recalculateClientCommercialHistory(clienteId, options));
    } catch (error) {
      warnings.push({ clienteId, error: error?.message || String(error) });
    }
  }
  if (warnings.length) results.warnings = warnings;
  return results;
}

function filterMemoryClientes(items, filters = {}, accountId) {
  let result = items.filter((item) => item.account_id === accountId);
  if (filters.vendedor_id) result = result.filter((item) => String(item.vendedor_id || '') === String(filters.vendedor_id));

  if (typeof filters.ativo === 'boolean') {
    result = result.filter((item) => item.ativo === filters.ativo);
  }

  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    result = result.filter((item) => [item.nome, item.email, item.documento, item.telefone, item.cidade, item.codigo].some((v) => String(v || '').toLowerCase().includes(q)));
  }

  return result;
}

export function getClientesRepositoryMode() {
  return {
    mode: resolveSupabaseConfigured() ? 'supabase' : 'memory',
    supabaseConfigured: resolveSupabaseConfigured()
  };
}

function normalizeClienteMetadata(metadata, fallback = {}) {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const merged = { ...base, ...fallback };
  return Object.keys(merged).length ? merged : {};
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
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (effectiveVendedorId) query = query.eq('vendedor_id', effectiveVendedorId);
    if (scopedFilters.search) {
      const search = String(scopedFilters.search).trim();
      if (search) query = query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,documento.ilike.%${search}%,telefone.ilike.%${search}%,cidade.ilike.%${search}%,codigo.ilike.%${search}%`);
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
      codigo: data.codigo ?? null,
      documento: data.documento || null,
      email: data.email || null,
      telefone: data.telefone || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      tags: Array.isArray(data.tags) ? data.tags : [],
      ativo: typeof data.ativo === 'boolean' ? data.ativo : true,
      metadata: normalizeClienteMetadata(data.metadata, data.metadata_importacao),
      vendedor_id: vendedorId
    };

    const { data: inserted, error } = await supabase.from('clientes').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar cliente', { details: error });
    return inserted;
  }

  const cliente = {
    id: randomUUID(),
    account_id: accountId,
    nome: data.nome,
    codigo: data.codigo ?? null,
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
    ...(data.codigo !== undefined ? { codigo: data.codigo ?? null } : {}),
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
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('clientes').update({
      nome: next.nome,
      codigo: next.codigo,
      documento: next.documento,
      email: next.email,
      telefone: next.telefone,
      cidade: next.cidade,
      estado: next.estado,
      tags: next.tags,
      ativo: next.ativo,
      metadata: normalizeClienteMetadata(next.metadata),
      vendedor_id: next.vendedor_id,
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

export function __setClientesSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

async function persistClienteEnrichment(cliente, payload, options = {}) {
  const accountId = options.accountId || null;
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('clientes').update(payload).eq('account_id', accountId).eq('id', cliente.id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar enriquecimento do cliente', { details: error, domain: 'clientes-crm' });
    return data;
  }
  const idx = memoryClientes.findIndex((item) => item.id === cliente.id && item.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
  memoryClientes[idx] = { ...memoryClientes[idx], ...payload, updated_at: new Date().toISOString() };
  return memoryClientes[idx];
}

async function persistClienteGeolocalizacao(cliente, payload, options = {}) {
  const accountId = options.accountId || null;
  const basePayload = {
    geolocalizacao_status: payload.geolocalizacao_status || null,
    geolocalizacao_fonte: payload.geolocalizacao_fonte || null,
    geolocalizacao_erro: payload.geolocalizacao_erro || null,
    geolocalizacao_ultima_execucao: payload.geolocalizacao_ultima_execucao || new Date().toISOString()
  };
  if (payload.latitude !== undefined) basePayload.latitude = payload.latitude;
  if (payload.longitude !== undefined) basePayload.longitude = payload.longitude;
  if (payload.google_maps_url !== undefined) basePayload.google_maps_url = payload.google_maps_url;
  if (payload.google_place_id !== undefined) basePayload.google_place_id = payload.google_place_id;

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('clientes').update(basePayload).eq('account_id', accountId).eq('id', cliente.id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar geolocalizacao do cliente', { details: error, domain: 'clientes-crm' });
    return data;
  }

  const idx = memoryClientes.findIndex((item) => item.id === cliente.id && item.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Cliente nao encontrado', { code: 'CLIENTE_NOT_FOUND', domain: 'clientes-crm' });
  memoryClientes[idx] = { ...memoryClientes[idx], ...basePayload, updated_at: new Date().toISOString() };
  return memoryClientes[idx];
}

export async function enrichClienteByCnpj(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const cliente = await getClienteById(clienteId, { accountId, context: options.context });
  const cnpj = normalizeCnpj(cliente?.documento);
  if (!isValidCnpj(cnpj)) {
    const erro = 'CNPJ ausente ou invalido';
    await persistClienteEnrichment(cliente, {
      enriquecimento_status: 'erro',
      enriquecimento_fonte: 'brasilapi',
      enriquecimento_ultima_execucao: new Date().toISOString(),
      enriquecimento_erro: erro
    }, { accountId });
    throw new ValidationError(erro, { domain: 'clientes-crm', code: 'CNPJ_INVALIDO' });
  }

  let payload;
  try {
    payload = await fetchBrasilApiCnpj(cnpj, { fetchImpl: options.fetchImpl });
    return persistClienteEnrichment(cliente, buildEnrichmentUpdateFromBrasilApi(payload), { accountId });
  } catch (error) {
    const brasilApiError = error;
    const fallbackEligible = [403, 429].includes(Number(brasilApiError?.details?.status || brasilApiError?.statusCode || brasilApiError?.status || 0)) || Number(brasilApiError?.details?.status || brasilApiError?.statusCode || brasilApiError?.status || 0) >= 500;
    if (fallbackEligible) {
      try {
        const cnpjWsPayload = await fetchCnpjWsCnpj(cnpj, { fetchImpl: options.fetchImpl });
        return persistClienteEnrichment(cliente, buildEnrichmentUpdateFromCnpjWs(cnpjWsPayload), { accountId });
      } catch (cnpjWsError) {
        const erroFinal = 'Não foi possível consultar o CNPJ nas fontes disponíveis.';
        const details = {
          brasilapi: brasilApiError?.details?.body || brasilApiError?.message || String(brasilApiError),
          cnpjws: cnpjWsError?.details?.body || cnpjWsError?.message || String(cnpjWsError)
        };
        debugRepository('enrichClienteByCnpj fallback_failed', { accountId, clienteId, cnpj, details });
        await persistClienteEnrichment(cliente, {
          enriquecimento_status: 'erro',
          enriquecimento_fonte: 'brasilapi/cnpjws',
          enriquecimento_ultima_execucao: new Date().toISOString(),
          enriquecimento_erro: erroFinal
        }, { accountId });
        throw new DatabaseError(erroFinal, { domain: 'clientes-crm', details });
      }
    }

    const erro = brasilApiError?.message || 'Falha ao consultar BrasilAPI';
    const status = Number(brasilApiError?.details?.status || brasilApiError?.statusCode || brasilApiError?.status || 0);
    await persistClienteEnrichment(cliente, {
      enriquecimento_status: 'erro',
      enriquecimento_fonte: 'brasilapi',
      enriquecimento_ultima_execucao: new Date().toISOString(),
      enriquecimento_erro: erro
    }, { accountId });
    if (status === 422 || brasilApiError?.code === 'BRASILAPI_ERROR') {
      throw new ValidationError(erro, { domain: 'clientes-crm', code: 'BRASILAPI_REJEITOU_CNPJ' });
    }
    throw new DatabaseError('Falha ao consultar BrasilAPI', { domain: 'clientes-crm', details: { message: erro } });
  }
}

export async function geolocalizarCliente({ supabase, accountId, clienteId, fetchImpl, context } = {}) {
  assertAccountId(accountId);
  const cliente = await getClienteById(clienteId, { accountId, context });
  const endereco_consultado = montarEnderecoCliente(cliente);
  const resultadoBase = await geocodificarEndereco(endereco_consultado, { fetchImpl });

  const payload = {
    geolocalizacao_status: resultadoBase.status,
    geolocalizacao_fonte: resultadoBase.fonte || 'nominatim',
    geolocalizacao_erro: resultadoBase.erro || null,
    geolocalizacao_ultima_execucao: new Date().toISOString()
  };

  if (resultadoBase.status === 'sucesso') {
    payload.latitude = resultadoBase.latitude;
    payload.longitude = resultadoBase.longitude;
    payload.google_maps_url = resultadoBase.google_maps_url;
    payload.google_place_id = resultadoBase.google_place_id || null;
  } else {
    payload.latitude = null;
    payload.longitude = null;
    payload.google_maps_url = null;
    payload.google_place_id = null;
  }

  const updated = await persistClienteGeolocalizacao(cliente, payload, { accountId, supabase });
  return {
    cliente: updated,
    endereco_consultado,
    resultado: resultadoBase
  };
}

export async function calcularScoreComercialCliente({ supabase, context, accountId, clienteId } = {}) {
  assertAccountId(accountId);
  const cliente = await getClienteById(clienteId, { accountId, context });
  const pedidos = await listClientePedidos(accountId, cliente.id);
  const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(isValidCommercialPedido);
  const itens = await listClientePedidoItens(accountId, pedidosValidos.map((pedido) => pedido.id), pedidosValidos);
  const scoreResult = calcularScoreCliente({ cliente, pedidos: pedidosValidos, itens });
  const payload = {
    cliente_score: scoreResult.score,
    cliente_classificacao: scoreResult.classificacao,
    cliente_potencial: scoreResult.potencial,
    cliente_score_ultima_execucao: new Date().toISOString(),
    cliente_score_fatores: scoreResult.fatores
  };

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabaseClient = supabase || resolveSupabaseClient();
    if (!supabaseClient) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabaseClient.from('clientes').update(payload).eq('account_id', accountId).eq('id', cliente.id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar score comercial do cliente', { details: error, domain: 'clientes-crm' });
    return { cliente: data, score: scoreResult };
  }

  const updated = await persistClientCommercialHistory(cliente, payload, { accountId });
  return { cliente: updated, score: scoreResult };
}
