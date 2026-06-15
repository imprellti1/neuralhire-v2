import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { createPedidoAuditEvent } from '../../core/audit.js';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { applyOwnerFilter, canAccessAllTenantData, getUserIdFromContext } from '../../core/commercial-scope.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getClienteById } from '../clientes/clientes.repository.js';
import { getProdutoById } from '../produtos/produtos.repository.js';
import { getVendedorById } from '../vendedores/vendedores.repository.js';
import { canTransitionPedidoStatus, isValidPedidoStatus, PEDIDO_STATUS } from './pedidos.schemas.js';

const memoryPedidos = [];
const memoryPedidoItens = [];
const memoryPedidoStatusHistory = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function debugRepository(action, payload) { if (env.NODE_ENV !== 'production') console.debug(`[pedidos.repository] ${action}`, payload); }
const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'pedidos-comercial', details: { reason: 'account_id_missing' } }); }
function normalizePagination(filters = {}) { const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1; const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20; return { page, limit: Math.min(rawLimit, 100) }; }
function assertItens(itens) { if (!Array.isArray(itens) || itens.length === 0) throw new BadRequestError('Pedido precisa de pelo menos um item', { code: 'PEDIDO_ITENS_REQUIRED', domain: 'pedidos-comercial' }); }
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
function normalizeDateOnlyValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === 'number') {
    const excelEpoch = Math.round((value - 25569) * 86400 * 1000);
    if (!Number.isFinite(excelEpoch)) return null;
    const date = new Date(excelEpoch);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) return null;
  const date = new Date(text);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const fullYear = y.length === 2 ? Number(`20${y}`) : Number(y);
    const parsed = new Date(Date.UTC(fullYear, Number(m) - 1, Number(d)));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  return null;
}
function getPedidoClienteFallback(item = {}) {
  return item?.cliente_id || '-';
}
function getClienteNomeFallback(item = {}) {
  return getPedidoClienteFallback(item);
}
function getPedidoVendedorFallback(item = {}) {
  return item?.vendedor_id || null;
}

async function enrichPedidosWithVendedorNome(items = [], accountId) {
  if (!Array.isArray(items) || !items.length) return [];
  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const vendedorIds = [...new Set(items.map((i) => i?.vendedor_id).filter(Boolean))];
    if (!vendedorIds.length) return items.map((item) => ({ ...item, vendedor_nome: null, vendedor: null }));
    try {
      const { data, error } = await supabase.from('vendedores').select('id, nome').eq('account_id', accountId).in('id', vendedorIds);
      if (error) throw new DatabaseError('Falha ao enriquecer pedidos com vendedor', { details: error });
      const byId = new Map((data || []).map((v) => [v.id, v]));
      return items.map((item) => {
        const vendedor = byId.get(item?.vendedor_id);
        return { ...item, vendedor: vendedor ? { id: vendedor.id, nome: vendedor.nome || null } : null, vendedor_nome: vendedor?.nome || null };
      });
    } catch (error) {
      if (env.NODE_ENV !== 'production') console.warn('[pedidos.repository] Falha ao enriquecer pedidos com vendedor', error);
      return items.map((item) => ({ ...item, vendedor_nome: null, vendedor: null }));
    }
  }
  const byId = new Map();
  for (const item of items) {
    const vendedorId = item?.vendedor_id;
    if (!vendedorId || byId.has(vendedorId)) continue;
    try {
      const vendedor = await getVendedorById(vendedorId, { accountId });
      byId.set(vendedorId, vendedor?.nome || null);
    } catch (error) {
      if (env.NODE_ENV !== 'production') console.warn('[pedidos.repository] Falha ao enriquecer pedidos com vendedor', error);
      byId.set(vendedorId, null);
    }
  }
  return items.map((item) => {
    const nome = byId.get(item?.vendedor_id) || null;
    return { ...item, vendedor_nome: nome, vendedor: item?.vendedor_id && nome ? { id: item.vendedor_id, nome } : null };
  });
}

async function enrichPedidosWithClienteNome(items = [], accountId) {
  if (!Array.isArray(items) || !items.length) return [];
  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const clienteIds = [...new Set(items.map((i) => i?.cliente_id).filter(Boolean))];
    if (!clienteIds.length) return items.map((item) => ({ ...item, cliente_nome: getClienteNomeFallback(item) }));
    try {
      const { data, error } = await supabase.from('clientes').select('id, nome, empresa, razao_social, nome_contato').eq('account_id', accountId).in('id', clienteIds);
      if (error) throw new DatabaseError('Falha ao enriquecer pedidos com cliente', { details: error });
      const byId = new Map((data || []).map((c) => [c.id, c]));
      return items.map((item) => {
        const cliente = byId.get(item?.cliente_id);
        const nome = cliente?.razao_social || cliente?.empresa || cliente?.nome || cliente?.nome_contato || null;
        return { ...item, cliente_nome: isUuid(nome) ? getClienteNomeFallback(item) : (nome || getClienteNomeFallback(item)) };
      });
    } catch {
      return items.map((item) => ({ ...item, cliente_nome: getClienteNomeFallback(item) }));
    }
  }

  const byId = new Map();
  for (const item of items) {
    const clienteId = item?.cliente_id;
    if (!clienteId || byId.has(clienteId)) continue;
    try {
    const cliente = await getClienteById(clienteId, { accountId });
      const nome = cliente?.razao_social || cliente?.empresa || cliente?.nome || cliente?.nome_contato || null;
      byId.set(clienteId, isUuid(nome) ? null : nome);
    } catch {
      byId.set(clienteId, getClienteNomeFallback(item));
    }
  }
  return items.map((item) => ({ ...item, cliente_nome: byId.get(item?.cliente_id) || getClienteNomeFallback(item) }));
}

export function calculatePedidoTotals(itens = []) {
  const itensCalculados = itens.map((item) => {
    const quantidade = Number(item.quantidade || 0);
    const precoUnitario = Number(item.preco_unitario || 0);
    const desconto = Number(item.desconto || 0);
    if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(precoUnitario) || precoUnitario < 0) throw new BadRequestError('Item do pedido invalido', { code: 'PEDIDO_ITEM_INVALID', domain: 'pedidos-comercial' });
    const subtotal = round2(quantidade * precoUnitario);
    const total = round2(subtotal - desconto);
    return { ...item, quantidade, preco_unitario: precoUnitario, desconto, subtotal, total };
  });
  const totalItens = round2(itensCalculados.reduce((a, i) => a + i.total, 0));
  return { total: totalItens, itensCalculados };
}

export function getPedidosRepositoryMode() { const supabaseConfigured = resolveSupabaseConfigured(); return { mode: supabaseConfigured ? 'supabase' : 'memory', supabaseConfigured }; }

export async function listPedidos(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const { page, limit } = normalizePagination(filters); const repositoryMode = getPedidosRepositoryMode(); debugRepository('listPedidos', { repositoryMode, accountId, filters });
  const scopedFilters = options.context ? applyOwnerFilter(options.context, filters) : filters;
  if (repositoryMode.mode === 'supabase') {
    const supabase = resolveSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase.from('pedidos').select(`
      id,
      account_id,
      cliente_id,
      vendedor_id,
      numero,
      status,
      origem,
      observacoes,
      total,
      metadata,
      created_at,
      updated_at,
      data_emissao,
      data_faturamento,
      comissao_principal_percentual,
      comissao_preposto_percentual
    `, { count: 'exact' }).eq('account_id', accountId).order('created_at', { ascending: false });
    if (scopedFilters.status) query = query.eq('status', scopedFilters.status); if (scopedFilters.cliente_id) query = query.eq('cliente_id', scopedFilters.cliente_id);
    const from = (page - 1) * limit; const { data, error, count } = await query.range(from, from + limit - 1); if (error) { throw new DatabaseError('Falha ao listar pedidos', { details: error }); }
    const total = count || 0;
    const enrichedItems = await enrichPedidosWithClienteNome(data || [], accountId).catch(() => (data || []).map((item) => ({ ...item, cliente_nome: null })));
    return { items: enrichedItems, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }
  let items = memoryPedidos.filter((i) => i.account_id === accountId); if (scopedFilters.status) items = items.filter((i) => i.status === scopedFilters.status); if (scopedFilters.cliente_id) items = items.filter((i) => i.cliente_id === scopedFilters.cliente_id);
  const total = items.length;
  const from = (page - 1) * limit;
  const pagedItems = items.slice(from, from + limit);
  const enrichedItems = await enrichPedidosWithClienteNome(pagedItems, accountId);
  return { items: enrichedItems, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

function normalizeCommissionValue(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new BadRequestError('Comissao invalida', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  return round2(parsed);
}

function normalizeDateValue(value) {
  const text = String(value || '').trim();
  if (!text) throw new BadRequestError('Data de faturamento invalida', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new BadRequestError('Data de faturamento invalida', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  return date.toISOString().slice(0, 10);
}

function buildPedidoIssues(pedido = {}, itensCount = 0) {
  const issues = [];
  const principal = Number(pedido?.comissao_principal_percentual);
  const preposto = Number(pedido?.comissao_preposto_percentual);
  if ((!Number.isFinite(principal) || principal <= 0) && (!Number.isFinite(preposto) || preposto <= 0)) issues.push('sem_comissao');
  if (!Number.isFinite(Number(itensCount)) || Number(itensCount) <= 0) issues.push('sem_itens');
  if (!String(pedido?.vendedor_id || '').trim()) issues.push('sem_vendedor');
  if (String(pedido?.status || '').toLowerCase() !== 'faturado_total') issues.push('nao_faturado_total');
  return issues;
}

async function getPedidoItensCounts(items = [], accountId) {
  if (!items.length) return new Map();
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const pedidoIds = items.map((item) => item.id);
    const { data, error } = await supabase.from('pedido_itens').select('pedido_id', { count: 'exact' }).eq('account_id', accountId).in('pedido_id', pedidoIds);
    if (error) throw new DatabaseError('Falha ao contar itens dos pedidos', { details: error });
    const counts = new Map();
    for (const pedidoId of pedidoIds) counts.set(pedidoId, 0);
    for (const row of data || []) counts.set(row.pedido_id, (counts.get(row.pedido_id) || 0) + 1);
    return counts;
  }
  const counts = new Map();
  for (const item of items) counts.set(item.id, memoryPedidoItens.filter((pi) => pi.account_id === accountId && pi.pedido_id === item.id).length);
  return counts;
}

export async function listPedidosAuditoria(filters = {}, options = {}) {
  const result = await listPedidos(filters, options);
  const accountId = options.accountId || null;
  const counts = await getPedidoItensCounts(result.items || [], accountId);
  const pedidosWithIssues = (result.items || []).map((pedido) => ({
    ...pedido,
    itens_count: counts.get(pedido.id) || 0,
    issues: buildPedidoIssues(pedido, counts.get(pedido.id) || 0)
  }));
  const enrichedVendedores = await enrichPedidosWithVendedorNome(pedidosWithIssues, accountId).catch(() => pedidosWithIssues.map((pedido) => ({ ...pedido, vendedor_nome: null, vendedor: null })));
  const enriched = enrichedVendedores;
  const search = String(filters.search || '').trim().toLowerCase();
  const issue = String(filters.issue || '').trim().toLowerCase();
  const filtered = enriched.filter((pedido) => {
    if (String(pedido?.status || '').toLowerCase() === 'cancelado') return false;
    const matchesIssue = !issue || (pedido.issues || []).includes(issue);
    const haystack = [pedido.numero, pedido.cliente_nome, pedido.cliente_id, pedido.id].filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesIssue && matchesSearch;
  });
  return { ...result, items: filtered, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / (result.limit || 1))) };
}

export async function getPedidoById(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: pedido, error: pe } = await supabase.from('pedidos').select('*').eq('account_id', accountId).eq('id', id).maybeSingle(); if (pe) throw new DatabaseError('Falha ao buscar pedido', { details: pe }); if (!pedido) throw new NotFoundError('Pedido nao encontrado', { code: 'PEDIDO_NOT_FOUND', domain: 'pedidos-comercial' });
    const { data: itens, error: ie } = await supabase.from('pedido_itens').select('*').eq('account_id', accountId).eq('pedido_id', id).order('created_at', { ascending: true }); if (ie) throw new DatabaseError('Falha ao buscar itens do pedido', { details: ie });
    const [pedidoComCliente] = await enrichPedidosWithClienteNome([pedido], accountId).catch(() => [pedido]);
    const [pedidoEnriquecido] = await enrichPedidosWithVendedorNome([pedidoComCliente || pedido], accountId).catch(() => [pedidoComCliente || pedido]);
    return { pedido: pedidoEnriquecido || pedidoComCliente || pedido, itens: itens || [] };
  }
  const pedido = memoryPedidos.find((i) => i.id === id && i.account_id === accountId); if (!pedido) throw new NotFoundError('Pedido nao encontrado', { code: 'PEDIDO_NOT_FOUND', domain: 'pedidos-comercial' });
  const [pedidoComCliente] = await enrichPedidosWithClienteNome([pedido], accountId).catch(() => [pedido]);
  const [pedidoEnriquecido] = await enrichPedidosWithVendedorNome([pedidoComCliente || pedido], accountId).catch(() => [pedidoComCliente || pedido]);
  return { pedido: pedidoEnriquecido || pedidoComCliente || pedido, itens: memoryPedidoItens.filter((i) => i.pedido_id === id && i.account_id === accountId) };
}

export async function updatePedidoVendedor(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const vendedorId = String(data?.vendedor_id || '').trim();
  if (!vendedorId) throw new BadRequestError('Vendedor obrigatorio', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  const { pedido } = await getPedidoById(id, { accountId });
  const vendedor = await getVendedorById(vendedorId, { accountId });
  if (!vendedor || String(vendedor.account_id || '') !== String(accountId)) throw new ForbiddenError('Vendedor invalido para o tenant', { code: 'TENANT_FORBIDDEN', domain: 'pedidos-comercial' });
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('pedidos').update({ vendedor_id: vendedorId }).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar vendedor do pedido', { details: error });
    return { item: updated };
  }
  const idx = memoryPedidos.findIndex((p) => p.id === id && p.account_id === accountId);
  memoryPedidos[idx] = { ...memoryPedidos[idx], vendedor_id: vendedorId };
  return { item: memoryPedidos[idx], pedido };
}

export async function createPedido(data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); assertItens(data.itens); const cliente = await getClienteById(data.cliente_id, { accountId, context: options.context });
  if (options.context && !canAccessAllTenantData(options.context) && cliente.owner_user_id !== getUserIdFromContext(options.context)) throw new ForbiddenError('Sem permissao para criar pedido para este cliente', { code: 'OWNER_SCOPE_FORBIDDEN', domain: 'pedidos-comercial' });
  const repositoryMode = getPedidosRepositoryMode();
  const itensEnriquecidos = [];
  for (const item of data.itens) {
    const produto = await getProdutoById(item.produto_id, { accountId });
    itensEnriquecidos.push({
      ...item,
      produto_nome: produto.nome,
      sku: produto.sku || null,
      preco_unitario: Number(produto.preco ?? produto.preco_unitario ?? 0)
    });
  }
  const totals = calculatePedidoTotals(itensEnriquecidos);
  const status = data.status || PEDIDO_STATUS.RASCUNHO;
  if (!isValidPedidoStatus(status)) throw new BadRequestError('Status do pedido invalido', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  const pedidoPayload = { account_id: accountId, cliente_id: data.cliente_id, numero: data.numero || null, status, origem: data.origem || 'manual', observacoes: data.observacoes || null, total: totals.total, metadata: data.metadata || {}, owner_user_id: cliente.owner_user_id || null, data_emissao: normalizeDateOnlyValue(data.data_emissao), data_faturamento: data.data_faturamento || null };
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: pedido, error: pe } = await supabase.from('pedidos').insert(pedidoPayload).select('*').single(); if (pe) throw new DatabaseError('Falha ao criar pedido', { details: pe });
    const itensPayload = totals.itensCalculados.map((item) => ({ account_id: accountId, pedido_id: pedido.id, produto_id: item.produto_id, produto_nome: item.produto_nome, sku: item.sku || null, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto, subtotal: item.subtotal, total: item.total, metadata: item.metadata || {} }));
    const { data: itens, error: ie } = await supabase.from('pedido_itens').insert(itensPayload).select('*'); if (ie) throw new DatabaseError('Falha ao criar itens do pedido', { details: ie });
    return { pedido, itens: itens || [] };
  }
  const createdAt = typeof data?.metadata?.createdAt === 'string' ? data.metadata.createdAt : new Date().toISOString();
  const pedido = { id: randomUUID(), ...pedidoPayload, createdAt };
  const itens = totals.itensCalculados.map((item) => ({ id: randomUUID(), account_id: accountId, pedido_id: pedido.id, produto_id: item.produto_id, produto_nome: item.produto_nome, sku: item.sku || null, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto, subtotal: item.subtotal, total: item.total, metadata: item.metadata || {}, createdAt: new Date().toISOString() }));
  memoryPedidos.push(pedido); memoryPedidoItens.push(...itens); return { pedido, itens };
}

export async function createPedidoFromImport(data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const cliente = await getClienteById(data.cliente_id, { accountId, context: options.context });
  const repositoryMode = getPedidosRepositoryMode();
  const status = isValidPedidoStatus(data.status) ? String(data.status).toLowerCase() : PEDIDO_STATUS.RASCUNHO;
  const payload = {
    account_id: accountId,
    cliente_id: cliente.id,
    numero: data.numero || null,
    status,
    origem: data.origem || 'importacao',
    observacoes: data.observacoes || null,
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : 0,
    metadata: data.metadata || {},
    data_emissao: normalizeDateOnlyValue(data.data_emissao)
  };

  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('pedidos').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar pedido importado', { details: error });
    return { pedido: inserted, itens: [] };
  }

  const pedido = { id: randomUUID(), ...payload, data_faturamento: null, createdAt: new Date().toISOString() };
  memoryPedidos.push(pedido);
  return { pedido, itens: [] };
}

export async function updatePedidoStatus(id, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const nextStatus = String(data.status || '').toLowerCase();
  if (!isValidPedidoStatus(nextStatus)) throw new BadRequestError('Status invalido', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  const { pedido } = await getPedidoById(id, { accountId });
  const prev = String(pedido.status || '').toLowerCase();
  if (!canTransitionPedidoStatus(prev, nextStatus)) throw new BadRequestError('Transicao de status invalida', { code: 'INVALID_STATUS_TRANSITION', domain: 'pedidos-comercial', details: { from: prev, to: nextStatus } });
  const event = { id: randomUUID(), account_id: accountId, pedido_id: id, status_anterior: prev, status_novo: nextStatus, motivo: data.motivo || null, alterado_por: options.context?.auth?.userId || null, metadata: {}, created_at: new Date().toISOString() };
  const audit = createPedidoAuditEvent({ context: options.context, pedidoId: id, action: 'pedido.status.updated', statusAnterior: prev, statusNovo: nextStatus, motivo: data.motivo || null });
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error: ue } = await supabase.from('pedidos').update({ status: nextStatus }).eq('id', id).eq('account_id', accountId).select('*').single(); if (ue) throw new DatabaseError('Falha ao atualizar status do pedido', { details: ue });
    const { error: he } = await supabase.from('pedido_status_history').insert({ account_id: accountId, pedido_id: id, status_anterior: prev, status_novo: nextStatus, motivo: data.motivo || null, alterado_por: options.context?.auth?.userId || null, metadata: {} }); if (he) throw new DatabaseError('Falha ao registrar historico de status', { details: he });
    return { item: updated, audit };
  }
  const idx = memoryPedidos.findIndex((p) => p.id === id && p.account_id === accountId); memoryPedidos[idx] = { ...memoryPedidos[idx], status: nextStatus }; memoryPedidoStatusHistory.push(event);
  return { item: memoryPedidos[idx], audit };
}

export async function updatePedidoItens(id, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const itens = Array.isArray(data?.itens) ? data.itens : null;
  assertItens(itens);
  const { pedido } = await getPedidoById(id, { accountId });

  const itensEnriquecidos = [];
  for (const item of itens) {
    const quantidade = Number(item?.quantidade ?? 0);
    if (!Number.isFinite(quantidade) || quantidade <= 0) throw new BadRequestError('Quantidade do item invalida', { code: 'PEDIDO_ITEM_INVALID', domain: 'pedidos-comercial' });
    const produto = await getProdutoById(item?.produto_id, { accountId });
    itensEnriquecidos.push({
      produto_id: item.produto_id,
      produto_nome: produto.nome,
      sku: produto.sku || null,
      quantidade,
      preco_unitario: Number(produto.preco ?? produto.preco_unitario ?? 0),
      desconto: Number(item?.desconto ?? 0),
      metadata: item?.metadata || {}
    });
  }

  const totals = calculatePedidoTotals(itensEnriquecidos);
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { error: deleteError } = await supabase.from('pedido_itens').delete().eq('account_id', accountId).eq('pedido_id', id);
    if (deleteError) throw new DatabaseError('Falha ao atualizar itens do pedido', { details: deleteError });
    const itensPayload = totals.itensCalculados.map((item) => ({ account_id: accountId, pedido_id: id, produto_id: item.produto_id, produto_nome: item.produto_nome, sku: item.sku || null, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto, subtotal: item.subtotal, total: item.total, metadata: item.metadata || {} }));
    const { data: createdItens, error: insertError } = await supabase.from('pedido_itens').insert(itensPayload).select('*');
    if (insertError) throw new DatabaseError('Falha ao salvar itens do pedido', { details: insertError });
    const { data: updatedPedido, error: updateError } = await supabase.from('pedidos').update({ total: totals.total }).eq('id', id).eq('account_id', accountId).select('*').single();
    if (updateError) throw new DatabaseError('Falha ao recalcular totais do pedido', { details: updateError });
    return { pedido: updatedPedido, itens: createdItens || [] };
  }

  const nextItens = totals.itensCalculados.map((item) => ({ id: randomUUID(), account_id: accountId, pedido_id: id, produto_id: item.produto_id, produto_nome: item.produto_nome, sku: item.sku || null, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto, subtotal: item.subtotal, total: item.total, metadata: item.metadata || {}, createdAt: new Date().toISOString() }));
  for (let i = memoryPedidoItens.length - 1; i >= 0; i -= 1) { if (memoryPedidoItens[i].account_id === accountId && memoryPedidoItens[i].pedido_id === id) memoryPedidoItens.splice(i, 1); }
  memoryPedidoItens.push(...nextItens);
  const pedidoIdx = memoryPedidos.findIndex((p) => p.id === id && p.account_id === accountId);
  memoryPedidos[pedidoIdx] = { ...memoryPedidos[pedidoIdx], total: totals.total };
  return { pedido: memoryPedidos[pedidoIdx], itens: nextItens };
}

export async function updatePedido(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getPedidoById(id, { accountId });
  await getClienteById(data.cliente_id, { accountId });

  const payload = {
    cliente_id: data.cliente_id,
    origem: data.origem,
    observacoes: data.observacoes || null,
    updated_at: new Date().toISOString()
  };

  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('pedidos').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar pedido', { details: error });
    const { data: itens, error: itensError } = await supabase.from('pedido_itens').select('*').eq('account_id', accountId).eq('pedido_id', id).order('created_at', { ascending: true });
    if (itensError) throw new DatabaseError('Falha ao buscar itens do pedido', { details: itensError });
    return { pedido: updated, itens: itens || [] };
  }

  const idx = memoryPedidos.findIndex((p) => p.id === id && p.account_id === accountId);
  memoryPedidos[idx] = { ...memoryPedidos[idx], ...payload, updatedAt: payload.updated_at };
  return { pedido: memoryPedidos[idx], itens: memoryPedidoItens.filter((i) => i.account_id === accountId && i.pedido_id === id) };
}

export async function updatePedidoComissao(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payload = {
    comissao_principal_percentual: normalizeCommissionValue(data.comissao_principal_percentual),
    comissao_preposto_percentual: normalizeCommissionValue(data.comissao_preposto_percentual)
  };
  const nextPayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
  await getPedidoById(id, { accountId });
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('pedidos').update(nextPayload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar comissao do pedido', { details: error });
    return { item: updated };
  }
  const idx = memoryPedidos.findIndex((p) => p.id === id && p.account_id === accountId);
  memoryPedidos[idx] = { ...memoryPedidos[idx], ...nextPayload };
  return { item: memoryPedidos[idx] };
}

export async function updatePedidoFaturamento(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const dataFaturamento = normalizeDateValue(data.data_faturamento);
  await getPedidoById(id, { accountId });
  const payload = { data_faturamento: dataFaturamento, status: 'faturado_total' };
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: updated, error } = await supabase.from('pedidos').update(payload).eq('id', id).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar faturamento do pedido', { details: error });
    return { item: updated };
  }
  const idx = memoryPedidos.findIndex((p) => p.id === id && p.account_id === accountId);
  memoryPedidos[idx] = { ...memoryPedidos[idx], ...payload };
  return { item: memoryPedidos[idx] };
}

export async function getPedidoStatusHistory(id, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await getPedidoById(id, { accountId });
  if (getPedidosRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('pedido_status_history').select('*').eq('account_id', accountId).eq('pedido_id', id).order('created_at', { ascending: false }); if (error) throw new DatabaseError('Falha ao buscar historico de status', { details: error });
    return data || [];
  }
  return memoryPedidoStatusHistory.filter((i) => i.account_id === accountId && i.pedido_id === id);
}

export function __resetMemoryPedidosForTests() { memoryPedidos.length = 0; memoryPedidoItens.length = 0; memoryPedidoStatusHistory.length = 0; }
export function __seedMemoryClienteForTests(cliente) { return getClienteById(cliente.id, { accountId: cliente.account_id }).catch(async () => { const { createCliente } = await import('../clientes/clientes.repository.js'); await createCliente(cliente, { accountId: cliente.account_id }); }); }
export function __seedMemoryProdutoForTests(produto) { return getProdutoById(produto.id, { accountId: produto.account_id }).catch(async () => { const { createProduto } = await import('../produtos/produtos.repository.js'); await createProduto(produto, { accountId: produto.account_id }); }); }
export function __dumpMemoryPedidos() {
  return {
    pedidos: memoryPedidos.map((item) => ({ ...item })),
    pedidoItens: memoryPedidoItens.map((item) => ({ ...item })),
    pedidoStatusHistory: memoryPedidoStatusHistory.map((item) => ({ ...item }))
  };
}
export function __loadMemoryPedidos(snapshot = {}) {
  memoryPedidos.length = 0; memoryPedidoItens.length = 0; memoryPedidoStatusHistory.length = 0;
  for (const item of snapshot.pedidos || []) memoryPedidos.push({ ...item });
  for (const item of snapshot.pedidoItens || []) memoryPedidoItens.push({ ...item });
  for (const item of snapshot.pedidoStatusHistory || []) memoryPedidoStatusHistory.push({ ...item });
}

export function __setPedidosSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

