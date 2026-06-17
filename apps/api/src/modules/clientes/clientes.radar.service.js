import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { calcularScoreComercialCliente, getClienteById, getClientesRepositoryMode, __dumpMemoryClientes } from './clientes.repository.js';
import { __dumpMemoryPedidos } from '../pedidos/pedidos.repository.js';
import { gerarAlertasCliente, __dumpMemoryAlertas } from './clientes.alerts.service.js';
import { recalcularSegmentacaoCliente } from './clientes.segmentacao.service.js';
import { registrarEventoTimeline } from './clientes.timeline.service.js';

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
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-crm' });
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getPedidoDate(pedido = {}) {
  return toDate(pedido.data_faturamento) || toDate(pedido.data_emissao) || toDate(pedido.created_at);
}

function getPedidoTotal(pedido = {}) {
  const total = Number(pedido.total ?? pedido.valor_total ?? pedido.valor ?? 0);
  return Number.isFinite(total) ? total : 0;
}

function isPedidoValido(pedido = {}) {
  const status = normalizeKey(pedido.status || pedido?.metadata?.status || pedido?.metadata?.situacao);
  if (!status) return false;
  return !['cancelado', 'rejeitado', 'estornado'].includes(status);
}

function getDiasSemCompra(ultimaCompra) {
  if (!ultimaCompra) return null;
  const diff = Date.now() - ultimaCompra.getTime();
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff / 86400000)) : null;
}

function getScoreClassificacao(cliente = {}) {
  return normalizeText(cliente.cliente_classificacao || cliente.score_classificacao || cliente.scoreClassificacao || '');
}

function getClienteSegmento(cliente = {}) {
  return normalizeKey(cliente.segmento_comercial || cliente.segmento || '');
}

function getClienteVendedorId(cliente = {}) {
  return String(cliente.vendedor_id || cliente.owner_user_id || '').trim() || null;
}

function getClienteActiveFlag(cliente = {}) {
  return cliente.ativo !== false;
}

function logRadarSupabaseError(stage, error, details = {}) {
  console.error('[clientes.radar.service] supabase_error', {
    stage,
    message: error?.message || null,
    code: error?.code || null,
    details: error?.details || null,
    hint: error?.hint || null,
    requestId: details.requestId || null,
    account_id: details.accountId || null,
    filtros: details.filtros || null,
    query: details.query || null
  });
}

function chunkArray(items = [], size = 25) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function buildClienteRadar(cliente, pedidos = [], alertas = []) {
  const pedidosCliente = pedidos.filter((pedido) => String(pedido.cliente_id || '') === String(cliente.id));
  const pedidosValidos = pedidosCliente.filter(isPedidoValido);
  const pedidosOrdenados = pedidosValidos
    .map((pedido) => ({ pedido, data: getPedidoDate(pedido) }))
    .filter((entry) => entry.data)
    .sort((a, b) => b.data.getTime() - a.data.getTime());
  const totalPedidos = pedidosValidos.length;
  const faturamentoTotal = pedidosValidos.reduce((sum, pedido) => sum + getPedidoTotal(pedido), 0);
  const ultimaCompra = pedidosOrdenados[0]?.data || toDate(cliente.ultima_compra_em) || toDate(cliente.ultima_compra) || null;
  const diasSemCompra = getDiasSemCompra(ultimaCompra);
  const clienteAlertas = alertas.filter((alerta) => String(alerta.cliente_id || '') === String(cliente.id));
  const alertasAtivos = clienteAlertas.filter((alerta) => normalizeKey(alerta.status) === 'ativo');

  return {
    id: cliente.id,
    nome: cliente.nome || cliente.razao_social || cliente.codigo || '-',
    cidade: cliente.cidade || null,
    estado: cliente.estado || null,
    score: Number(cliente.cliente_score ?? cliente.score ?? 0) || 0,
    score_classificacao: cliente.score_classificacao || cliente.cliente_classificacao || null,
    segmento: cliente.segmento_comercial || cliente.segmento || null,
    faturamento_total: faturamentoTotal,
    total_pedidos: totalPedidos,
    ticket_medio: totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0,
    dias_sem_compra: diasSemCompra,
    ultima_compra: ultimaCompra ? ultimaCompra.toISOString() : null,
    alertas_ativos: alertasAtivos.length
  };
}

function applyFilters(clientes = [], filters = {}) {
  return clientes.filter((cliente) => {
    if (!getClienteActiveFlag(cliente)) return false;
    if (filters.vendedor_id && String(getClienteVendedorId(cliente)) !== String(filters.vendedor_id)) return false;
    if (filters.cidade && normalizeKey(cliente.cidade) !== normalizeKey(filters.cidade)) return false;
    if (filters.estado && normalizeKey(cliente.estado) !== normalizeKey(filters.estado)) return false;
    if (filters.segmento && normalizeKey(cliente.segmento_comercial || cliente.segmento) !== normalizeKey(filters.segmento)) return false;
    return true;
  });
}

async function fetchRadarClientes(accountId, supabase, filtros = {}, options = {}) {
  const mode = getClientesRepositoryMode().mode;
  if (mode === 'supabase') {
    const client = supabase || resolveSupabaseClient();
    if (!client) throw new DatabaseError('Supabase indisponivel');
    const querySpec = {
      table: 'clientes',
      select: 'id,nome,razao_social,cidade,estado,cliente_score,cliente_classificacao,segmento_comercial,vendedor_id,owner_user_id,ultima_compra_em,ultima_compra,account_id,ativo',
      filters: { account_id: accountId, ...filtros }
    };
    try {
      let query = client
        .from('clientes')
        .select(querySpec.select)
        .eq('account_id', accountId);
      if (filtros.vendedor_id) query = query.eq('vendedor_id', filtros.vendedor_id);
      if (filtros.cidade) query = query.eq('cidade', filtros.cidade);
      if (filtros.estado) query = query.eq('estado', filtros.estado);
      if (filtros.segmento) query = query.eq('segmento_comercial', filtros.segmento);
      const { data, error } = await query;
      if (error) {
        logRadarSupabaseError('fetchRadarClientes', error, { accountId, filtros, query: querySpec, requestId: options.requestId || options.context?.requestId || null });
        throw new DatabaseError('Falha ao listar clientes do radar', { details: error });
      }
      return applyFilters(data || [], filtros);
    } catch (error) {
      if (error instanceof DatabaseError) throw error;
      logRadarSupabaseError('fetchRadarClientes', error, { accountId, filtros, query: querySpec, requestId: options.requestId || options.context?.requestId || null });
      throw new DatabaseError('Falha ao listar clientes do radar', { details: { message: error?.message || String(error), code: error?.code || null, details: error?.details || null, hint: error?.hint || null } });
    }
  }
  return applyFilters(__dumpMemoryClientes().filter((item) => item.account_id === accountId), filtros);
}

async function fetchRadarPedidos(accountId, clienteIds = [], supabase) {
  const ids = [...new Set((Array.isArray(clienteIds) ? clienteIds : [clienteIds]).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const mode = getClientesRepositoryMode().mode;
  if (mode === 'supabase') {
    const client = supabase || resolveSupabaseClient();
    if (!client) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await client.from('pedidos').select('id,cliente_id,status,total,valor_total,valor,data_emissao,data_faturamento,metadata,created_at,account_id').eq('account_id', accountId).in('cliente_id', ids);
    if (error) throw new DatabaseError('Falha ao listar pedidos do radar', { details: error });
    return data || [];
  }
  return __dumpMemoryPedidos().pedidos.filter((item) => item.account_id === accountId && ids.includes(String(item.cliente_id || '')));
}

async function fetchRadarAlertas(accountId, clienteIds = [], supabase) {
  const ids = [...new Set((Array.isArray(clienteIds) ? clienteIds : [clienteIds]).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) return [];
  const mode = getClientesRepositoryMode().mode;
  if (mode === 'supabase') {
    const client = supabase || resolveSupabaseClient();
    if (!client) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await client.from('cliente_alertas').select('id,cliente_id,status,tipo,account_id').eq('account_id', accountId).in('cliente_id', ids);
    if (error) throw new DatabaseError('Falha ao listar alertas do radar', { details: error });
    return data || [];
  }
  return __dumpMemoryAlertas().filter((item) => item.account_id === accountId && ids.includes(String(item.cliente_id || '')));
}

function sortGroup(items, groupName) {
  const list = [...items];
  if (groupName === 'vip') return list.sort((a, b) => (b.faturamento_total || 0) - (a.faturamento_total || 0));
  if (groupName === 'recorrentes') return list.sort((a, b) => {
    const aDate = toDate(a.ultima_compra)?.getTime() || 0;
    const bDate = toDate(b.ultima_compra)?.getTime() || 0;
    return bDate - aDate;
  });
  if (groupName === 'potenciais') return list.sort((a, b) => (b.score || 0) - (a.score || 0));
  if (groupName === 'recuperacao') return list.sort((a, b) => (toDate(b.ultima_compra)?.getTime() || 0) - (toDate(a.ultima_compra)?.getTime() || 0));
  if (groupName === 'risco' || groupName === 'inativos') return list.sort((a, b) => (b.dias_sem_compra || 0) - (a.dias_sem_compra || 0));
  return list;
}

function buildGroups(clientes = []) {
  const groups = { vip: [], recorrentes: [], potenciais: [], recuperacao: [], risco: [], inativos: [] };
  for (const cliente of clientes) {
    const segmento = normalizeKey(cliente.segmento);
    if (segmento === 'vip') groups.vip.push(cliente);
    else if (segmento === 'recorrente') groups.recorrentes.push(cliente);
    else if (segmento === 'potencial') groups.potenciais.push(cliente);
    else if (segmento === 'recuperacao') groups.recuperacao.push(cliente);
    else if (segmento === 'em_risco') groups.risco.push(cliente);
    else if (segmento === 'inativo') groups.inativos.push(cliente);
  }
  for (const key of Object.keys(groups)) groups[key] = sortGroup(groups[key], key);
  return groups;
}

async function loadRadarData(accountId, options = {}) {
  const clientes = await fetchRadarClientes(accountId, null, {}, options);
  const pedidos = await fetchRadarPedidos(accountId, clientes.map((cliente) => cliente.id));
  const alertas = await fetchRadarAlertas(accountId, clientes.map((cliente) => cliente.id));
  return { clientes, pedidos, alertas };
}

export async function getClientesRadar(options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const raw = await loadRadarData(accountId, options);
  const filteredClientes = applyFilters(raw.clientes || [], options.filters || {});
  const radarClientes = filteredClientes.map((cliente) => buildClienteRadar(cliente, raw.pedidos || [], raw.alertas || []));
  const grupos = buildGroups(radarClientes);
  const faturamentoTotal = radarClientes.reduce((sum, item) => sum + (item.faturamento_total || 0), 0);
  const totalClientes = radarClientes.length;
  const totalVip = grupos.vip.length;
  const totalRecorrentes = grupos.recorrentes.length;
  const totalPotenciais = grupos.potenciais.length;
  const totalRecuperacao = grupos.recuperacao.length;
  const totalRisco = grupos.risco.length;
  const totalInativos = grupos.inativos.length;
  const ticketMedioGeral = totalClientes > 0 ? faturamentoTotal / totalClientes : 0;
  const clientesComAlertas = radarClientes.filter((item) => (item.alertas_ativos || 0) > 0).length;

  return {
    resumo: {
      total_clientes: totalClientes,
      total_vip: totalVip,
      total_recorrentes: totalRecorrentes,
      total_potenciais: totalPotenciais,
      total_recuperacao: totalRecuperacao,
      total_risco: totalRisco,
      total_inativos: totalInativos,
      faturamento_total: faturamentoTotal,
      ticket_medio_geral: ticketMedioGeral,
      clientes_com_alertas: clientesComAlertas
    },
    grupos
  };
}

export async function recalcularRadarComercial({ supabase, context, accountId, filtros = {}, chunkSize = 25 } = {}) {
  assertAccountId(accountId);
  const iniciadoEm = new Date().toISOString();
  const start = Date.now();
  const clientes = await fetchRadarClientes(accountId, supabase, filtros, { context, requestId: context?.requestId || null });
  const clienteChunks = chunkArray(clientes, Math.max(1, Math.min(50, Number(chunkSize) || 25)));
  const detalhesFalhas = [];
  let processados = 0;
  let sucessos = 0;

  for (const chunk of clienteChunks) {
    for (const cliente of chunk) {
      processados += 1;
      try {
        const pedidos = await fetchRadarPedidos(accountId, [cliente.id], supabase);
        const alertas = await fetchRadarAlertas(accountId, [cliente.id], supabase);
        const score = await calcularScoreComercialCliente({ supabase, context, accountId, clienteId: cliente.id });
        await gerarAlertasCliente(cliente.id, { accountId, context, pedidos });
        await recalcularSegmentacaoCliente(cliente.id, { accountId, context });
        if (score?.score || score?.cliente) {
          await registrarEventoTimeline({
            tipo: 'radar_recalculado',
            categoria: 'radar',
            titulo: 'Radar recalculado',
            descricao: 'Cliente recalculado em lote pelo Radar Comercial.',
            metadata: { cliente_id: cliente.id, alertas_anteriores: alertas.length, pedidos: pedidos.length }
          }, { accountId, clienteId: cliente.id }).catch(() => null);
        }
        sucessos += 1;
      } catch (error) {
        detalhesFalhas.push({ cliente_id: cliente.id, erro: error?.message || String(error) });
      }
    }
  }

  const finalizadoEm = new Date().toISOString();
  return {
    total_clientes: clientes.length,
    processados,
    sucessos,
    falhas: detalhesFalhas.length,
    detalhes_falhas: detalhesFalhas,
    iniciado_em: iniciadoEm,
    finalizado_em: finalizadoEm,
    duracao_ms: Date.now() - start
  };
}

export function __setClientesRadarSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

export function __resetClientesRadarForTests() {
  supabaseClientOverride = null;
  supabaseConfiguredOverride = null;
}
