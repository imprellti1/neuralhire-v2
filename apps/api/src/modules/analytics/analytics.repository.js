import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'analytics-comercial' }); }
const memoryStatus = ['rascunho', 'enviado', 'aprovado', 'faturado', 'cancelado'];

function parseFilters(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 10, 1), 100);
  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : null;
  return { limit, startDate: Number.isNaN(startDate?.getTime()) ? null : startDate, endDate: Number.isNaN(endDate?.getTime()) ? null : endDate };
}

function inPeriod(iso, startDate, endDate) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  if (startDate && d < startDate) return false;
  if (endDate && d > endDate) return false;
  return true;
}

function summarize(pedidos, clientes, produtos) {
  const totalPedidos = pedidos.length;
  const totalFaturado = pedidos.reduce((a, p) => a + Number(p.total || 0), 0);
  const ticketMedio = totalPedidos > 0 ? totalFaturado / totalPedidos : 0;
  const pedidosPorStatus = { rascunho: 0, enviado: 0, aprovado: 0, faturado: 0, cancelado: 0 };
  for (const p of pedidos) { const s = String(p.status || '').toLowerCase(); if (memoryStatus.includes(s)) pedidosPorStatus[s] += 1; }
  return { totalPedidos, totalFaturado, ticketMedio, pedidosPorStatus, totalClientesAtivos: clientes.filter((c) => c.ativo !== false).length, totalProdutosAtivos: produtos.filter((p) => p.ativo !== false).length };
}

export function getAnalyticsRepositoryMode() { return { mode: isSupabaseConfigured() ? 'supabase' : 'memory', supabaseConfigured: isSupabaseConfigured() }; }

async function fetchData(accountId, context) {
  if (getAnalyticsRepositoryMode().mode === 'supabase') {
    const supabase = getSupabaseClient(); if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const [{ data: pedidos, error: pErr }, { data: itens, error: iErr }, { data: clientes, error: cErr }, { data: produtos, error: prErr }] = await Promise.all([
      supabase.from('pedidos').select('id,account_id,cliente_id,status,total,created_at').eq('account_id', accountId),
      supabase.from('pedido_itens').select('pedido_id,produto_id,produto_nome,quantidade,total').eq('account_id', accountId),
      supabase.from('clientes').select('id,nome,ativo').eq('account_id', accountId),
      supabase.from('produtos').select('id,nome,ativo').eq('account_id', accountId)
    ]);
    const supabaseError = pErr || iErr || cErr || prErr;
    if (supabaseError) {
      logger.error({
        message: 'analytics_fetch_failed',
        supabaseMessage: supabaseError?.message,
        supabaseCode: supabaseError?.code,
        supabaseDetails: supabaseError?.details,
        supabaseHint: supabaseError?.hint,
        stack: supabaseError?.stack
      });
      throw new DatabaseError('Falha ao carregar dados analytics', { details: supabaseError });
    }
    return { pedidos: pedidos || [], itens: itens || [], clientes: clientes || [], produtos: produtos || [] };
  }

  const { listPedidos } = await import('../pedidos/pedidos.repository.js');
  const { listClientes } = await import('../clientes/clientes.repository.js');
  const { listProdutos } = await import('../produtos/produtos.repository.js');
  let pedidos = await listPedidos({ page: 1, limit: 100 }, { accountId, context });
  let clientes = await listClientes({ page: 1, limit: 100 }, { accountId, context });
  let produtos = await listProdutos({ page: 1, limit: 100 }, { accountId });
  const itens = [];
  for (const pedido of pedidos.items) {
    const full = await import('../pedidos/pedidos.repository.js').then((m) => m.getPedidoById(pedido.id, { accountId, context }));
    itens.push(...(full.itens || []));
  }
  return { pedidos: pedidos.items || [], itens, clientes: clientes.items || [], produtos: produtos.items || [] };
}

export async function getAnalyticsSummary(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const { pedidos, clientes, produtos } = await fetchData(accountId, options.context);
  const p = parseFilters(filters);
  const scoped = pedidos.filter((x) => inPeriod(x.created_at || x.createdAt, p.startDate, p.endDate));
  return summarize(scoped, clientes, produtos);
}

export async function getTopProducts(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const { pedidos, itens } = await fetchData(accountId, options.context);
  const p = parseFilters(filters);
  const ids = new Set(pedidos.filter((x) => inPeriod(x.created_at || x.createdAt, p.startDate, p.endDate)).map((x) => x.id));
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
  return [...map.values()].map((x) => ({ produto_id: x.produto_id, produto_nome: x.produto_nome, quantidadeVendida: x.quantidadeVendida, totalVendido: x.totalVendido, pedidos: x.pedidosSet.size })).sort((a, b) => b.totalVendido - a.totalVendido).slice(0, p.limit);
}

export async function getTopCustomers(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const { pedidos, clientes } = await fetchData(accountId, options.context);
  const p = parseFilters(filters);
  const mapNames = new Map(clientes.map((c) => [c.id, c.nome]));
  const map = new Map();
  for (const pedido of pedidos) {
    if (!inPeriod(pedido.created_at || pedido.createdAt, p.startDate, p.endDate)) continue;
    const key = pedido.cliente_id;
    const curr = map.get(key) || { cliente_id: key, cliente_nome: mapNames.get(key) || null, pedidos: 0, totalComprado: 0 };
    curr.pedidos += 1;
    curr.totalComprado += Number(pedido.total || 0);
    map.set(key, curr);
  }
  return [...map.values()].map((x) => ({ ...x, ticketMedio: x.pedidos > 0 ? x.totalComprado / x.pedidos : 0 })).sort((a, b) => b.totalComprado - a.totalComprado).slice(0, p.limit);
}

export async function getSalesTimeline(filters = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const { pedidos } = await fetchData(accountId, options.context);
  const p = parseFilters(filters);
  const map = new Map();
  for (const pedido of pedidos) {
    const created = pedido.created_at || pedido.createdAt;
    if (!inPeriod(created, p.startDate, p.endDate)) continue;
    const date = new Date(created).toISOString().slice(0, 10);
    const curr = map.get(date) || { date, pedidos: 0, total: 0 };
    curr.pedidos += 1;
    curr.total += Number(pedido.total || 0);
    map.set(date, curr);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
