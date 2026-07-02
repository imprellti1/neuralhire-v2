import { ForbiddenError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { AnalyticsQueries } from '../../database/queries/analytics.queries.js';
import { createSqlBuilder } from '../../database/sql-builder.js';

const validStatuses = ['rascunho', 'enviado', 'aprovado', 'faturado', 'cancelado'];
const defaultLimit = 10;
const maxLimit = 100;

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'analytics-comercial' });
  }
}

function normalizePeriodFilters(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || defaultLimit, 1), maxLimit);
  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : null;
  return {
    limit,
    startDate: Number.isNaN(startDate?.getTime()) ? null : startDate,
    endDate: Number.isNaN(endDate?.getTime()) ? null : endDate
  };
}

function inPeriod(iso, startDate, endDate) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

function buildPedidoPeriodWhere(accountId, filters = {}, tableAlias = null) {
  const builder = createSqlBuilder();
  const prefix = tableAlias ? `${tableAlias}.` : '';
  builder.appendCondition(`${prefix}account_id = ${builder.nextParam(accountId)}`);
  if (filters.startDate) builder.appendCondition(`DATE(${prefix}created_at) >= ${builder.nextParam(filters.startDate.toISOString().slice(0, 10))}::date`);
  if (filters.endDate) builder.appendCondition(`DATE(${prefix}created_at) <= ${builder.nextParam(filters.endDate.toISOString().slice(0, 10))}::date`);
  return builder.toWhereClause();
}

function statusCountsFromRows(rows = []) {
  const counts = { rascunho: 0, enviado: 0, aprovado: 0, faturado: 0, cancelado: 0 };
  for (const row of rows) {
    const key = String(row.status || '').toLowerCase();
    if (validStatuses.includes(key)) counts[key] = Number(row.total || 0);
  }
  return counts;
}

function summarize(pedidos, clientes, produtos) {
  const totalPedidos = pedidos.length;
  const totalFaturado = pedidos.reduce((sum, pedido) => sum + Number(pedido.total || 0), 0);
  const ticketMedio = totalPedidos > 0 ? totalFaturado / totalPedidos : 0;
  const pedidosPorStatus = { rascunho: 0, enviado: 0, aprovado: 0, faturado: 0, cancelado: 0 };
  for (const pedido of pedidos) {
    const status = String(pedido.status || '').toLowerCase();
    if (validStatuses.includes(status)) pedidosPorStatus[status] += 1;
  }
  return {
    totalPedidos,
    totalFaturado,
    ticketMedio,
    pedidosPorStatus,
    totalClientesAtivos: clientes.filter((cliente) => cliente.ativo !== false).length,
    totalProdutosAtivos: produtos.filter((produto) => produto.ativo !== false).length
  };
}

async function fetchFallbackData(accountId, context) {
  const { listPedidos } = await import('../pedidos/pedidos.repository.js');
  const { listClientes } = await import('../clientes/clientes.repository.js');
  const { listProdutos } = await import('../produtos/produtos.repository.js');
  const pedidos = await listPedidos({ page: 1, limit: 100 }, { accountId, context });
  const clientes = await listClientes({ page: 1, limit: 100 }, { accountId, context });
  const produtos = await listProdutos({ page: 1, limit: 100 }, { accountId });
  const itens = [];
  for (const pedido of pedidos.items || []) {
    const full = await import('../pedidos/pedidos.repository.js').then((m) => m.getPedidoById(pedido.id, { accountId, context }));
    itens.push(...(full.itens || []));
  }
  return { pedidos: pedidos.items || [], itens, clientes: clientes.items || [], produtos: produtos.items || [] };
}

async function loadAnalyticsData(repo, accountId, filters = {}, options = {}) {
  const period = normalizePeriodFilters(filters);
  const where = buildPedidoPeriodWhere(accountId, period);
    try {
      const [metrics, statusRows, customersRow, productsRow] = await Promise.all([
        repo.one(AnalyticsQueries.summary(where.sql), where.params),
        repo.many(AnalyticsQueries.statusCounts(where.sql), where.params),
        repo.one(AnalyticsQueries.totalCustomers(), [accountId]),
        repo.one(AnalyticsQueries.totalProducts(), [accountId])
      ]);
    return {
      period,
      metrics,
      statusRows,
      customersRow,
      productsRow,
      fallback: null
    };
  } catch (error) {
    return {
      period,
      fallback: await fetchFallbackData(accountId, options.context)
    };
  }
}

class AnalyticsRepository extends BaseRepository {
  constructor(databaseAdapter) {
    super(databaseAdapter, { logContext: 'analytics-comercial' });
  }

  async getSummary(accountId, filters = {}) {
    assertAccountId(accountId);
    const loaded = await loadAnalyticsData(this, accountId, filters);
    if (loaded.fallback) {
      const { pedidos, clientes, produtos } = loaded.fallback;
      const scoped = pedidos.filter((x) => inPeriod(x.created_at || x.createdAt, loaded.period.startDate, loaded.period.endDate));
      return summarize(scoped, clientes, produtos);
    }
    const { metrics, statusRows, customersRow, productsRow } = loaded;
    return {
      totalPedidos: Number(metrics?.total_pedidos || 0),
      totalFaturado: Number(metrics?.total_faturado || 0),
      ticketMedio: Number(metrics?.ticket_medio || 0),
      pedidosPorStatus: statusCountsFromRows(statusRows),
      totalClientesAtivos: Number(customersRow?.total || 0),
      totalProdutosAtivos: Number(productsRow?.total || 0)
    };
  }

  async getTopProducts(accountId, filters = {}) {
    assertAccountId(accountId);
    const loaded = await loadAnalyticsData(this, accountId, filters);
    if (loaded.fallback) {
      const { pedidos, itens } = loaded.fallback;
      const ids = new Set(pedidos.filter((x) => inPeriod(x.created_at || x.createdAt, loaded.period.startDate, loaded.period.endDate)).map((x) => x.id));
      const map = new Map();
      for (const item of itens) {
        if (!ids.has(item.pedido_id)) continue;
        const key = item.produto_id;
        const curr = map.get(key) || { produto_id: key, produto_nome: item.produto_nome || null, quantidadeVendida: 0, totalVendido: 0, pedidosSet: new Set() };
        curr.quantidadeVendida += Number(item.quantidade || 0);
        curr.totalVendido += Number(item.total || 0);
        curr.pedidosSet.add(item.pedido_id);
        map.set(key, curr);
      }
      return [...map.values()].map((x) => ({ produto_id: x.produto_id, produto_nome: x.produto_nome, quantidadeVendida: x.quantidadeVendida, totalVendido: x.totalVendido, pedidos: x.pedidosSet.size })).sort((a, b) => b.totalVendido - a.totalVendido).slice(0, loaded.period.limit);
    }
    const period = loaded.period;
    const where = buildPedidoPeriodWhere(accountId, period, 'ped');
    return this.many(
      AnalyticsQueries.topProducts(where.sql, `$${where.params.length + 1}`),
      [...where.params, period.limit]
    ).then((rows) => rows.map((row) => ({
      produto_id: row.produto_id,
      produto_nome: row.produto_nome,
      quantidadeVendida: Number(row.quantidade_vendida || 0),
      totalVendido: Number(row.total_vendido || 0),
      pedidos: Number(row.pedidos || 0)
    })));
  }

  async getTopCustomers(accountId, filters = {}) {
    assertAccountId(accountId);
    const loaded = await loadAnalyticsData(this, accountId, filters);
    if (loaded.fallback) {
      const { pedidos, clientes } = loaded.fallback;
      const mapNames = new Map(clientes.map((c) => [c.id, c.nome]));
      const map = new Map();
      for (const pedido of pedidos) {
        if (!inPeriod(pedido.created_at || pedido.createdAt, loaded.period.startDate, loaded.period.endDate)) continue;
        const key = pedido.cliente_id;
        const curr = map.get(key) || { cliente_id: key, cliente_nome: mapNames.get(key) || null, pedidos: 0, totalComprado: 0 };
        curr.pedidos += 1;
        curr.totalComprado += Number(pedido.total || 0);
        map.set(key, curr);
      }
      return [...map.values()].map((x) => ({ ...x, ticketMedio: x.pedidos > 0 ? x.totalComprado / x.pedidos : 0 })).sort((a, b) => b.totalComprado - a.totalComprado).slice(0, loaded.period.limit);
    }
    const period = loaded.period;
    const where = buildPedidoPeriodWhere(accountId, period, 'ped');
    return this.many(
      AnalyticsQueries.topCustomers(where.sql, `$${where.params.length + 1}`),
      [...where.params, period.limit]
    ).then((rows) => rows.map((row) => ({
      cliente_id: row.cliente_id,
      cliente_nome: row.cliente_nome,
      pedidos: Number(row.pedidos || 0),
      totalComprado: Number(row.total_comprado || 0),
      ticketMedio: Number(row.pedidos || 0) > 0 ? Number(row.total_comprado || 0) / Number(row.pedidos || 0) : 0
    })));
  }

  async getSalesTimeline(accountId, filters = {}) {
    assertAccountId(accountId);
    const loaded = await loadAnalyticsData(this, accountId, filters);
    if (loaded.fallback) {
      const map = new Map();
      for (const pedido of loaded.fallback.pedidos) {
        const created = pedido.created_at || pedido.createdAt;
        if (!inPeriod(created, loaded.period.startDate, loaded.period.endDate)) continue;
        const date = new Date(created).toISOString().slice(0, 10);
        const curr = map.get(date) || { date, pedidos: 0, total: 0 };
        curr.pedidos += 1;
        curr.total += Number(pedido.total || 0);
        map.set(date, curr);
      }
      return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    }
    const period = loaded.period;
    const where = buildPedidoPeriodWhere(accountId, period);
    return this.many(
      AnalyticsQueries.salesTimeline(where.sql),
      where.params
    ).then((rows) => rows.map((row) => ({
      date: String(row.date),
      pedidos: Number(row.pedidos || 0),
      total: Number(row.total || 0)
    })));
  }
}

const repository = new AnalyticsRepository(database);
let repositoryOverride = null;

function resolveRepository() {
  return repositoryOverride || repository;
}

export function __setAnalyticsDatabaseForTests(adapter) {
  repositoryOverride = adapter instanceof AnalyticsRepository ? adapter : new AnalyticsRepository(adapter);
}

export function __resetAnalyticsRepositoryForTests() {
  repositoryOverride = null;
}

export function getAnalyticsRepositoryMode() {
  return { mode: 'database', supabaseConfigured: false };
}

export async function getAnalyticsSummary(filters = {}, options = {}) {
  return resolveRepository().getSummary(options.accountId || null, filters);
}

export async function getTopProducts(filters = {}, options = {}) {
  return resolveRepository().getTopProducts(options.accountId || null, filters);
}

export async function getTopCustomers(filters = {}, options = {}) {
  return resolveRepository().getTopCustomers(options.accountId || null, filters);
}

export async function getSalesTimeline(filters = {}, options = {}) {
  return resolveRepository().getSalesTimeline(options.accountId || null, filters);
}

export function __createAnalyticsRepositoryForTests(adapter) {
  return new AnalyticsRepository(adapter);
}
