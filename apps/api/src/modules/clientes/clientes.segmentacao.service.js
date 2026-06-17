import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getClientesRepositoryMode, getClienteById, listClientePedidos } from './clientes.repository.js';
import { listAlertasCliente } from './clientes.alerts.service.js';

let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasActiveRiskAlert(cliente = {}) {
  const alertas = Array.isArray(cliente?.cliente_alertas) ? cliente.cliente_alertas : Array.isArray(cliente?.alertas) ? cliente.alertas : [];
  return alertas.some((alerta) => normalizeText(alerta?.status) === 'ativo' && /risco|perda/.test(normalizeText(alerta?.tipo) + ' ' + normalizeText(alerta?.titulo) + ' ' + normalizeText(alerta?.descricao)));
}

function hadResolvedRiskAlert(cliente = {}) {
  const alertas = Array.isArray(cliente?.cliente_alertas) ? cliente.cliente_alertas : Array.isArray(cliente?.alertas) ? cliente.alertas : [];
  return alertas.some((alerta) => ['resolvido', 'ignorado'].includes(normalizeText(alerta?.status)) && /risco/.test(normalizeText(alerta?.tipo) + ' ' + normalizeText(alerta?.titulo) + ' ' + normalizeText(alerta?.descricao)));
}

function hasRecentPurchase(scoreData = {}, cliente = {}, days = 60) {
  const ultimaCompra = getDate(scoreData?.fatores?.ultima_compra || cliente?.cliente_score_fatores?.ultima_compra || cliente?.ultima_compra_em || cliente?.ultima_compra || cliente?.ultima_compra_em);
  if (!ultimaCompra) return false;
  return Math.max(0, Math.floor((Date.now() - ultimaCompra.getTime()) / 86400000)) <= days;
}

function getDiasSemCompra(scoreData = {}, cliente = {}) {
  const value = scoreData?.fatores?.dias_sem_compra ?? cliente?.cliente_score_fatores?.dias_sem_compra;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getTotalPedidos(scoreData = {}, cliente = {}, pedidos = []) {
  const numeric = Number(scoreData?.fatores?.total_pedidos ?? cliente?.cliente_score_fatores?.total_pedidos ?? pedidos.length);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getFaturamentoTotal(scoreData = {}, cliente = {}, pedidos = []) {
  const numeric = Number(scoreData?.fatores?.faturamento_total ?? cliente?.cliente_score_fatores?.faturamento_total);
  if (Number.isFinite(numeric)) return numeric;
  return pedidos.reduce((sum, pedido) => sum + Number(pedido?.total ?? pedido?.valor_total ?? pedido?.valor ?? 0), 0);
}

function buildSegmentacao(cliente = {}, scoreData = {}, pedidos = []) {
  const scoreClassificacao = normalizeText(scoreData?.classificacao || cliente?.cliente_classificacao);
  const scorePotencial = normalizeText(scoreData?.potencial || cliente?.cliente_potencial);
  const totalPedidos = getTotalPedidos(scoreData, cliente, pedidos);
  const faturamentoTotal = getFaturamentoTotal(scoreData, cliente, pedidos);
  const diasSemCompra = getDiasSemCompra(scoreData, cliente);
  const pedidoRecente = hasRecentPurchase(scoreData, cliente, 60);
  const alertaRiscoAtivo = hasActiveRiskAlert(cliente);
  const alertaRiscoResolvido = hadResolvedRiskAlert(cliente);

  if (scoreClassificacao === 'a' && totalPedidos >= 10 && faturamentoTotal >= 50000) {
    return { segmento: 'VIP', motivos: ['Score A', 'Alto faturamento', 'Alta recorrência'] };
  }
  if ((Number.isFinite(diasSemCompra) && diasSemCompra > 90) || alertaRiscoAtivo) {
    return { segmento: 'EM_RISCO', motivos: ['Sem compras recentes', 'Possível perda de cliente'] };
  }
  if (alertaRiscoResolvido && pedidoRecente) {
    return { segmento: 'RECUPERACAO', motivos: ['Retomou compras', 'Cliente reativado'] };
  }
  if (scorePotencial === 'alto' && totalPedidos < 5) {
    return { segmento: 'POTENCIAL', motivos: ['Potencial alto', 'Baixa exploração comercial'] };
  }
  if (totalPedidos >= 5 && (Number.isFinite(diasSemCompra) ? diasSemCompra <= 60 : pedidoRecente)) {
    return { segmento: 'RECORRENTE', motivos: ['Compra frequente', 'Relacionamento ativo'] };
  }
  if (totalPedidos <= 2) {
    return { segmento: 'NOVO', motivos: ['Cliente em desenvolvimento'] };
  }
  return { segmento: 'INATIVO', motivos: ['Sem classificação relevante'] };
}

async function persistSegmentacao(cliente, payload, options = {}) {
  const accountId = options.accountId || null;
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('clientes').update(payload).eq('account_id', accountId).eq('id', cliente.id).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar segmentacao do cliente', { details: error });
    return data;
  }
  return { ...cliente, ...payload, updated_at: new Date().toISOString() };
}

export async function calcularSegmentacaoCliente(cliente, scoreData = {}) {
  const { segmento, motivos } = buildSegmentacao(cliente, scoreData, Array.isArray(scoreData?.pedidos) ? scoreData.pedidos : []);
  return { segmento, motivos, atualizadoEm: new Date().toISOString() };
}

export async function recalcularSegmentacaoCliente(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const cliente = await getClienteById(clienteId, { accountId, context: options.context });
  const pedidos = await listClientePedidos(accountId, cliente.id);
  const alertas = await listAlertasCliente(cliente.id, { accountId, context: options.context }).catch(() => []);
  const scoreData = {
    classificacao: cliente?.cliente_classificacao,
    potencial: cliente?.cliente_potencial,
    fatores: cliente?.cliente_score_fatores || {},
    pedidos,
    alertas
  };
  const result = await calcularSegmentacaoCliente(cliente, scoreData);
  const updated = await persistSegmentacao(cliente, {
    segmento_comercial: result.segmento,
    segmento_ultima_atualizacao: result.atualizadoEm,
    segmento_motivos: result.motivos
  }, { accountId });
  return { cliente: updated, segmentacao: result };
}

export function __setClientesSegmentacaoSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

export function __resetClientesSegmentacaoForTests() {
  supabaseClientOverride = null;
  supabaseConfiguredOverride = null;
}
