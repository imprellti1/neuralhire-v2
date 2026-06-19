import { ForbiddenError } from '../../core/errors.js';
import { getClientesRepositoryMode, listClientes, listClientePedidos } from '../clientes/clientes.repository.js';
import { listAlertasCliente } from '../clientes/clientes.alerts.service.js';
import { listDirectorTasks } from '../ai-director/ai-director-tasks.repository.js';

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-sales' });
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(date) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function riskLevelFromSignals({ diasSemComprar, temPedido, alertaAtivo, score }) {
  if (!temPedido) return 'critical';
  if (Number.isFinite(diasSemComprar) && diasSemComprar > 120) return 'critical';
  if (Number.isFinite(diasSemComprar) && diasSemComprar > 90) return 'high';
  if (alertaAtivo) return 'medium';
  if (Number(score || 0) <= 30) return 'low';
  return 'low';
}

function classificacaoFromScore(score = 0) {
  if (Number(score) <= 30) return 'crítico';
  if (Number(score) <= 60) return 'atenção';
  return 'saudável';
}

function matchAlertaAtivo(alertas = []) {
  return (Array.isArray(alertas) ? alertas : []).some((alerta) => normalizeText(alerta.status) === 'ativo');
}

function sumPedidos(pedidos = []) {
  return (Array.isArray(pedidos) ? pedidos : []).reduce((sum, pedido) => sum + Number(pedido.total ?? 0), 0);
}

function normalizeFinancialAmount(task = {}) {
  const raw = task.financial_amount ?? task.valor ?? task.amount ?? task.value ?? task.impacto_estimado ?? null;
  if (raw === null || raw === undefined || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function buildPortfolioItem(cliente, pedidos = [], alertas = []) {
  const pedidosOrdenados = [...pedidos]
    .filter((pedido) => String(pedido.cliente_id || '') === String(cliente.id))
    .map((pedido) => ({ pedido, date: toDate(pedido.data_faturamento) || toDate(pedido.data_emissao) || toDate(pedido.created_at) }))
    .filter((entry) => entry.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const ultimoPedido = pedidosOrdenados[0]?.date || null;
  const diasSemComprar = daysSince(ultimoPedido);
  const totalPedidos = pedidos.filter((pedido) => String(pedido.cliente_id || '') === String(cliente.id));
  const faturamentoTotal = sumPedidos(totalPedidos);
  const score = Number(cliente.cliente_score ?? cliente.score ?? 0) || 0;
  const alertaAtivo = matchAlertaAtivo(alertas.filter((alerta) => String(alerta.cliente_id || '') === String(cliente.id)));
  const temPedido = totalPedidos.length > 0;
  const statusRisco = riskLevelFromSignals({ diasSemComprar, temPedido, alertaAtivo, score });
  return {
    cliente_id: cliente.id,
    nome: cliente.nome || cliente.razao_social || '-',
    documento: cliente.documento || null,
    cidade: cliente.cidade || null,
    estado: cliente.estado || null,
    score,
    classificacao: classificacaoFromScore(score),
    ultimo_pedido: ultimoPedido ? ultimoPedido.toISOString() : null,
    dias_sem_comprar: diasSemComprar,
    faturamento_total: faturamentoTotal,
    status_risco: statusRisco,
    vendedor_id: cliente.vendedor_id || cliente.owner_user_id || null,
    alerta_ativo: alertaAtivo
  };
}

function buildOpportunity(item) {
  const motivos = [];
  if (item.dias_sem_comprar !== null && item.dias_sem_comprar > 90) motivos.push('cliente inativo');
  if (item.faturamento_total > 0 && item.dias_sem_comprar !== null && item.dias_sem_comprar > 90) motivos.push('historico relevante');
  if (Number(item.score || 0) <= 30) motivos.push('score baixo');
  const motivo = motivos.length ? motivos.join(' e ') : 'queda de relacionamento';
  const impacto_estimado = Math.max(0, Number(item.faturamento_total || 0) * (item.dias_sem_comprar && item.dias_sem_comprar > 90 ? 0.2 : 0.1));
  return { cliente: item.nome, motivo, impacto_estimado };
}

export async function loadAiSalesPortfolio(accountId, filters = {}, options = {}) {
  assertAccountId(accountId);
  const clientes = await listClientes({ vendedor_id: filters.vendedor_id || undefined }, { accountId, context: options.context });
  const clienteItems = Array.isArray(clientes?.items) ? clientes.items : clientes || [];
  const filteredClientes = clientes?.items ? clienteItems : clienteItems;
  const pedidosByCliente = new Map();
  const alertasByCliente = new Map();
  const portfolio = [];

  for (const cliente of filteredClientes) {
    const pedidos = await listClientePedidos(accountId, cliente.id);
    const alertas = await listAlertasCliente(cliente.id, { accountId, context: options.context }).catch(() => []);
    pedidosByCliente.set(cliente.id, pedidos);
    alertasByCliente.set(cliente.id, alertas);
    portfolio.push(buildPortfolioItem(cliente, pedidos, alertas));
  }

  return { items: portfolio, pedidosByCliente, alertasByCliente, clientes: filteredClientes };
}

export async function getAiSalesOverview(accountId, options = {}) {
  const { items } = await loadAiSalesPortfolio(accountId, options.filters || {}, options);
  const pedidos30 = [];
  for (const item of items) {
    const pedidos = await listClientePedidos(accountId, item.cliente_id);
    pedidos30.push(...pedidos.filter((pedido) => {
      const date = toDate(pedido.data_faturamento) || toDate(pedido.data_emissao) || toDate(pedido.created_at);
      return date ? (Date.now() - date.getTime()) <= 30 * 86400000 : false;
    }));
  }
  const totalClientes = items.length;
  const clientesEmRisco = items.filter((item) => ['critical', 'high', 'medium'].includes(item.status_risco)).length;
  const clientesInativos = items.filter((item) => Number(item.dias_sem_comprar || 0) > 90 || item.status_risco === 'critical').length;
  const faturamentoCarteira = items.reduce((sum, item) => sum + Number(item.faturamento_total || 0), 0);
  const ticketMedio = totalClientes > 0 ? faturamentoCarteira / totalClientes : 0;
  const oportunidades = items.filter((item) => item.status_risco !== 'low' && Number(item.faturamento_total || 0) > 0).length;
  return {
    total_clientes: totalClientes,
    clientes_em_risco: clientesEmRisco,
    clientes_inativos: clientesInativos,
    oportunidades,
    faturamento_carteira: faturamentoCarteira,
    ticket_medio: ticketMedio,
    pedidos_30_dias: pedidos30.length
  };
}

export async function getAiSalesPortfolioData(accountId, options = {}) {
  const { items } = await loadAiSalesPortfolio(accountId, options.filters || {}, options);
  return { items };
}

export async function getAiSalesAlerts(accountId, options = {}) {
  const { items } = await loadAiSalesPortfolio(accountId, options.filters || {}, options);
  return { items: items.filter((item) => item.status_risco !== 'low' || item.alerta_ativo) };
}

export async function getAiSalesOpportunities(accountId, options = {}) {
  const { items } = await loadAiSalesPortfolio(accountId, options.filters || {}, options);
  return { items: items.filter((item) => item.status_risco !== 'low' || Number(item.dias_sem_comprar || 0) > 60).map(buildOpportunity) };
}

export async function getAiSalesTasks(accountId, options = {}) {
  assertAccountId(accountId);
  const items = await listDirectorTasks(accountId, {
    status: options.status || undefined,
    vendedor_id: options.vendedor_id || options.manager_id || undefined,
    limit: options.limit || 200
  });
  const normalizedItems = (Array.isArray(items) ? items : (items.items || [])).map((task) => {
    const financial_amount = normalizeFinancialAmount(task);
    return financial_amount === null ? { ...task } : { ...task, financial_amount };
  });
  return { items: normalizedItems };
}

export async function getAiSalesPerformance(accountId, options = {}) {
  const { items } = await loadAiSalesPortfolio(accountId, options.filters || {}, options);
  const active = items.filter((item) => Number(item.dias_sem_comprar || 0) <= 90);
  const recovered = items.filter((item) => Number(item.dias_sem_comprar || 0) > 90 && Number(item.faturamento_total || 0) > 0);
  return {
    faturamento_carteira: items.reduce((sum, item) => sum + Number(item.faturamento_total || 0), 0),
    clientes_ativos: active.length,
    clientes_recuperados: recovered.length,
    oportunidades_geradas: items.filter((item) => item.status_risco !== 'low').length
  };
}

