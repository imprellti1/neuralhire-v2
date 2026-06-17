import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { calcularScoreCliente } from './clientes.score.service.js';
import { getClienteById, getClientesRepositoryMode, listClientePedidos } from './clientes.repository.js';

const memoryAlertas = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;

function resolveSupabaseConfigured() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
  }
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getOrCreateDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDaysSincePurchase(cliente = {}, scoreResult = null) {
  const fromScore = Number(scoreResult?.fatores?.dias_sem_compra);
  if (Number.isFinite(fromScore)) return fromScore;
  const lastPurchase = getOrCreateDate(scoreResult?.fatores?.ultima_compra || cliente?.cliente_score_fatores?.ultima_compra || cliente?.ultima_compra_em);
  if (!lastPurchase) return null;
  return Math.max(0, Math.floor((Date.now() - lastPurchase.getTime()) / 86400000));
}

function normalizePedidoStatus(pedido = {}) {
  const raw = String(pedido?.status || pedido?.metadata?.status || pedido?.metadata?.situacao || '').trim().toLowerCase();
  return raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isPedidoValido(pedido = {}) {
  const status = normalizePedidoStatus(pedido);
  if (!status) return false;
  return !['cancelado', 'rejeitado', 'estornado'].includes(status);
}

function resolvePedidoDate(pedido = {}) {
  return getOrCreateDate(pedido?.data_faturamento || pedido?.data_emissao || pedido?.created_at);
}

function resolvePedidoTotal(pedido = {}) {
  const total = Number(pedido?.total ?? pedido?.valor_total ?? pedido?.valor ?? 0);
  if (Number.isFinite(total) && total > 0) return total;
  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return itens.reduce((sum, item) => sum + Number(item?.total ?? item?.valor_total ?? 0), 0);
}

function buildAlertDefinitions({ cliente, previousScore = null, currentScore = null, scoreResult = null, pedidos = [] }) {
  const diasSemCompra = getDaysSincePurchase(cliente, scoreResult);
  const scoreAtual = Number(currentScore ?? cliente?.cliente_score ?? scoreResult?.score ?? null);
  const scoreAnterior = Number(previousScore ?? cliente?.cliente_score_anterior ?? cliente?.cliente_score_previo ?? null);
  const fatorCliente = cliente?.cliente_score_fatores && typeof cliente.cliente_score_fatores === 'object' ? cliente.cliente_score_fatores : {};
  const pedidosValidos = (Array.isArray(pedidos) ? pedidos : []).filter(isPedidoValido);
  const pedidosOrdenados = pedidosValidos
    .map((pedido) => ({ pedido, data: resolvePedidoDate(pedido), total: resolvePedidoTotal(pedido) }))
    .filter((entry) => entry.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  const totalPedidos = Number(scoreResult?.fatores?.total_pedidos ?? fatorCliente.total_pedidos ?? pedidosValidos.length ?? 0);
  const faturamentoTotal = Number(scoreResult?.fatores?.faturamento_total ?? fatorCliente.faturamento_total ?? pedidosValidos.reduce((sum, pedido) => sum + resolvePedidoTotal(pedido), 0));
  const potential = normalizeText(scoreResult?.potencial || cliente?.cliente_potencial);
  const cutoff = Date.now() - (90 * 86400000);
  const receitaAtual90 = pedidosOrdenados
    .filter(({ data }) => data.getTime() >= cutoff)
    .reduce((sum, entry) => sum + entry.total, 0);
  const receitaAnterior90 = pedidosOrdenados
    .filter(({ data }) => data.getTime() < cutoff)
    .reduce((sum, entry) => sum + entry.total, 0);
  const dropPercent = receitaAnterior90 > 0 ? ((receitaAnterior90 - receitaAtual90) / receitaAnterior90) * 100 : null;
  const scoreDrop = Number.isFinite(scoreAnterior) && Number.isFinite(scoreAtual) ? scoreAnterior - scoreAtual : null;
  const alerts = [];

  if (Number.isFinite(diasSemCompra) && diasSemCompra > 90) {
    alerts.push({
      tipo: 'cliente_sem_compra_90',
      severidade: 'media',
      titulo: 'Cliente sem compra há mais de 90 dias',
      descricao: `O cliente está há ${diasSemCompra} dias sem comprar.`,
      metadata: { dias_sem_compra: diasSemCompra, regra: 'dias_sem_compra > 90' }
    });
  } else if (Number.isFinite(diasSemCompra) && diasSemCompra > 60) {
    alerts.push({
      tipo: 'cliente_sem_compra_60',
      severidade: 'alta',
      titulo: 'Cliente sem compra há mais de 60 dias',
      descricao: `O cliente está há ${diasSemCompra} dias sem comprar.`,
      metadata: { dias_sem_compra: diasSemCompra, regra: 'dias_sem_compra > 60' }
    });
  }

  if (Number.isFinite(dropPercent) && dropPercent > 30) {
    alerts.push({
      tipo: 'queda_faturamento',
      severidade: 'alta',
      titulo: 'Queda de faturamento acima de 30%',
      descricao: `A receita dos últimos 90 dias caiu ${dropPercent.toFixed(1)}% em relação aos 90 dias anteriores.`,
      metadata: { receita_ultimos_90_dias: receitaAtual90, receita_90_dias_anteriores: receitaAnterior90, queda_percentual: dropPercent }
    });
  }

  if (Number.isFinite(scoreDrop) && scoreDrop >= 20) {
    alerts.push({
      tipo: 'queda_score',
      severidade: 'alta',
      titulo: 'Score comercial caiu 20 pontos ou mais',
      descricao: `O score comercial caiu ${scoreDrop} pontos na comparação disponível.`,
      metadata: { score_atual: scoreAtual, score_anterior: scoreAnterior, queda_pontos: scoreDrop }
    });
  }

  if (potential === 'alto' && totalPedidos < 5) {
    alerts.push({
      tipo: 'potencial_alto_baixa_base',
      severidade: 'media',
      titulo: 'Potencial alto com baixa base de pedidos',
      descricao: `Cliente com potencial alto e apenas ${totalPedidos} pedidos registrados.`,
      metadata: { potencial: scoreResult?.potencial || cliente?.cliente_potencial || null, total_pedidos: totalPedidos, regra: 'total_pedidos < 5' }
    });
  }

  return alerts;
}

async function loadExistingAlertas(accountId, clienteId) {
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('cliente_alertas').select('*').eq('account_id', accountId).eq('cliente_id', clienteId);
    if (error) throw new DatabaseError('Falha ao consultar alertas existentes', { details: error });
    return data || [];
  }
  return memoryAlertas.filter((item) => item.account_id === accountId && item.cliente_id === clienteId);
}

async function persistAlerta(alerta, options = {}) {
  const accountId = options.accountId || null;
  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const payload = {
      account_id: accountId,
      cliente_id: alerta.cliente_id,
      tipo: alerta.tipo,
      severidade: alerta.severidade,
      titulo: alerta.titulo,
      descricao: alerta.descricao,
      status: alerta.status,
      metadata: alerta.metadata || {},
      resolvido_em: alerta.resolvido_em || null
    };
    const { data, error } = await supabase.from('cliente_alertas').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao persistir alerta comercial', { details: error });
    return data;
  }

  const idx = memoryAlertas.findIndex((item) => item.account_id === accountId && item.cliente_id === alerta.cliente_id && item.tipo === alerta.tipo);
  const next = {
    ...alerta,
    id: idx >= 0 ? memoryAlertas[idx].id : randomUUID(),
    account_id: accountId,
    created_at: idx >= 0 ? memoryAlertas[idx].created_at : new Date().toISOString()
  };
  if (idx >= 0) memoryAlertas[idx] = { ...memoryAlertas[idx], ...next };
  else memoryAlertas.push(next);
  return next;
}

export async function gerarAlertasCliente(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const cliente = await getClienteById(clienteId, { accountId, context: options.context });
  const pedidos = options.pedidos || await listClientePedidos(accountId, cliente.id);
  const scoreResult = calcularScoreCliente({
    cliente,
    pedidos,
    itens: options.itens || []
  });
  const previousScore = Number(cliente?.cliente_score_anterior ?? cliente?.cliente_score_previo ?? null);
  const alerts = buildAlertDefinitions({
    cliente,
    previousScore,
    currentScore: scoreResult.score,
    scoreResult,
    pedidos
  });
  const existingAlertas = await loadExistingAlertas(accountId, cliente.id);
  const activeByTipo = new Map(existingAlertas.filter((item) => String(item.status || '') === 'ativo').map((item) => [String(item.tipo || ''), item]));
  const persisted = [];
  for (const alerta of alerts) {
    const existingActive = activeByTipo.get(alerta.tipo);
    if (existingActive) {
      persisted.push(existingActive);
      continue;
    }
    const existingResolved = existingAlertas.find((item) => String(item.tipo || '') === alerta.tipo && String(item.status || '') !== 'ativo');
    if (existingResolved) {
      continue;
    }
    persisted.push(await persistAlerta({
      cliente_id: cliente.id,
      tipo: alerta.tipo,
      severidade: alerta.severidade,
      titulo: alerta.titulo,
      descricao: alerta.descricao,
      status: 'ativo',
      metadata: alerta.metadata,
      resolvido_em: null
    }, { accountId }));
  }
  return { cliente, alertas: persisted };
}

export async function listAlertasCliente(clienteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getClienteById(clienteId, { accountId, context: options.context });

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('cliente_alertas')
      .select('*')
      .eq('account_id', accountId)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    if (error) throw new DatabaseError('Falha ao listar alertas do cliente', { details: error });
    return data || [];
  }

  return memoryAlertas.filter((item) => item.account_id === accountId && item.cliente_id === clienteId).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export async function resolverAlertaCliente(alertaId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const status = normalizeText(options.status || 'resolvido');
  if (!['resolvido', 'ignorado'].includes(status)) {
    throw new ForbiddenError('Status invalido para resolucao de alerta', { code: 'ALERTA_STATUS_INVALIDO', domain: 'clientes-crm' });
  }

  if (getClientesRepositoryMode().mode === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const payload = { status, resolvido_em: status === 'resolvido' ? new Date().toISOString() : null };
    const { data, error } = await supabase.from('cliente_alertas').update(payload).eq('account_id', accountId).eq('id', alertaId).select('*').maybeSingle();
    if (error) throw new DatabaseError('Falha ao atualizar alerta comercial', { details: error });
    if (!data) throw new NotFoundError('Alerta nao encontrado', { code: 'ALERTA_NOT_FOUND', domain: 'clientes-crm' });
    return data;
  }

  const idx = memoryAlertas.findIndex((item) => item.id === alertaId && item.account_id === accountId);
  if (idx < 0) throw new NotFoundError('Alerta nao encontrado', { code: 'ALERTA_NOT_FOUND', domain: 'clientes-crm' });
  memoryAlertas[idx] = { ...memoryAlertas[idx], status, resolvido_em: status === 'resolvido' ? new Date().toISOString() : null };
  return memoryAlertas[idx];
}

export function __resetMemoryAlertasForTests() {
  memoryAlertas.length = 0;
}

export function __dumpMemoryAlertas() {
  return memoryAlertas.map((item) => ({ ...item }));
}

export function __setClientesAlertsSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}
