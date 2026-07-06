import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { createPedidoAuditEvent } from '../../core/audit.js';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { canAccessAllTenantData, getUserIdFromContext } from '../../core/commercial-scope.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { PedidosQueries } from '../../database/queries/pedidos.queries.js';
import { getClienteById } from '../clientes/clientes.repository.js';
import { getProdutoById } from '../produtos/produtos.repository.js';
import { findVendedorById, findVendedorByIdAnyAccount, getVendedorById } from '../vendedores/vendedores.repository.js';
import { canTransitionPedidoStatus, isValidPedidoStatus, PEDIDO_STATUS } from './pedidos.schemas.js';

const memoryPedidos = [];
const memoryPedidoItens = [];
const memoryPedidoStatusHistory = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;
let databaseModeCache = null;

class PedidosRepository extends BaseRepository {
  constructor(adapter = database) {
    super(adapter, { logContext: 'pedidos' });
  }
}

const pedidosRepository = new PedidosRepository();

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

async function isDatabaseMode() {
  if (databaseModeCache !== null) return databaseModeCache;
  try {
    await pedidosRepository.one(PedidosQueries.ping(), []);
    databaseModeCache = true;
  } catch (error) {
    databaseModeCache = false;
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') {
      debugRepository('databaseModeProbeFailed', { message: error?.message || null, code: error?.code || null });
    }
  }
  return databaseModeCache;
}

function debugRepository(action, payload) { if (env.NODE_ENV !== 'production') console.debug(`[pedidos.repository] ${action}`, payload); }
const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'pedidos-comercial', details: { reason: 'account_id_missing' } }); }
function normalizePagination(filters = {}) { const page = Number.isFinite(filters.page) && filters.page > 0 ? Math.floor(filters.page) : 1; const rawLimit = Number.isFinite(filters.limit) && filters.limit > 0 ? Math.floor(filters.limit) : 20; return { page, limit: Math.min(rawLimit, 100) }; }
function assertItens(itens) { if (!Array.isArray(itens) || itens.length === 0) throw new BadRequestError('Pedido precisa de pelo menos um item', { code: 'PEDIDO_ITENS_REQUIRED', domain: 'pedidos-comercial' }); }
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
function toIsoDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}
function parseBrDateText(text) {
  const match = String(text || '').trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? Number(`20${y}`) : Number(y);
  if (!Number.isInteger(year)) return null;
  const day = Number(d);
  const month = Number(m);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.toISOString().slice(0, 10);
}
function resolveClienteDisplayName(cliente = {}, fallback = null) {
  const nome = cliente?.nome || cliente?.codigo || fallback || null;
  const normalized = String(nome || '').trim();
  if (!normalized) return fallback || null;
  if (isUuid(normalized)) return fallback || null;
  return normalized;
}
function resolveClienteAuditDisplayName(cliente = {}, fallback = null) {
  const candidates = [
    cliente?.razao_social,
    cliente?.nome_fantasia,
    cliente?.nome,
    cliente?.codigo,
    fallback
  ];
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (!normalized) continue;
    if (isUuid(normalized)) continue;
    return normalized;
  }
  return fallback || null;
}
function resolveClienteAuditCodigo(cliente = {}) {
  const normalized = String(cliente?.codigo || '').trim();
  return normalized || null;
}
function normalizeDateOnlyValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return toIsoDateOnly(value);
  if (typeof value === 'number') {
    const excelEpoch = Math.round((value - 25569) * 86400 * 1000);
    if (!Number.isFinite(excelEpoch)) return null;
    const date = new Date(excelEpoch);
    return toIsoDateOnly(date);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return parseBrDateText(text);
}

function buildPedidoItensInsertParams(accountId, pedidoId, itensCalculados = []) {
  return itensCalculados.flatMap((item) => ([
    accountId,
    pedidoId,
    item.produto_id,
    item.produto_nome,
    item.sku || null,
    item.quantidade,
    item.preco_unitario,
    item.desconto,
    item.subtotal,
    item.total,
    item.metadata || {}
  ]));
}
async function enrichPedidosWithVendedorNome(items = [], accountId) {
  if (!Array.isArray(items) || !items.length) return [];
  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = resolveSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
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

async function loadRowsByIds(table, ids = [], accountId) {
  const uniqueIds = [...new Set(ids.map((value) => String(value || '').trim()).filter(Boolean))];
  if (!uniqueIds.length) return [];
  const query = table === 'clientes' ? PedidosQueries.listClientesByIds() : PedidosQueries.listVendedoresByIds();
  const rows = await pedidosRepository.many(query, [accountId, uniqueIds]).catch((error) => {
    if (error?.code === 'DATABASE_NOT_ONE') return [];
    throw error;
  });
  return Array.isArray(rows) ? rows : [];
}

async function enrichPedidosWithClienteNome(items = [], accountId) {
  if (!Array.isArray(items) || !items.length) return [];
  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = resolveSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const clienteIds = [...new Set(items.map((i) => i?.cliente_id).filter(Boolean))];
    if (!clienteIds.length) return items.map((item) => ({ ...item, cliente_nome: null, cliente: null }));
    try {
      const { data, error } = await supabase.from('clientes').select('id, nome').eq('account_id', accountId).in('id', clienteIds);
      if (error) throw new DatabaseError('Falha ao enriquecer pedidos com cliente', { details: error });
      const byId = new Map((data || []).map((c) => [c.id, c]));
      return items.map((item) => {
        const cliente = byId.get(item?.cliente_id);
        return cliente
          ? { ...item, cliente_nome: resolveClienteDisplayName(cliente, null), cliente: { id: cliente.id, nome: resolveClienteDisplayName(cliente, null) } }
          : { ...item, cliente_nome: null, cliente: null };
      });
    } catch {
      return items.map((item) => ({ ...item, cliente_nome: null, cliente: null }));
    }
  }

  const byId = new Map();
  for (const item of items) {
    const clienteId = item?.cliente_id;
    if (!clienteId || byId.has(clienteId)) continue;
    try {
      const cliente = await getClienteById(clienteId, { accountId });
      byId.set(clienteId, cliente ? resolveClienteDisplayName(cliente, null) : null);
    } catch {
      byId.set(clienteId, null);
    }
  }
  return items.map((item) => {
    const clienteNome = byId.get(item?.cliente_id) ?? null;
    return clienteNome ? { ...item, cliente_nome: clienteNome, cliente: { id: item?.cliente_id || null, nome: clienteNome } } : { ...item, cliente_nome: null, cliente: null };
  });
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
  const totalItens = round2(itensCalculados.reduce((a, i) => a + i.subtotal, 0));
  return { total: totalItens, itensCalculados };
}

export function getPedidosRepositoryMode() { const supabaseConfigured = resolveSupabaseConfigured(); return { mode: supabaseConfigured ? 'supabase' : 'memory', supabaseConfigured }; }

export async function listPedidos(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const { page, limit } = normalizePagination(filters);
  const scopedFilters = { ...filters };
  const repositoryMode = getPedidosRepositoryMode();
  debugRepository('listPedidos', { repositoryMode, accountId, filters });

  if (supabaseClientOverride || await isDatabaseMode()) {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
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
    if (scopedFilters.status) query = query.eq('status', scopedFilters.status);
    if (scopedFilters.cliente_id) query = query.eq('cliente_id', scopedFilters.cliente_id);
    if (scopedFilters.vendedor_id) query = query.eq('vendedor_id', scopedFilters.vendedor_id);
    const from = (page - 1) * limit;
    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) {
      logger.error('pedidos_list_supabase_failed', {
        code: error?.code || null,
        details: error?.details || null,
        hint: error?.hint || null,
        rawMessage: error?.message || null
      });
      throw new DatabaseError('Falha ao listar pedidos', { details: error });
    }
    const total = count || 0;
    const enrichedItems = await enrichPedidosWithClienteNome(data || [], accountId).catch(() => (data || []).map((item) => ({ ...item, cliente_nome: null, cliente: null })));
    return { items: enrichedItems, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  if (supabaseClientOverride || await isDatabaseMode()) {
    const where = [];
    if (scopedFilters.status) where.push(`status = '${String(scopedFilters.status).replace(/'/g, "''")}'`);
    if (scopedFilters.cliente_id) where.push(`cliente_id = '${String(scopedFilters.cliente_id).replace(/'/g, "''")}'`);
    if (scopedFilters.vendedor_id) where.push(`vendedor_id = '${String(scopedFilters.vendedor_id).replace(/'/g, "''")}'`);
    const whereSql = where.join(' AND ');
    const from = (page - 1) * limit;
    const [countRow, items] = await Promise.all([
      pedidosRepository.one(PedidosQueries.count(whereSql ? `account_id = $1 AND ${whereSql}` : 'account_id = $1'), [accountId]).catch((error) => {
        if (error?.code === 'DATABASE_NOT_ONE') return { total: 0 };
        throw error;
      }),
      pedidosRepository.many(PedidosQueries.list(whereSql), [accountId, limit, from])
    ]);
    const clienteRows = await loadRowsByIds('clientes', (items || []).map((item) => item.cliente_id), accountId).catch(() => []);
    const vendedorRows = await loadRowsByIds('vendedores', (items || []).map((item) => item.vendedor_id), accountId).catch(() => []);
    const clientesById = new Map(clienteRows.map((row) => [row.id, row]));
    const vendedoresById = new Map(vendedorRows.map((row) => [row.id, row]));
    const enrichedItems = (items || []).map((item) => {
      const cliente = clientesById.get(item.cliente_id);
      const vendedor = vendedoresById.get(item.vendedor_id);
      return {
        ...item,
        cliente_nome: resolveClienteDisplayName(cliente, null),
        cliente: cliente ? { id: cliente.id, nome: resolveClienteDisplayName(cliente, null) } : null,
        vendedor_nome: vendedor?.nome || null,
        vendedor: vendedor ? { id: vendedor.id, nome: vendedor.nome || null } : null
      };
    });
    const total = Number(countRow?.total || 0);
    return { items: enrichedItems, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  let memoryItems = memoryPedidos.filter((i) => i.account_id === accountId);
  if (scopedFilters.status) memoryItems = memoryItems.filter((i) => i.status === scopedFilters.status);
  if (scopedFilters.cliente_id) memoryItems = memoryItems.filter((i) => i.cliente_id === scopedFilters.cliente_id);
  if (scopedFilters.vendedor_id) memoryItems = memoryItems.filter((i) => String(i.vendedor_id || '') === String(scopedFilters.vendedor_id));
  const total = memoryItems.length;
  const from = (page - 1) * limit;
  const pagedItems = memoryItems.slice(from, from + limit);
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

function buildPedidoIssues(pedido = {}, itensStats = 0) {
  const itensCount = Number(itensStats?.total ?? itensStats ?? 0);
  const itensNaoVinculados = Number(itensStats?.nao_vinculados ?? 0);
  const issues = [];
  const principal = Number(pedido?.comissao_principal_percentual);
  const preposto = Number(pedido?.comissao_preposto_percentual);
  if ((!Number.isFinite(principal) || principal <= 0) && (!Number.isFinite(preposto) || preposto <= 0)) issues.push('sem_comissao');
  if (!Number.isFinite(Number(itensCount)) || Number(itensCount) <= 0) issues.push('sem_itens');
  else if (itensNaoVinculados > 0) issues.push('itens_nao_vinculados');
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
    const { data, error } = await supabase.from('pedido_itens').select('pedido_id, status_vinculo', { count: 'exact' }).eq('account_id', accountId).in('pedido_id', pedidoIds);
    if (error) throw new DatabaseError('Falha ao contar itens dos pedidos', { details: error });
    const counts = new Map();
    for (const pedidoId of pedidoIds) counts.set(pedidoId, 0);
    for (const row of data || []) {
      const current = counts.get(row.pedido_id) || { total: 0, nao_vinculados: 0 };
      current.total += 1;
      if (String(row.status_vinculo || '') !== 'vinculado') current.nao_vinculados += 1;
      counts.set(row.pedido_id, current);
    }
    return counts;
  }
  const counts = new Map();
  for (const item of items) {
    const rows = memoryPedidoItens.filter((pi) => pi.account_id === accountId && pi.pedido_id === item.id);
    counts.set(item.id, { total: rows.length, nao_vinculados: rows.filter((pi) => String(pi.status_vinculo || '') !== 'vinculado').length });
  }
  return counts;
}

export async function listPedidosAuditoria(filters = {}, options = {}) {
  const result = await listPedidos(filters, options);
  const accountId = options.accountId || null;
  const counts = await getPedidoItensCounts(result.items || [], accountId);
  const pedidosWithIssues = [];
  for (const pedido of result.items || []) {
    let clienteNomeAudit = pedido?.cliente_nome || null;
    let clienteCodigoAudit = null;
    if (pedido?.cliente_id) {
      try {
        const cliente = await getClienteById(pedido.cliente_id, { accountId });
        clienteNomeAudit = resolveClienteAuditDisplayName(cliente, clienteNomeAudit);
        clienteCodigoAudit = resolveClienteAuditCodigo(cliente);
      } catch {
        clienteNomeAudit = resolveClienteAuditDisplayName({ nome: pedido?.cliente_nome }, clienteNomeAudit);
      }
    }
    pedidosWithIssues.push({
      ...pedido,
      cliente_nome: clienteNomeAudit,
      cliente_codigo: clienteCodigoAudit,
      itens_count: counts.get(pedido.id)?.total || 0,
      itens_nao_vinculados: counts.get(pedido.id)?.nao_vinculados || 0,
      issues: buildPedidoIssues(pedido, counts.get(pedido.id) || {})
    });
  }
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
  if (supabaseClientOverride || await isDatabaseMode()) {
    const supabase = resolveSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: pedido, error: pe } = await supabase.from('pedidos').select('*').eq('account_id', accountId).eq('id', id).maybeSingle(); if (pe) throw new DatabaseError('Falha ao buscar pedido', { details: pe }); if (!pedido) throw new NotFoundError('Pedido nao encontrado', { code: 'PEDIDO_NOT_FOUND', domain: 'pedidos-comercial' });
    const { data: itens, error: ie } = await supabase.from('pedido_itens').select('*').eq('account_id', accountId).eq('pedido_id', id).order('created_at', { ascending: true }); if (ie) throw new DatabaseError('Falha ao buscar itens do pedido', { details: ie });
    const [pedidoComCliente] = await enrichPedidosWithClienteNome([pedido], accountId).catch(() => [{ ...pedido, cliente_nome: null, cliente: null }]);
    const [pedidoEnriquecido] = await enrichPedidosWithVendedorNome([pedidoComCliente || { ...pedido, cliente_nome: null, cliente: null }], accountId).catch(() => [pedidoComCliente || { ...pedido, cliente_nome: null, cliente: null }]);
    return { pedido: pedidoEnriquecido || pedidoComCliente || pedido, itens: itens || [] };
  }
  if (await isDatabaseMode()) {
    const pedido = await pedidosRepository.one(PedidosQueries.getById(), [accountId, id]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw error;
    });
    if (!pedido) throw new NotFoundError('Pedido nao encontrado', { code: 'PEDIDO_NOT_FOUND', domain: 'pedidos-comercial' });
    const itens = await pedidosRepository.many(PedidosQueries.listItensByPedidoId(), [accountId, id]);
    const clienteRows = await loadRowsByIds('clientes', [pedido.cliente_id], accountId).catch(() => []);
    const vendedorRows = await loadRowsByIds('vendedores', [pedido.vendedor_id], accountId).catch(() => []);
    const cliente = clienteRows[0] || null;
    const vendedor = vendedorRows[0] || null;
    return {
      pedido: {
        ...pedido,
        cliente_nome: resolveClienteDisplayName(cliente, null),
        cliente: cliente ? { id: cliente.id, nome: resolveClienteDisplayName(cliente, null) } : null,
        vendedor_nome: vendedor?.nome || null,
        vendedor: vendedor ? { id: vendedor.id, nome: vendedor.nome || null } : null
      },
      itens: itens || []
    };
  }
  const pedido = memoryPedidos.find((i) => i.id === id && i.account_id === accountId);
  if (!pedido) throw new NotFoundError('Pedido nao encontrado', { code: 'PEDIDO_NOT_FOUND', domain: 'pedidos-comercial' });
  const [pedidoComCliente] = await enrichPedidosWithClienteNome([pedido], accountId).catch(() => [{ ...pedido, cliente_nome: null, cliente: null }]);
  const [pedidoEnriquecido] = await enrichPedidosWithVendedorNome([pedidoComCliente || { ...pedido, cliente_nome: null, cliente: null }], accountId).catch(() => [pedidoComCliente || { ...pedido, cliente_nome: null, cliente: null }]);
  return { pedido: pedidoEnriquecido || pedidoComCliente || pedido, itens: memoryPedidoItens.filter((i) => i.pedido_id === id && i.account_id === accountId) };
}

export async function updatePedidoVendedor(id, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const vendedorId = String(data?.vendedor_id || '').trim();
  if (!vendedorId) throw new BadRequestError('Vendedor obrigatorio', { code: 'VALIDATION_ERROR', domain: 'pedidos-comercial' });
  const { pedido } = await getPedidoById(id, { accountId });
  const vendedor = await findVendedorById(vendedorId, { accountId });
  if (!vendedor) {
    const vendedorExistsElsewhere = await findVendedorByIdAnyAccount(vendedorId, { accountId });
    if (vendedorExistsElsewhere) throw new ForbiddenError('Vendedor invalido para o tenant', { code: 'TENANT_FORBIDDEN', domain: 'pedidos-comercial' });
    throw new NotFoundError('Vendedor nao encontrado', { code: 'VENDEDOR_NOT_FOUND', domain: 'pedidos-comercial' });
  }
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
  const pedidoPayload = { account_id: accountId, cliente_id: data.cliente_id, vendedor_id: data.vendedor_id || null, numero: data.numero || null, status, origem: data.origem || 'manual', observacoes: data.observacoes || null, total: totals.total, metadata: data.metadata || {}, owner_user_id: cliente.owner_user_id || null, data_emissao: normalizeDateOnlyValue(data.data_emissao), data_faturamento: data.data_faturamento || null };
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: pedido, error: pe } = await supabase.from('pedidos').insert(pedidoPayload).select('*').single(); if (pe) throw new DatabaseError('Falha ao criar pedido', { details: pe });
    const itensPayload = totals.itensCalculados.map((item) => ({ account_id: accountId, pedido_id: pedido.id, produto_id: item.produto_id, produto_nome: item.produto_nome, sku: item.sku || null, quantidade: item.quantidade, preco_unitario: item.preco_unitario, desconto: item.desconto, subtotal: item.subtotal, total: item.total, metadata: item.metadata || {} }));
    const { data: itens, error: ie } = await supabase.from('pedido_itens').insert(itensPayload).select('*'); if (ie) throw new DatabaseError('Falha ao criar itens do pedido', { details: ie });
    return { pedido, itens: itens || [] };
  }
  if (supabaseClientOverride || await isDatabaseMode()) {
    return pedidosRepository.transaction(async (tx) => {
      const pedido = await tx.one(PedidosQueries.insertPedido(), [
        accountId,
        pedidoPayload.cliente_id,
        pedidoPayload.vendedor_id,
        pedidoPayload.numero,
        pedidoPayload.status,
        pedidoPayload.origem,
        pedidoPayload.observacoes,
        pedidoPayload.total,
        pedidoPayload.metadata,
        pedidoPayload.owner_user_id,
        pedidoPayload.data_emissao,
        pedidoPayload.data_faturamento
      ]);
      const itens = [];
      for (const item of totals.itensCalculados) {
        const createdItem = await tx.one(PedidosQueries.insertPedidoItem(), [
          accountId,
          pedido.id,
          item.produto_id,
          item.produto_nome,
          item.sku || null,
          item.quantidade,
          item.preco_unitario,
          item.desconto,
          item.subtotal,
          item.total,
          item.metadata || {}
        ]);
        itens.push(createdItem);
      }
      return { pedido, itens };
    });
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
  if (supabaseClientOverride || await isDatabaseMode()) {
    const updated = await pedidosRepository.one(PedidosQueries.updateStatus(), [accountId, id, nextStatus]);
    await pedidosRepository.one(PedidosQueries.insertStatusHistory(), [accountId, id, prev, nextStatus, data.motivo || null, options.context?.auth?.userId || null, {}]);
    return { item: updated, audit };
  }
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

  if (supabaseClientOverride || await isDatabaseMode()) {
    const updated = await pedidosRepository.transaction(async (tx) => {
      await tx.execute(PedidosQueries.deleteItensByPedidoId(), [accountId, id]);
      const createdItens = [];
      for (const item of totals.itensCalculados) {
        const created = await tx.one(PedidosQueries.insertPedidoItem(), [
          accountId,
          id,
          item.produto_id,
          item.produto_nome,
          item.sku || null,
          item.quantidade,
          item.preco_unitario,
          item.desconto,
          item.subtotal,
          item.total,
          item.metadata || {}
        ]);
        createdItens.push(created);
      }
      const updatedPedido = await tx.one(PedidosQueries.updateTotal(), [accountId, id, totals.total]);
      return { pedido: updatedPedido, itens: createdItens || [] };
    });
    return updated;
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
  if (supabaseClientOverride || await isDatabaseMode()) {
    const rows = await pedidosRepository.many(PedidosQueries.listStatusHistoryByPedidoId(), [accountId, id]);
    return rows || [];
  }
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

