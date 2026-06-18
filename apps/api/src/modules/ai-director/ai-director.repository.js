import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { logger } from '../../core/logger.js';
import { listClientes } from '../clientes/clientes.repository.js';
import { listPedidos } from '../pedidos/pedidos.repository.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { listPromocoes } from '../promocoes/promocoes.repository.js';
import { auditSummary } from '../product-audit/product-audit.repository.js';
import { getRevenueIntelligence } from '../revenue-intelligence/revenue-intelligence.repository.js';
import { listAuditLogs } from '../audit-logs/audit-logs.repository.js';
import { listConversations, listEvents } from '../whatsapp-conversations/whatsapp-conversations.repository.js';
import { listPendingApprovals } from '../message-approvals/message-approvals.repository.js';
import { getCustomerSuccess } from '../customer-success/customer-success.repository.js';
import { getCustomerRetention } from '../customer-retention/customer-retention.repository.js';
import { getImplementationStatus } from '../implementation-tracker/implementation-tracker.repository.js';
import { ROLE_PERMISSIONS } from '../../core/permissions.js';
import { buildStrategicRadar } from './ai-director.radar.js';

const validTipos = new Set(['observacao', 'alerta', 'oportunidade', 'diagnostico', 'decisao', 'plano_acao']);
const validPrioridades = new Set(['baixa', 'media', 'alta', 'critica']);
const validExecutiveTipos = new Set(['trend', 'alert', 'opportunity', 'risk', 'performance', 'alerta', 'prioridade', 'prioridade_executiva', 'acao', 'observacao']);
const validExecutiveCategorias = new Set(['comercial', 'produtos', 'auditoria', 'followup', 'administrativo', 'geral']);
const validExecutiveSeveridades = new Set(['baixa', 'media', 'alta', 'critica']);
const memoryStore = [];
let supabaseClientOverride = null;
let supabaseConfiguredOverride = null;
const managerProviderOverrides = new Map();
const managers = [
  {
    id: 'comercial',
    nome: 'Gerente Comercial',
    descricao: 'Especialista em carteira, pedidos, pipeline e leitura de receita.',
    modulos: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue'],
    capacidades: ['analisar carteira de clientes', 'identificar clientes em risco', 'analisar pedidos', 'resumir pipeline comercial', 'apoiar análise de faturamento'],
    status: 'ativo'
  },
  {
    id: 'produtos',
    nome: 'Gerente Produtos',
    descricao: 'Focado em catálogo, operação de produtos e leitura de promoções.',
    modulos: ['Produtos', 'Categorias', 'Fabricantes', 'Importações', 'Promoções'],
    capacidades: ['analisar catálogo', 'identificar problemas de produtos', 'avaliar fabricantes', 'acompanhar promoções', 'apoiar importações'],
    status: 'ativo'
  },
  {
    id: 'auditoria',
    nome: 'Gerente Auditoria',
    descricao: 'Responsável por integridade, logs e sinais de risco operacional.',
    modulos: ['Auditoria', 'Logs', 'Integridade de dados'],
    capacidades: ['analisar logs', 'identificar inconsistências', 'verificar integridade de dados', 'apontar riscos operacionais'],
    status: 'ativo'
  },
  {
    id: 'followup',
    nome: 'Gerente Follow-up',
    descricao: 'Orquestra conversas, bloqueios e oportunidades de follow-up.',
    modulos: ['WhatsApp', 'Evolution', 'IA Comercial', 'Pipeline IA'],
    capacidades: ['analisar conversas', 'identificar oportunidades no WhatsApp', 'avaliar bloqueios de follow-up', 'acompanhar pipeline IA'],
    status: 'ativo'
  },
  {
    id: 'administrativo',
    nome: 'Gerente Administrativo',
    descricao: 'Cuida de governança, permissões, configurações e tenant.',
    modulos: ['Usuários', 'Permissões', 'Configurações', 'Tenant'],
    capacidades: ['revisar permissões', 'analisar configuração da conta', 'apoiar governança administrativa'],
    status: 'ativo'
  }
];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director' });
}

function mode() {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new BadRequestError(`${field} obrigatorio`);
  return text;
}

function normalizeMemoryPayload(data = {}) {
  const tipo = normalizeText(data.tipo, 'tipo');
  if (!validTipos.has(tipo)) throw new BadRequestError('tipo invalido');
  const prioridade = String(data.prioridade ?? 'media').trim();
  if (!validPrioridades.has(prioridade)) throw new BadRequestError('prioridade invalida');
  const titulo = normalizeText(data.titulo, 'titulo');
  const conteudo = normalizeText(data.conteudo, 'conteudo');
  const origem = String(data.origem ?? 'diretor_ia').trim() || 'diretor_ia';
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  return { tipo, titulo, conteudo, prioridade, origem, metadata };
}

function normalizeExecutiveMemoryPayload(data = {}) {
  const tipo = normalizeText(data.tipo, 'tipo');
  if (!validExecutiveTipos.has(tipo)) throw new BadRequestError('tipo invalido');
  const titulo = normalizeText(data.titulo, 'titulo');
  const descricao = normalizeText(data.descricao, 'descricao');
  const categoria = String(data.categoria ?? 'geral').trim() || 'geral';
  if (!validExecutiveCategorias.has(categoria)) throw new BadRequestError('categoria invalida');
  const severidade = String(data.severidade ?? 'media').trim() || 'media';
  if (!validExecutiveSeveridades.has(severidade)) throw new BadRequestError('severidade invalida');
  const metadata = data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {};
  return { tipo, titulo, descricao, categoria, severidade, metadata };
}

export async function getAiDirectorDashboard(context = {}) {
  const radar = await buildStrategicRadar(context).catch(() => ({
    observacoesPorModulo: [],
    scoreExecutivo: {
      valor: 0,
      classificacao: 'Crítica',
      pilares: {
        comercial: { valor: 0, status: 'critico', fatores: [] },
        operacional: { valor: 0, status: 'critico', fatores: [] },
        produtos: { valor: 0, status: 'critico', fatores: [] },
        inteligencia: { valor: 0, status: 'critico', fatores: [] }
      },
      penalidades: [],
      diagnostico: 'Sem diagnóstico disponível.'
    },
    resumoExecutivo: 'Sem resumo executivo disponível.',
    resumoModular: 'Nenhum resumo modular disponível no momento.',
    alertas: [],
    oportunidades: [],
    prioridades: [],
    acoesSugeridas: [],
    persistenciaInsights: { candidatos: 0, persistidos: 0, ignorados: 0 },
    auditoria: {
      versao: '2.1',
      geradoEm: new Date(0).toISOString(),
      tempoGeracaoMs: 0,
      fontesUtilizadas: [],
      totalAlertas: 0,
      totalOportunidades: 0,
      totalPrioridades: 0,
      totalAcoes: 0,
      totalObservacoesModulares: 0,
      scoreExecutivo: 0,
      classificacaoExecutiva: 'Crítica',
      consistencia: {
        scoreValido: true,
        prioridadesValidas: true,
        acoesValidas: true,
        limitesRespeitados: true
      },
      qualidade: {
        percentualPrioridadesComAcao: 0,
        percentualPrioridadesComGerente: 0,
        percentualObservacoesComResumo: 0
      }
    }
  }));
  return {
    health: {},
    alerts: [],
    opportunities: [],
    radar
  };
}

export function listManagers() {
  return managers.map(clone);
}

export function getManagerById(managerId) {
  const id = String(managerId ?? '').trim();
  if (!id) return null;
  return managers.find((manager) => manager.id === id) || null;
}

function normalizeQuestionText(question = '') {
  return String(question || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value) {
  const n = safeNumber(value, 0);
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

async function safeCall(label, fn, fallback) {
  try {
    return await fn();
  } catch (error) {
    return typeof fallback === 'function' ? fallback(error) : fallback;
  }
}

function buildCommercialFacts(question, dashboard, customers, orders, revenue, retention, customerSuccess) {
  const activeCustomers = Array.isArray(customers?.items) ? customers.items.filter((item) => item.ativo !== false) : [];
  const latestOrders = Array.isArray(orders?.items) ? orders.items : [];
  const ordersCount = safeNumber(orders?.total ?? latestOrders.length, latestOrders.length);
  const revenueMonth = safeNumber(revenue?.mrr ?? revenue?.receita30 ?? 0, safeNumber(dashboard?.health?.receita_mes ?? 0, 0));
  const averageTicket = ordersCount > 0 ? revenueMonth / ordersCount : 0;
  const customerRiskCount = safeNumber(dashboard?.health?.clientes_risco ?? customerSuccess?.alertas?.length ?? 0, customerSuccess?.alertas?.length ?? 0);
  const customerActiveCount = safeNumber(dashboard?.health?.clientes_ativos ?? activeCustomers.length, activeCustomers.length);
  const riskPercent = customerActiveCount > 0 ? Math.round((customerRiskCount / customerActiveCount) * 100) : null;
  return {
    clientes_risco: customerRiskCount,
    clientes_ativos: customerActiveCount,
    pedidos_mes: ordersCount,
    receita_mes: revenueMonth,
    ticket_medio: Math.round(averageTicket),
    percentual_risco: riskPercent,
    periodo: 'mês atual',
    destaque: question.includes('faturamento')
      ? `Faturamento atual de ${formatCurrency(revenueMonth)} com ${ordersCount} pedido(s).`
      : `Há ${customerRiskCount} cliente(s) em risco e ${customerActiveCount} ativo(s).`
  };
}

function buildProductFacts(products, promotions, audit) {
  const items = Array.isArray(products?.items) ? products.items : [];
  const byManufacturer = new Map();
  for (const item of items) {
    const key = String(item.fabricante_nome || item.fabricante_nome || item.marca || item.fabricanteId || item.fabricante_id || 'Sem fabricante').trim() || 'Sem fabricante';
    byManufacturer.set(key, (byManufacturer.get(key) || 0) + 1);
  }
  const fabricanteLider = [...byManufacturer.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    fabricante_lider: fabricanteLider,
    promocoes_ativas: Array.isArray(promotions?.items) ? promotions.items.filter((item) => item.ativaAgora).length : 0,
    produtos_sem_giro: safeNumber(audit?.summary?.comProblemas ?? 0, 0),
    produtos_criticos: safeNumber(audit?.summary?.criticos ?? 0, 0)
  };
}

function buildAuditFacts(auditLogs, auditSummaryResult) {
  const items = Array.isArray(auditLogs?.items) ? auditLogs.items : [];
  const critical = items.filter((item) => String(item.status || '').toLowerCase() === 'failed' || String(item.severidade || '').toLowerCase() === 'critical');
  return {
    issues_criticas: safeNumber(auditSummaryResult?.criticos ?? critical.length, critical.length),
    issues_abertas: safeNumber(auditSummaryResult?.comProblemas ?? items.length, items.length),
    ultimo_alerta: items[0]?.descricao || items[0]?.erro_mensagem || null
  };
}

function buildFollowupFacts(conversations, events, approvals, customerSuccess) {
  const items = Array.isArray(conversations?.items) ? conversations.items : [];
  const pendingApprovals = Array.isArray(approvals) ? approvals : [];
  const openConversations = items.filter((item) => String(item.status || '').toLowerCase() === 'open');
  return {
    clientes_followup: openConversations.length || pendingApprovals.length,
    oportunidades_aquecendo: safeNumber(customerSuccess?.alertas?.length ?? events?.length ?? 0, 0),
    clientes_bloqueados: pendingApprovals.length
  };
}

function buildAdministrativeFacts(accountId, rolePermissions = ROLE_PERMISSIONS, implementationStatus = null) {
  const roles = Object.keys(ROLE_PERMISSIONS).length;
  const users = safeNumber(implementationStatus?.milestones?.length ?? 0, 0);
  const alertasPermissoes = (rolePermissions.admin || []).filter((permission) => permission.includes('system') || permission.includes('followup')).length;
  return {
    usuarios: users,
    roles,
    alertas_permissoes: alertasPermissoes,
    tenant: accountId || null
  };
}

async function collectManagerFacts(managerId, context = {}, question = '') {
  if (managerProviderOverrides.has(managerId)) {
    return managerProviderOverrides.get(managerId)({ managerId, context, question });
  }
  const accountId = context?.accountId || null;
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'ai-director' });
  const dashboard = await getAiDirectorDashboard(context);
  if (managerId === 'comercial') {
    const [customers, orders, revenue, retention, customerSuccess] = await Promise.all([
      safeCall('clientes', () => listClientes({ limit: 200 }, { accountId }), { items: [], total: 0 }),
      safeCall('pedidos', () => listPedidos({ limit: 200 }, { accountId }), { items: [], total: 0 }),
      safeCall('revenue', () => getRevenueIntelligence(accountId), {}),
      safeCall('retention', () => getCustomerRetention(accountId), {}),
      safeCall('success', () => getCustomerSuccess(accountId), {})
    ]);
    return buildCommercialFacts(question, dashboard, customers, orders, revenue, retention, customerSuccess);
  }
  if (managerId === 'produtos') {
    const [products, promotions, audit] = await Promise.all([
      safeCall('produtos', () => listProdutos({ limit: 200 }, { accountId }), { items: [], total: 0 }),
      safeCall('promocoes', () => listPromocoes({}, { accountId }), { items: [], total: 0 }),
      safeCall('audit', () => auditSummary({ accountId }), {})
    ]);
    return buildProductFacts(products, promotions, audit);
  }
  if (managerId === 'auditoria') {
    const [logs, audit] = await Promise.all([
      safeCall('auditLogs', () => listAuditLogs({ limit: 50 }, { accountId }), { items: [], total: 0 }),
      safeCall('productAudit', () => auditSummary({ accountId }), {})
    ]);
    return buildAuditFacts(logs, audit);
  }
  if (managerId === 'followup') {
    const [conversations, approvals, customerSuccess, implementationStatus] = await Promise.all([
      safeCall('conversations', () => listConversations({ limit: 200 }, { accountId }), { items: [], total: 0 }),
      safeCall('approvals', () => listPendingApprovals({ accountId }), []),
      safeCall('success', () => getCustomerSuccess(accountId), {}),
      safeCall('implementation', () => getImplementationStatus(accountId), {})
    ]);
    return buildFollowupFacts(conversations, [], approvals, customerSuccess, implementationStatus);
  }
  if (managerId === 'administrativo') {
    const implementationStatus = await safeCall('implementation', () => getImplementationStatus(accountId), {});
    return buildAdministrativeFacts(accountId, ROLE_PERMISSIONS, implementationStatus);
  }
  return {};
}

export async function consultManager(context = {}, managerId, payload = {}) {
  assertAccountId(context?.accountId || context?.account_id || null);
  const manager = getManagerById(managerId);
  if (!manager) throw new BadRequestError('manager inexistente');
  const question = normalizeText(payload.question, 'question');
  const lowerQuestion = normalizeQuestionText(question);
  const facts = {
    manager_id: manager.id,
    manager_nome: manager.nome,
    sources: [...manager.modulos],
    question,
    indicators: {},
    observations: [],
    provider: 'real'
  };
  const managerFacts = await collectManagerFacts(managerId, context, question).catch((error) => {
    facts.provider = 'fallback';
    facts.provider_error = error?.message || 'Falha ao consultar dados reais';
    return {};
  });
  facts.indicators = managerFacts;
  if (lowerQuestion.includes('faturamento') || lowerQuestion.includes('receita')) facts.observations.push('Acompanhe receita, ticket medio e pedidos do periodo.');
  if (lowerQuestion.includes('risco') || lowerQuestion.includes('cliente')) facts.observations.push('Priorize reengajamento e reducao de risco da carteira.');
  if (lowerQuestion.includes('promoc')) facts.observations.push('As promocoes ativas devem ser validadas no catalogo.');
  if (lowerQuestion.includes('auditoria') || lowerQuestion.includes('erro') || lowerQuestion.includes('inconsist')) facts.observations.push('Vale abrir os alertas criticos e logs mais recentes.');
  if (lowerQuestion.includes('permiss')) facts.observations.push('Revise permissões e governança do tenant.');

  return {
    manager: {
      id: manager.id,
      nome: manager.nome
    },
    question,
    summary: facts.provider === 'real' ? `Consulta consolidada com dados reais pelo ${manager.nome}.` : `Consulta recebida pelo ${manager.nome} com fallback controlado.`,
    status: 'answered',
    sources: [...manager.modulos],
    facts
  };
}

export function searchAiDirectorMemories(memories = [], question = '', limit = 3) {
  const normalizedQuestion = String(question || '').toLowerCase();
  return [...memories]
    .map((memory) => {
      const text = [memory?.titulo, memory?.conteudo, memory?.tipo, memory?.origem].join(' ').toLowerCase();
      const score = normalizedQuestion.split(/\s+/).filter(Boolean).reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      return { ...memory, _score: score };
    })
    .filter((memory) => memory._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...memory }) => memory);
}

export async function listAiDirectorMemories(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const limit = Number(filters.limit ?? 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('ai_director_memories')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(safeLimit);
    if (error) throw new DatabaseError('Falha ao listar memorias do diretor', { details: error });
    return { items: data || [], total: (data || []).length };
  }

  const items = memoryStore
    .filter((row) => row.account_id === accountId)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, safeLimit)
    .map(clone);
  return { items, total: items.length };
}

function matchesExecutiveFilters(row, filters = {}) {
  if (filters?.categoria && row.categoria !== filters.categoria) return false;
  if (filters?.tipo && row.tipo !== filters.tipo) return false;
  return true;
}

function buildExecutiveMemoryLogicalKey(row = {}) {
  return [
    String(row.account_id || '').trim(),
    String(row.tipo || '').trim(),
    String(row.categoria || '').trim(),
    String(row.titulo || '').trim().toLowerCase(),
    String(row.origem || '').trim()
  ].join('|');
}

function isUniqueConstraintViolation(error) {
  return String(error?.code || '') === '23505';
}

function normalizeExecutiveMemoryTitle(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesExecutiveMemoryIdentity(row = {}, candidate = {}) {
  return String(row.account_id || '') === String(candidate.account_id || '') &&
    String(row.tipo || '') === String(candidate.tipo || '') &&
    String(row.categoria || '') === String(candidate.categoria || '') &&
    normalizeExecutiveMemoryTitle(row.titulo) === normalizeExecutiveMemoryTitle(candidate.titulo) &&
    String(row.origem || '') === String(candidate.origem || '');
}

async function findExistingExecutiveMemoryByLogicalKey(supabase, row) {
  const normalizedTitle = normalizeExecutiveMemoryTitle(row.titulo);
  const payload = {
    p_account_id: row.account_id,
    p_tipo: row.tipo,
    p_categoria: row.categoria,
    p_origem: row.origem,
    p_titulo: row.titulo
  };
  logger.info('ai_director_executive_memory_retry_params', {
    account_id: row.account_id,
    tipo: row.tipo,
    categoria: row.categoria,
    origem: row.origem,
    titulo: row.titulo,
    titulo_normalizado: normalizedTitle
  });
  logger.info('executive_memory_rpc_payload', payload);
  const rpcResult = await supabase.rpc('find_ai_director_executive_memory_by_logical_key', payload);
  const { data, error } = rpcResult || {};
  if (error) throw new DatabaseError('Falha ao consultar memoria executiva do diretor', { details: error });
  logger.info('ai_director_executive_memory_retry_result', {
    account_id: row.account_id,
    tipo: row.tipo,
    categoria: row.categoria,
    origem: row.origem,
    titulo: row.titulo,
    titulo_normalizado: normalizedTitle,
    raw_count: Array.isArray(data) ? data.length : 0,
    raw_rows: data || []
  });
  return (data || [])[0] || null;
}

async function saveExecutiveMemoryRow(supabase, row) {
  const current = await findExistingExecutiveMemoryByLogicalKey(supabase, row);
  if (current) {
    const next = {
      ...current,
      ...row,
      id: current.id,
      account_id: current.account_id,
      created_at: current.created_at || current.criado_em || row.criado_em,
      criado_em: current.criado_em || current.created_at || row.criado_em,
      updated_at: new Date().toISOString(),
      metadata: { ...(current.metadata || {}), ...(row.metadata || {}) }
    };
    const { data: updated, error: updateError } = await supabase.from('ai_director_executive_memories').update(next).eq('id', current.id).select('*').single();
    if (updateError) throw new DatabaseError('Falha ao atualizar memoria executiva do diretor', { details: updateError });
    return updated;
  }

  logger.info('ai_director_executive_memory_before_insert', {
    account_id: row.account_id,
    tipo: row.tipo,
    categoria: row.categoria,
    origem: row.origem,
    titulo: row.titulo,
    titulo_normalizado: normalizeExecutiveMemoryTitle(row.titulo)
  });
  const { data: inserted, error } = await supabase.from('ai_director_executive_memories').insert(row).select('*').single();
  if (error) {
    if (isUniqueConstraintViolation(error)) {
      const retryCurrent = await findExistingExecutiveMemoryByLogicalKey(supabase, row);
      if (retryCurrent) {
        const next = {
          ...retryCurrent,
          ...row,
          id: retryCurrent.id,
          account_id: retryCurrent.account_id,
          created_at: retryCurrent.created_at || retryCurrent.criado_em || row.criado_em,
          criado_em: retryCurrent.criado_em || retryCurrent.created_at || row.criado_em,
          updated_at: new Date().toISOString(),
          metadata: { ...(retryCurrent.metadata || {}), ...(row.metadata || {}) }
        };
        const { data: updated, error: retryUpdateError } = await supabase.from('ai_director_executive_memories').update(next).eq('id', retryCurrent.id).select('*').single();
        if (!retryUpdateError) return updated;
      }
      throw new DatabaseError('Falha ao criar memoria executiva do diretor apos 23505 sem registro correspondente', {
        details: error,
        context: {
          account_id: row.account_id,
          tipo: row.tipo,
          categoria: row.categoria,
          titulo_normalizado: normalizeExecutiveMemoryTitle(row.titulo),
          titulo: row.titulo,
          origem: row.origem
        }
      });
    }
    throw new DatabaseError('Falha ao criar memoria executiva do diretor', { details: error });
  }
  return inserted;
}

function resolveAiDirectorSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function resolveAiDirectorSupabaseConfigured() {
  if (supabaseConfiguredOverride !== null) return supabaseConfiguredOverride;
  return isSupabaseConfigured();
}

export async function createExecutiveMemory(data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payload = normalizeExecutiveMemoryPayload(data);
  const row = {
    id: randomUUID(),
    account_id: accountId,
    ...payload,
    criado_em: new Date().toISOString()
  };
  if (resolveAiDirectorSupabaseConfigured()) {
    const supabase = resolveAiDirectorSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    return saveExecutiveMemoryRow(supabase, row);
  }

  memoryStore.push({ ...row, executive: true });
  return clone(row);
}

export async function upsertExecutiveMemory(data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payload = normalizeExecutiveMemoryPayload(data);
  const row = {
    id: randomUUID(),
    account_id: accountId,
    ...payload,
    metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {},
    criado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (resolveAiDirectorSupabaseConfigured()) {
    const supabase = resolveAiDirectorSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    return saveExecutiveMemoryRow(supabase, row);
  }

  const current = memoryStore.find((item) => item.executive && buildExecutiveMemoryLogicalKey(item) === buildExecutiveMemoryLogicalKey(row)) || null;
  if (current) {
    Object.assign(current, row, { id: current.id, criado_em: current.criado_em, updated_at: row.updated_at });
    return clone(current);
  }
  memoryStore.push({ ...row, executive: true });
  return clone(row);
}

export async function listExecutiveMemories(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const limit = Number(filters.limit ?? 10);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 10;

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    let query = supabase
      .from('ai_director_executive_memories')
      .select('*')
      .eq('account_id', accountId)
      .order('criado_em', { ascending: false })
      .limit(safeLimit);
    if (filters?.categoria) query = query.eq('categoria', filters.categoria);
    if (filters?.tipo) query = query.eq('tipo', filters.tipo);
    const { data, error } = await query;
    if (error) throw new DatabaseError('Falha ao listar memorias executivas do diretor', { details: error });
    return { items: data || [], total: (data || []).length };
  }

  const items = memoryStore
    .filter((row) => row.account_id === accountId && row.executive)
    .filter((row) => matchesExecutiveFilters(row, filters))
    .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
    .slice(0, safeLimit)
    .map(({ executive, ...item }) => clone(item));
  return { items, total: items.length };
}

export async function findRelevantExecutiveMemories(filters = {}, options = {}) {
  const result = await listExecutiveMemories({ limit: filters.limit ?? 5, categoria: filters.categoria, tipo: filters.tipo }, options);
  const keywords = String(filters.question ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const items = [...result.items]
    .map((memory) => {
      const text = [memory.titulo, memory.descricao, memory.tipo, memory.categoria].join(' ').toLowerCase();
      const score = keywords.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
      return { ...memory, _score: score };
    })
    .filter((memory) => memory._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, Number(filters.limit ?? 5))
    .map(({ _score, ...memory }) => memory);
  return { items, total: items.length };
}

export async function recordExecutiveInsight(data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  return createExecutiveMemory(data, { accountId, context: options.context });
}

export async function createAiDirectorMemory(data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const payload = normalizeMemoryPayload(data);
  const row = {
    id: randomUUID(),
    account_id: accountId,
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: inserted, error } = await supabase.from('ai_director_memories').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar memoria do diretor', { details: error });
    return inserted;
  }

  memoryStore.push(row);
  return clone(row);
}

export function __setAiDirectorSupabaseClientForTests(client, configured = true) {
  supabaseClientOverride = client;
  supabaseConfiguredOverride = configured;
}

export function __resetMemoryAiDirectorForTests() {
  memoryStore.length = 0;
  managerProviderOverrides.clear();
}

export function __dumpMemoryAiDirectorForTests() {
  return clone(memoryStore);
}

export function __setAiDirectorManagerProviderOverrideForTests(managerId, provider) {
  if (!managerId) return;
  if (typeof provider !== 'function') {
    managerProviderOverrides.delete(managerId);
    return;
  }
  managerProviderOverrides.set(managerId, provider);
}
