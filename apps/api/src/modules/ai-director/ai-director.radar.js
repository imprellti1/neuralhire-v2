import { listClientes } from '../clientes/clientes.repository.js';
import { listPedidos } from '../pedidos/pedidos.repository.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { auditSummary } from '../product-audit/product-audit.repository.js';
import { getRevenueIntelligence } from '../revenue-intelligence/revenue-intelligence.repository.js';
import { createExecutiveMemory, listExecutiveMemories, listManagers } from './ai-director.repository.js';

const RADAR_STATUS = {
  SAUDAVEL: 'saudavel',
  ATENCAO: 'atencao',
  CRITICO: 'critico'
};

const RADAR_IMPACT = {
  ALTO: 'alto',
  MEDIO: 'medio',
  BAIXO: 'baixo'
};

const RADAR_URGENCY = {
  ALTA: 'alta',
  MEDIA: 'media',
  BAIXA: 'baixa'
};

const RADAR_CLASSIFICATION = {
  EXCELENTE: 'Excelente',
  BOA: 'Boa',
  ATENCAO: 'Atenção',
  CRITICA: 'Crítica'
};

const EMPTY_RADAR_SHAPE = {
  observacoesPorModulo: [],
  scoreExecutivo: {
    valor: 0,
    classificacao: RADAR_CLASSIFICATION.CRITICA,
    pilares: {
      comercial: { valor: 0, status: RADAR_STATUS.CRITICO, fatores: [] },
      operacional: { valor: 0, status: RADAR_STATUS.CRITICO, fatores: [] },
      produtos: { valor: 0, status: RADAR_STATUS.CRITICO, fatores: [] },
      inteligencia: { valor: 0, status: RADAR_STATUS.CRITICO, fatores: [] }
    },
    penalidades: [],
    diagnostico: 'Sem diagnóstico disponível.'
  },
  resumoModular: 'Nenhum resumo modular disponível no momento.',
  resumoExecutivo: 'Sem resumo executivo disponível.',
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
    classificacaoExecutiva: RADAR_CLASSIFICATION.CRITICA,
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
};

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampPercent(value) {
  return clamp(Math.round(safeNumber(value, 0)), 0, 100);
}

function sanitizeText(value, maxLength = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength).trimEnd() : text;
}

function sanitizeList(list, maxLength = 500) {
  return Array.isArray(list) ? list.map((item) => sanitizeText(item, maxLength)).filter(Boolean) : [];
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function ensureObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function classificationFromScore(score) {
  if (score >= 90) return RADAR_CLASSIFICATION.EXCELENTE;
  if (score >= 75) return RADAR_CLASSIFICATION.BOA;
  if (score >= 60) return RADAR_CLASSIFICATION.ATENCAO;
  return RADAR_CLASSIFICATION.CRITICA;
}

function pillarStatusFromScore(score) {
  if (score >= 90) return 'excelente';
  if (score >= 75) return 'bom';
  if (score >= 60) return RADAR_STATUS.ATENCAO;
  return RADAR_STATUS.CRITICO;
}

function buildPenalty(origem, pontos, motivo) {
  const safePoints = Math.max(0, Math.round(safeNumber(pontos, 0)));
  return safePoints > 0 ? { origem, pontos: safePoints, motivo } : null;
}

function buildPillar(value, fatores = []) {
  const score = clampPercent(value);
  return {
    valor: score,
    status: pillarStatusFromScore(score),
    fatores: ensureArray(fatores).filter(Boolean)
  };
}

function moduleStatusFromScore(score) {
  if (score >= 80) return 'saudavel';
  if (score >= 60) return 'atencao';
  return 'critico';
}

function moduleScoreForStatus(status, base = 0) {
  const safeBase = clampPercent(base);
  if (status === 'saudavel') return clamp(Math.max(80, safeBase), 0, 100);
  if (status === 'atencao') return clamp(Math.max(60, safeBase), 0, 100);
  return clamp(Math.min(59, safeBase || 45), 0, 100);
}

function buildModuleObservation({ modulo, status, score, resumo, observacoes = [], gerenteResponsavel = null }) {
  return {
    modulo: sanitizeText(modulo, 120),
    status,
    score: clampPercent(score),
    resumo: sanitizeText(resumo, 500),
    observacoes: sanitizeList(observacoes, 500),
    gerenteResponsavel: sanitizeText(gerenteResponsavel, 120) || null
  };
}

function summarizeModules(modulos = []) {
  const items = ensureArray(modulos);
  const total = items.length;
  const counts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { saudavel: 0, atencao: 0, critico: 0 });
  const principal = [...items].sort((a, b) => {
    const rank = { critico: 3, atencao: 2, saudavel: 1 };
    if ((rank[b.status] || 0) !== (rank[a.status] || 0)) return (rank[b.status] || 0) - (rank[a.status] || 0);
    return a.score - b.score;
  })[0];
  const principalText = principal ? `O principal ponto de atenção está no módulo ${principal.modulo}.` : 'Nenhum módulo apresentou desvio relevante.';
  return `${total} módulos observados. ${counts.saudavel} saudáveis, ${counts.atencao} em atenção e ${counts.critico} crítico${counts.critico === 1 ? '' : 's'}. ${principalText}`;
}

function summarizePenalties(penalidades = []) {
  const items = ensureArray(penalidades);
  if (!items.length) return null;
  const main = items[0];
  return `O principal impacto está no pilar ${String(main.origem || '').toLowerCase()}, com ${main.motivo.toLowerCase()}`;
}

async function safeCall(fn, fallback) {
  try {
    return await fn();
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeCategory(value) {
  const text = normalizeText(value);
  if (['comercial', 'clientes', 'revenue', 'pedidos'].includes(text)) return 'comercial';
  if (['produtos', 'produto', 'catalogo', 'catálogo'].includes(text)) return 'produtos';
  if (['followup', 'follow-up', 'whatsapp', 'conversas'].includes(text)) return 'followup';
  if (['auditoria', 'logs', 'operacional', 'operacao', 'operação'].includes(text)) return 'auditoria';
  if (['inteligencia', 'inteligência', 'memoria', 'memória'].includes(text)) return 'geral';
  return 'geral';
}

function normalizeSeverity(value) {
  const text = normalizeText(value);
  if (['critico', 'crítico'].includes(text)) return 'critica';
  if (text === 'alto' || text === 'alta') return RADAR_URGENCY.ALTA;
  if (text === 'medio' || text === 'médio' || text === 'media' || text === 'média') return RADAR_URGENCY.MEDIA;
  return RADAR_URGENCY.BAIXA;
}

function pickManagerNameByCategory(category) {
  const map = {
    comercial: 'Gerente Comercial',
    produtos: 'Gerente de Produtos',
    followup: 'Gerente de Follow-up',
    auditoria: 'Gerente de Auditoria',
    geral: 'Diretor IA'
  };
  return map[category] || 'Diretor IA';
}

function buildRadarInsightTitle(candidate) {
  const type = normalizeText(candidate?.tipo);
  const title = String(candidate?.titulo || '').trim();
  if (title) return title.slice(0, 72);
  if (type === 'alerta') return 'Alerta estratégico relevante';
  if (type === 'prioridade') return 'Prioridade executiva relevante';
  if (type === 'acao') return 'Ação executiva relevante';
  if (type === 'observacao') return 'Observação crítica relevante';
  return 'Insight estratégico relevante';
}

function buildRadarInsightDescription(candidate) {
  const motivo = String(candidate?.motivo || candidate?.descricao || candidate?.resumo || '').trim();
  const acao = String(candidate?.acao || candidate?.acaoRecomendada || candidate?.proximaAcao || '').trim();
  const gerente = String(candidate?.gerenteResponsavel || candidate?.gerenteSugerido || '').trim();
  const parts = [];
  if (motivo) parts.push(motivo);
  if (acao) parts.push(`Ação: ${acao}`);
  if (gerente) parts.push(`Responsável: ${gerente}`);
  return parts.join(' · ').slice(0, 220) || 'Insight estratégico relevante identificado pelo radar.';
}

function buildRadarInsightCandidate(item, tipo) {
  const category = normalizeCategory(item?.categoria || item?.modulo || item?.origem);
  const severity = normalizeSeverity(item?.severidade || item?.severity || item?.status);
  const tipoMap = { alerta: 'alerta', prioridade: 'prioridade', acao: 'acao', observacao: 'observacao' };
  return {
    tipo: tipoMap[tipo] || tipo,
    categoria: category,
    severidade: severity,
    titulo: buildRadarInsightTitle(item),
    descricao: buildRadarInsightDescription(item),
    gerenteResponsavel: String(item?.gerenteResponsavel || item?.gerenteSugerido || pickManagerNameByCategory(category)).trim(),
    origem: String(item?.origem || item?.modulo || category || 'geral').trim() || 'geral',
    dados_json: {
      fonte: tipo,
      payload: item
    }
  };
}

function isPersistableRadarInsight(candidate) {
  if (!candidate) return false;
  if (candidate.tipo === 'alerta') return ['alta', 'critica'].includes(candidate.severidade) || normalizeText(candidate?.status) === 'critico';
  if (candidate.tipo === 'prioridade') return Number(candidate?.peso ?? 0) >= 85;
  if (candidate.tipo === 'acao') return normalizeText(candidate?.prioridade) === 'alta';
  if (candidate.tipo === 'observacao') return normalizeText(candidate?.status) === 'critico';
  return false;
}

function fingerprintRadarInsight(candidate) {
  return `${normalizeText(candidate?.categoria)}::${normalizeText(candidate?.titulo)}::${normalizeText(candidate?.tipo)}`;
}

function isRecentEnough(createdAt, now) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  return now.getTime() - created.getTime() <= 7 * 24 * 60 * 60 * 1000;
}

async function persistStrategicRadarInsights(context, candidates = []) {
  const accountId = context?.accountId || context?.account_id || null;
  if (!accountId) {
    return { candidatos: candidates.length, persistidos: 0, ignorados: candidates.length };
  }

  const recentMemories = await safeCall(
    () => listExecutiveMemories({ limit: 50 }, { accountId, context }),
    { items: [] }
  );
  const now = new Date();
  const recentFingerprints = new Set(
    (Array.isArray(recentMemories?.items) ? recentMemories.items : [])
      .filter((memory) => isRecentEnough(memory?.criado_em || memory?.created_at, now))
      .map((memory) => fingerprintRadarInsight(memory))
  );

  let persistidos = 0;
  let ignorados = 0;
  for (const candidate of candidates.slice(0, 5)) {
    const fingerprint = fingerprintRadarInsight(candidate);
    if (recentFingerprints.has(fingerprint)) {
      ignorados += 1;
      continue;
    }
    const created = await safeCall(
      () => createExecutiveMemory(candidate, { accountId, context }),
      null
    );
    if (created) {
      persistidos += 1;
      recentFingerprints.add(fingerprint);
    } else {
      ignorados += 1;
    }
  }

  return {
    candidatos: candidates.length,
    persistidos,
    ignorados: Math.max(ignorados, candidates.length - persistidos)
  };
}

function buildAlert(tipo, descricao, origem) {
  return {
    tipo: sanitizeText(tipo, 120),
    titulo: sanitizeText(tipo, 120),
    descricao: sanitizeText(descricao, 500),
    origem: sanitizeText(origem, 120)
  };
}

function buildOpportunity(tipo, descricao, origem) {
  return {
    tipo: sanitizeText(tipo, 120),
    titulo: sanitizeText(tipo, 120),
    descricao: sanitizeText(descricao, 500),
    origem: sanitizeText(origem, 120)
  };
}

function normalizeUrgency(value) {
  const text = String(value ?? '').toLowerCase();
  if (text === 'alta') return RADAR_URGENCY.ALTA;
  if (text === 'media' || text === 'média') return RADAR_URGENCY.MEDIA;
  return RADAR_URGENCY.BAIXA;
}

function normalizeImpact(value) {
  const text = String(value ?? '').toLowerCase();
  if (text === 'alto' || text === 'alta') return RADAR_IMPACT.ALTO;
  if (text === 'medio' || text === 'médio' || text === 'media' || text === 'média') return RADAR_IMPACT.MEDIO;
  return RADAR_IMPACT.BAIXO;
}

function clampPriorityWeight(value) {
  return clampPercent(value);
}

function impactBonus(impacto) {
  if (impacto === 'alto') return 10;
  if (impacto === 'medio') return 5;
  return 0;
}

function urgencyBonus(urgencia) {
  if (urgencia === 'alta') return 10;
  if (urgencia === 'media') return 5;
  return 0;
}

function severityBonus(severidade) {
  const text = String(severidade ?? '').toLowerCase();
  if (text === 'critica' || text === 'crítica') return 15;
  if (text === 'alta') return 10;
  return 0;
}

function quantBonus(value, scale = 10) {
  const n = Math.max(0, safeNumber(value, 0));
  return Math.min(10, Math.round(n * scale));
}

function resolveManagerName(managerId, managers) {
  const id = String(managerId ?? '').trim().toLowerCase();
  if (!id) return null;
  const found = Array.isArray(managers) ? managers.find((manager) => String(manager?.id ?? '').toLowerCase() === id) : null;
  return found?.nome || null;
}

function suggestManagerForPriority(origem, managers, explicitId = null) {
  const text = String(origem ?? '').toLowerCase();
  const managerMap = {
    clientes: 'comercial',
    pedidos: 'comercial',
    revenue: 'comercial',
    comercial: 'comercial',
    produtos: 'produtos',
    produto: 'produtos',
    auditoria: 'auditoria',
    followup: 'followup',
    'follow-up': 'followup'
  };
  const managerId = explicitId || managerMap[text] || null;
  return managerId ? resolveManagerName(managerId, managers) || {
    comercial: 'Gerente Comercial',
    produtos: 'Gerente de Produtos',
    auditoria: 'Gerente de Auditoria',
    followup: 'Gerente de Follow-up'
  }[managerId] || null : null;
}

function buildPriority({
  titulo,
  impacto,
  urgencia,
  motivo,
  origem,
  acaoRecomendada,
  gerenteSugerido,
  peso
}) {
  return {
    ordem: 0,
    titulo: sanitizeText(titulo, 120),
    impacto: normalizeImpact(impacto),
    urgencia: normalizeUrgency(urgencia),
    motivo: sanitizeText(motivo, 300),
    origem: sanitizeText(origem, 120),
    acaoRecomendada: sanitizeText(acaoRecomendada, 500),
    gerenteSugerido: sanitizeText(gerenteSugerido, 120) || null,
    peso: clampPriorityWeight(peso)
  };
}

function buildEmptyRadarFallback() {
  return JSON.parse(JSON.stringify(EMPTY_RADAR_SHAPE));
}

function validateRadarShape(radar = {}) {
  const fallback = buildEmptyRadarFallback();
  const source = ensureObject(radar, {});
  const scoreExecutivo = ensureObject(source.scoreExecutivo, {});
  const pilares = ensureObject(scoreExecutivo.pilares, {});
  const persistenciaInsights = ensureObject(source.persistenciaInsights, {});
  const auditoria = ensureObject(source.auditoria, {});
  const consistencia = ensureObject(auditoria.consistencia, {});
  const qualidade = ensureObject(auditoria.qualidade, {});
  return {
    ...fallback,
    ...source,
    observacoesPorModulo: ensureArray(source.observacoesPorModulo),
    alertas: ensureArray(source.alertas),
    oportunidades: ensureArray(source.oportunidades),
    prioridades: ensureArray(source.prioridades),
    acoesSugeridas: ensureArray(source.acoesSugeridas),
    persistenciaInsights: {
      ...fallback.persistenciaInsights,
      ...persistenciaInsights,
      candidatos: clampPercent(persistenciaInsights.candidatos),
      persistidos: clampPercent(persistenciaInsights.persistidos),
      ignorados: clampPercent(persistenciaInsights.ignorados)
    },
    scoreExecutivo: {
      ...fallback.scoreExecutivo,
      ...scoreExecutivo,
      valor: clampPercent(scoreExecutivo.valor),
      classificacao: sanitizeText(scoreExecutivo.classificacao, 30) || fallback.scoreExecutivo.classificacao,
      pilares: {
        comercial: buildPillar(pilares.comercial?.valor ?? 0, pilares.comercial?.fatores),
        operacional: buildPillar(pilares.operacional?.valor ?? 0, pilares.operacional?.fatores),
        produtos: buildPillar(pilares.produtos?.valor ?? 0, pilares.produtos?.fatores),
        inteligencia: buildPillar(pilares.inteligencia?.valor ?? 0, pilares.inteligencia?.fatores)
      },
      penalidades: ensureArray(scoreExecutivo.penalidades),
      diagnostico: sanitizeText(scoreExecutivo.diagnostico, 500) || fallback.scoreExecutivo.diagnostico
    },
    resumoModular: sanitizeText(source.resumoModular, 500) || fallback.resumoModular,
    resumoExecutivo: sanitizeText(source.resumoExecutivo, 800) || fallback.resumoExecutivo,
    auditoria: {
      ...fallback.auditoria,
      ...auditoria,
      versao: sanitizeText(auditoria.versao, 20) || fallback.auditoria.versao,
      geradoEm: sanitizeText(auditoria.geradoEm, 80) || fallback.auditoria.geradoEm,
      tempoGeracaoMs: Math.max(0, Math.round(safeNumber(auditoria.tempoGeracaoMs, 0))),
      fontesUtilizadas: sanitizeList(auditoria.fontesUtilizadas, 120),
      totalAlertas: clampPercent(auditoria.totalAlertas),
      totalOportunidades: clampPercent(auditoria.totalOportunidades),
      totalPrioridades: clampPercent(auditoria.totalPrioridades),
      totalAcoes: clampPercent(auditoria.totalAcoes),
      totalObservacoesModulares: clampPercent(auditoria.totalObservacoesModulares),
      scoreExecutivo: clampPercent(auditoria.scoreExecutivo),
      classificacaoExecutiva: sanitizeText(auditoria.classificacaoExecutiva, 30) || fallback.auditoria.classificacaoExecutiva,
      consistencia: {
        ...fallback.auditoria.consistencia,
        ...consistencia,
        scoreValido: Boolean(consistencia.scoreValido),
        prioridadesValidas: Boolean(consistencia.prioridadesValidas),
        acoesValidas: Boolean(consistencia.acoesValidas),
        limitesRespeitados: Boolean(consistencia.limitesRespeitados)
      },
      qualidade: {
        ...fallback.auditoria.qualidade,
        ...qualidade,
        percentualPrioridadesComAcao: clampPercent(qualidade.percentualPrioridadesComAcao),
        percentualPrioridadesComGerente: clampPercent(qualidade.percentualPrioridadesComGerente),
        percentualObservacoesComResumo: clampPercent(qualidade.percentualObservacoesComResumo)
      }
    }
  };
}

function buildPriorityCandidate({
  titulo,
  impacto,
  urgencia,
  motivo,
  origem,
  acaoRecomendada,
  gerenteSugerido,
  basePeso,
  severidade = null,
  numericBoost = 0
}) {
  const peso = clampPriorityWeight(basePeso + impactBonus(impacto) + urgencyBonus(urgencia) + severityBonus(severidade) + quantBonus(numericBoost));
  return buildPriority({ titulo, impacto, urgencia, motivo, origem, acaoRecomendada, gerenteSugerido, peso });
}

function dedupeAndSortPriorities(prioridades = []) {
  const deduped = new Map();
  for (const priority of prioridades) {
    const key = `${String(priority?.origem ?? '').toLowerCase()}::${String(priority?.titulo ?? '').toLowerCase()}`;
    const current = deduped.get(key);
    if (!current || priority.peso > current.peso) deduped.set(key, priority);
  }
  return [...deduped.values()]
    .sort((a, b) => {
      if (b.peso !== a.peso) return b.peso - a.peso;
      const urgencyRank = { alta: 3, media: 2, baixa: 1 };
      if ((urgencyRank[b.urgencia] || 0) !== (urgencyRank[a.urgencia] || 0)) return (urgencyRank[b.urgencia] || 0) - (urgencyRank[a.urgencia] || 0);
      const impactRank = { alto: 3, medio: 2, baixo: 1 };
      if ((impactRank[b.impacto] || 0) !== (impactRank[a.impacto] || 0)) return (impactRank[b.impacto] || 0) - (impactRank[a.impacto] || 0);
      const originCompare = String(a.origem || '').localeCompare(String(b.origem || ''));
      if (originCompare !== 0) return originCompare;
      return String(a.titulo || '').localeCompare(String(b.titulo || ''));
    })
    .slice(0, 7)
    .map((priority, index) => ({ ...priority, ordem: index + 1 }));
}

function mapPriorityToActionType(priority) {
  const text = String(priority?.origem || priority?.titulo || '').toLowerCase();
  if (['clientes', 'comercial', 'revenue', 'pedidos'].some((token) => text.includes(token))) return 'comercial';
  if (['auditoria', 'operacional', 'operacao', 'operação'].some((token) => text.includes(token))) return 'operacional';
  if (['produto', 'produtos', 'catalogo', 'catálogo'].some((token) => text.includes(token))) return 'produtos';
  if (['inteligencia', 'inteligência', 'memoria', 'memória', 'insight'].some((token) => text.includes(token))) return 'inteligencia';
  return 'geral';
}

function mapActionDeadline(priority) {
  const urgencia = String(priority?.urgencia || '').toLowerCase();
  const impacto = String(priority?.impacto || '').toLowerCase();
  if (urgencia === 'alta' && impacto === 'alto') return 'hoje';
  if (urgencia === 'alta') return 'hoje';
  if (impacto === 'alto') return 'esta_semana';
  if (impacto === 'medio' || impacto === 'médio') return 'esta_semana';
  if (urgencia === 'media' || urgencia === 'média') return 'proximos_15_dias';
  return 'proximos_15_dias';
}

function actionConclusionForType(tipo) {
  if (tipo === 'comercial') return 'Plano comercial definido e clientes priorizados para contato.';
  if (tipo === 'operacional') return 'Pendências operacionais revisadas e encaminhadas.';
  if (tipo === 'produtos') return 'Produtos com pendências revisados e correções planejadas.';
  if (tipo === 'inteligencia') return 'Insight revisado e decisão registrada na memória executiva.';
  return 'Ação analisada e encaminhamento definido.';
}

function buildSuggestedActions(prioridades = []) {
  if (!Array.isArray(prioridades) || prioridades.length === 0) return [];
  const ordered = prioridades.slice().sort((a, b) => {
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return b.peso - a.peso;
  });
  const actions = [];
  const seen = new Set();
  for (const priority of ordered) {
    const tipo = mapPriorityToActionType(priority);
    const titulo = String(priority?.titulo || '').trim();
    const key = `${tipo}::${titulo.toLowerCase()}`;
    if (!titulo || seen.has(key)) continue;
    seen.add(key);
    const prioridade = String(priority?.urgencia || '').toLowerCase() === 'alta' ? 'alta' : String(priority?.urgencia || '').toLowerCase() === 'media' || String(priority?.urgencia || '').toLowerCase() === 'média' ? 'media' : 'baixa';
    actions.push({
      ordem: actions.length + 1,
      titulo: sanitizeText(titulo, 120),
      descricao: sanitizeText(priority?.acaoRecomendada || priority?.motivo || '', 500) || 'Ação sugerida pelo radar executivo.',
      tipo,
      prioridade,
      origem: sanitizeText(priority?.origem || 'geral', 120),
      gerenteSugerido: priority?.gerenteSugerido ?? null,
      prazoSugerido: mapActionDeadline(priority),
      criterioConclusao: actionConclusionForType(tipo)
    });
    if (actions.length >= 5) break;
  }
  return actions;
}

export async function buildStrategicRadar(context = {}) {
  const radarStart = Date.now();
  const accountId = context?.accountId || context?.account_id || null;
  const fontesUtilizadas = new Set();
  const [clientes, pedidos, produtos, audit, revenue, executiveMemories, managers] = await Promise.all([
    accountId ? safeCall(() => listClientes({ limit: 200 }, { accountId }), { items: [], total: 0 }) : { items: [], total: 0 },
    accountId ? safeCall(() => listPedidos({ limit: 200 }, { accountId }), { items: [], total: 0 }) : { items: [], total: 0 },
    accountId ? safeCall(() => listProdutos({ limit: 200 }, { accountId }), { items: [], total: 0 }) : { items: [], total: 0 },
    accountId ? safeCall(() => auditSummary({ accountId }), { totalProdutos: 0, comProblemas: 0, criticos: 0 }) : { totalProdutos: 0, comProblemas: 0, criticos: 0 },
    accountId ? safeCall(() => getRevenueIntelligence(accountId), {}) : {},
    accountId ? safeCall(() => listExecutiveMemories({ limit: 10 }, { accountId }), { items: [] }) : { items: [] },
    listManagers()
  ]);
  if (accountId) {
    if (Array.isArray(clientes?.items) && clientes.items.length) fontesUtilizadas.add('dashboard');
    if (Array.isArray(pedidos?.items) && pedidos.items.length) fontesUtilizadas.add('dashboard');
    if (Array.isArray(produtos?.items) && produtos.items.length) fontesUtilizadas.add('dashboard');
    if (revenue && Object.keys(revenue).length) fontesUtilizadas.add('revenue');
    if (audit && Object.keys(audit).length) fontesUtilizadas.add('auditoria');
    if (Array.isArray(executiveMemories?.items) && executiveMemories.items.length) fontesUtilizadas.add('executive_memories');
  }
  if (Array.isArray(managers) && managers.length) fontesUtilizadas.add('managers');

  const activeCustomers = Array.isArray(clientes?.items) ? clientes.items.filter((item) => item.ativo !== false) : [];
  const riskCustomers = activeCustomers.filter((item) => String(item.status || item.risco || item.health || '').toLowerCase().includes('risco'));
  const customersAtRisk = safeNumber(context?.health?.clientes_risco ?? riskCustomers.length, riskCustomers.length);
  const customersActive = safeNumber(context?.health?.clientes_ativos ?? activeCustomers.length, activeCustomers.length);
  const ordersMonth = safeNumber(context?.health?.pedidos_mes ?? pedidos?.total ?? 0, safeNumber(pedidos?.total ?? 0, 0));
  const revenueMonth = safeNumber(context?.health?.receita_mes ?? revenue?.mrr ?? revenue?.receita30 ?? 0, 0);
  const productIssues = safeNumber(audit?.comProblemas ?? 0, 0);
  const auditCriticalProducts = safeNumber(audit?.criticos ?? 0, 0);
  const totalProducts = safeNumber(audit?.totalProdutos ?? produtos?.total ?? 0, safeNumber(produtos?.total ?? 0, 0));
  const productsWithNoImage = Array.isArray(produtos?.items) ? produtos.items.filter((item) => !String(item?.imagemUrl ?? item?.imagem_url ?? item?.image_url ?? item?.foto ?? item?.foto_url ?? '').trim()).length : 0;
  const productsWithNoCategory = Array.isArray(produtos?.items) ? produtos.items.filter((item) => !String(item?.categoria ?? '').trim()).length : 0;
  const criticalMemories = Array.isArray(executiveMemories?.items)
    ? executiveMemories.items.filter((memory) => ['alta', 'critica'].includes(String(memory.severidade || '').toLowerCase()))
    : [];
  const availableManagers = Array.isArray(managers) ? managers.filter((manager) => manager?.status === 'ativo') : [];

  const alertas = [];
  if (customersAtRisk > 0) alertas.push(buildAlert('Clientes em risco', `${customersAtRisk} cliente(s) com atenção comercial.`, 'dashboard'));
  if (ordersMonth <= 0) alertas.push(buildAlert('Pedidos zerados', 'Nenhum pedido identificado no periodo atual.', 'dashboard'));
  if (revenueMonth <= 0) alertas.push(buildAlert('Receita zerada ou baixa', 'Receita do mes nao foi identificada ou esta muito baixa.', 'dashboard'));
  if (productIssues > 0) alertas.push(buildAlert('Pendências operacionais', `${productIssues} produto(s) com pendências de auditoria.`, 'product-audit'));
  if (criticalMemories.length > 0) alertas.push(buildAlert('Memórias executivas críticas', `${criticalMemories.length} memória(s) executiva(s) recente(s) em severidade alta/crítica.`, 'executive-memories'));

  const oportunidades = [];
  if (customersActive > 0) oportunidades.push(buildOpportunity('Base ativa disponível', `${customersActive} cliente(s) ativo(s) para abordagem.`, 'clientes'));
  if (customersAtRisk > 0) oportunidades.push(buildOpportunity('Reativação comercial', 'Clientes em risco podem ser reativados com apoio dos gerentes especializados.', 'comercial'));
  if (availableManagers.length > 0) oportunidades.push(buildOpportunity('Gerentes especializados disponíveis', `${availableManagers.length} gerente(s) ativos para apoio imediato.`, 'managers'));
  if (customersAtRisk > 0) oportunidades.push(buildOpportunity('Follow-up prioritário', 'Há oportunidade de consulta ao Gerente Comercial ou Follow-up.', 'followup'));

  const principalManagerId = customersAtRisk > 0 || ordersMonth <= 0 || revenueMonth <= 0 ? 'comercial' : productIssues > 0 ? 'produtos' : criticalMemories.length > 0 ? 'auditoria' : availableManagers.length > 0 ? 'followup' : null;
  const prioridadesRaw = [];
  if (customersAtRisk > 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Clientes em risco',
      impacto: 'alto',
      urgencia: 'alta',
      motivo: `${customersAtRisk} cliente(s) exigem recuperação prioritária.`,
      origem: 'clientes',
      acaoRecomendada: 'Acionar Gerente Comercial para segmentar clientes em risco e preparar plano de reativação.',
      gerenteSugerido: suggestManagerForPriority('clientes', managers, 'comercial'),
      basePeso: 90,
      numericBoost: customersAtRisk
    }));
  }
  if (ordersMonth <= 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Pedidos zerados',
      impacto: 'alto',
      urgencia: 'alta',
      motivo: 'A operação comercial nao mostrou pedidos no periodo atual.',
      origem: 'pedidos',
      acaoRecomendada: 'Investigar ausência de pedidos no período e consultar Gerente Comercial.',
      gerenteSugerido: suggestManagerForPriority('pedidos', managers, 'comercial'),
      basePeso: 85,
      numericBoost: 1
    }));
  }
  if (revenueMonth <= 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Receita zerada/baixa',
      impacto: 'alto',
      urgencia: 'alta',
      motivo: 'O faturamento precisa de checagem imediata.',
      origem: 'revenue',
      acaoRecomendada: 'Avaliar funil comercial, pedidos recentes e oportunidades de faturamento.',
      gerenteSugerido: suggestManagerForPriority('revenue', managers, 'comercial'),
      basePeso: 80,
      numericBoost: 1
    }));
  }
  if (criticalMemories.length > 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Memória executiva crítica',
      impacto: 'alto',
      urgencia: 'alta',
      motivo: `${criticalMemories.length} memória(s) executiva(s) recente(s) pedem ação imediata.`,
      origem: 'executive-memories',
      acaoRecomendada: 'Revisar memória executiva crítica e decidir ação imediata.',
      gerenteSugerido: suggestManagerForPriority('auditoria', managers, 'auditoria'),
      basePeso: 78,
      severidade: 'critica',
      numericBoost: criticalMemories.length
    }));
  }
  if (productIssues > 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Pendência de auditoria/produto',
      impacto: 'medio',
      urgencia: 'media',
      motivo: `${productIssues} produto(s) precisam de validação operacional.`,
      origem: 'auditoria',
      acaoRecomendada: 'Consultar Gerente de Produtos ou Auditoria para corrigir pendências operacionais.',
      gerenteSugerido: suggestManagerForPriority('auditoria', managers, productIssues > 1 ? 'auditoria' : 'produtos'),
      basePeso: 70,
      severidade: productIssues > 3 ? 'alta' : 'media',
      numericBoost: productIssues
    }));
  }
  if (customersAtRisk > 0 || availableManagers.length > 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Oportunidade comercial',
      impacto: 'medio',
      urgencia: 'baixa',
      motivo: 'Existe espaço para reativação e atuação conjunta com os gerentes.',
      origem: 'comercial',
      acaoRecomendada: 'Validar oportunidade e transformar em ação comercial acompanhada.',
      gerenteSugerido: suggestManagerForPriority('comercial', managers, 'comercial'),
      basePeso: 50,
      numericBoost: availableManagers.length + (customersAtRisk > 0 ? 1 : 0)
    }));
  }
  if (availableManagers.length > 0) {
    prioridadesRaw.push(buildPriorityCandidate({
      titulo: 'Gerentes disponíveis',
      impacto: 'baixo',
      urgencia: 'baixa',
      motivo: `${availableManagers.length} gerente(s) ativos podem apoiar a execução imediata.`,
      origem: 'managers',
      acaoRecomendada: 'Distribuir tarefas para os gerentes disponíveis conforme prioridade do radar.',
      gerenteSugerido: null,
      basePeso: 30,
      numericBoost: availableManagers.length
    }));
  }
  const prioridades = dedupeAndSortPriorities(prioridadesRaw);
  const acoesSugeridas = buildSuggestedActions(prioridades);

  const penalidades = [];

  const comercialPenalties = [];
  if (customersAtRisk > 0) comercialPenalties.push(buildPenalty('comercial', Math.min(25, customersAtRisk * 5), `${customersAtRisk} cliente(s) em risco exigem ação comercial.`));
  if (customersActive <= 0) comercialPenalties.push(buildPenalty('comercial', 25, 'Base ativa ausente.'));
  if (ordersMonth <= 0) comercialPenalties.push(buildPenalty('comercial', 20, 'Pedidos do mês zerados.'));
  if (revenueMonth <= 0) comercialPenalties.push(buildPenalty('comercial', 20, 'Receita do mês zerada ou indisponível.'));
  else if (revenueMonth < 1000) comercialPenalties.push(buildPenalty('comercial', 10, 'Receita do mês muito baixa.'));
  const comercialScore = buildPillar(100 - comercialPenalties.reduce((sum, item) => sum + (item?.pontos || 0), 0), [
    customersAtRisk > 0 ? 'Clientes em risco exigem ação comercial.' : null,
    customersActive > 0 ? 'Base ativa presente.' : 'Base ativa ausente.',
    ordersMonth > 0 ? 'Pedidos do mês identificados.' : 'Pedidos do mês zerados.',
    revenueMonth > 0 ? 'Receita do mês identificada.' : 'Receita do mês zerada ou muito baixa.'
  ]);

  const operacionalPenalties = [];
  if (productIssues > 0) operacionalPenalties.push(buildPenalty('operacional', Math.min(20, productIssues * 4), `${productIssues} produto(s) com pendências de auditoria.`));
  if (auditCriticalProducts > 0) operacionalPenalties.push(buildPenalty('operacional', Math.min(15, auditCriticalProducts * 5), `${auditCriticalProducts} produto(s) críticos na auditoria.`));
  if (prioridades.some((priority) => ['auditoria', 'product-audit'].includes(String(priority?.origem || '').toLowerCase()))) operacionalPenalties.push(buildPenalty('operacional', 10, 'Prioridades operacionais e de auditoria ativas.'));
  if (!audit || typeof audit !== 'object') operacionalPenalties.push(buildPenalty('operacional', 5, 'Dados operacionais indisponíveis.'));
  const operacionalScore = buildPillar(100 - operacionalPenalties.reduce((sum, item) => sum + (item?.pontos || 0), 0), [
    productIssues > 0 ? `${productIssues} pendência(s) de auditoria identificada(s).` : 'Sem pendências operacionais relevantes.',
    auditCriticalProducts > 0 ? `${auditCriticalProducts} produto(s) críticos na auditoria.` : null,
    prioridades.some((priority) => ['auditoria', 'product-audit'].includes(String(priority?.origem || '').toLowerCase()))
      ? 'Há prioridades de origem operacional/auditoria.'
      : 'Sem prioridades operacionais relevantes.'
  ]);

  const produtosPenalties = [];
  if (totalProducts <= 0) produtosPenalties.push(buildPenalty('produtos', 20, 'Ausência total de produtos.'));
  if (productsWithNoImage > 0) produtosPenalties.push(buildPenalty('produtos', Math.min(15, productsWithNoImage * 3), `${productsWithNoImage} produto(s) sem imagem.`));
  if (productsWithNoCategory > 0) produtosPenalties.push(buildPenalty('produtos', Math.min(15, productsWithNoCategory * 3), `${productsWithNoCategory} produto(s) sem categoria.`));
  if (productIssues > 0) produtosPenalties.push(buildPenalty('produtos', Math.min(10, productIssues * 2), 'Problemas de auditoria em produtos disponíveis.'));
  const produtosScore = buildPillar(100 - produtosPenalties.reduce((sum, item) => sum + (item?.pontos || 0), 0), [
    totalProducts > 0 ? `${totalProducts} produto(s) disponíveis.` : 'Sem produtos cadastrados.',
    productsWithNoImage > 0 ? `${productsWithNoImage} produto(s) sem imagem.` : 'Imagens de produtos sem alerta relevante.',
    productsWithNoCategory > 0 ? `${productsWithNoCategory} produto(s) sem categoria.` : 'Categorias de produtos sem alerta relevante.'
  ]);

  const inteligenciaPenalties = [];
  if (criticalMemories.length > 0) inteligenciaPenalties.push(buildPenalty('inteligencia', Math.min(20, criticalMemories.length * 5), `${criticalMemories.length} memória(s) executiva(s) recente(s) em severidade alta/crítica.`));
  if (availableManagers.length <= 0) inteligenciaPenalties.push(buildPenalty('inteligencia', 15, 'Nenhum gerente especializado ativo disponível.'));
  if (alertas.length <= 0) inteligenciaPenalties.push(buildPenalty('inteligencia', 5, 'Baixa observabilidade por ausência de alertas relevantes.'));
  const inteligenciaScore = buildPillar(100 - inteligenciaPenalties.reduce((sum, item) => sum + (item?.pontos || 0), 0), [
    criticalMemories.length > 0 ? `${criticalMemories.length} memória(s) executiva(s) crítica(s) recente(s).` : 'Sem memórias executivas críticas recentes.',
    availableManagers.length > 0 ? `${availableManagers.length} gerente(s) especializado(s) disponíveis.` : 'Sem gerentes especializados ativos.',
    alertas.length > 0 ? `${alertas.length} alerta(s) sinalizam observabilidade ativa.` : 'Poucos alertas podem indicar baixa observabilidade.'
  ]);

  const comercialModuleScore = moduleScoreForStatus(moduleStatusFromScore(comercialScore.valor), comercialScore.valor);
  const produtosModuleScore = moduleScoreForStatus(moduleStatusFromScore(produtosScore.valor), produtosScore.valor);
  const followupBaseScore = customersAtRisk > 0 ? 52 : prioridades.length > 0 ? 68 : 84;
  const followupModuleScore = moduleScoreForStatus(moduleStatusFromScore(followupBaseScore), followupBaseScore);
  const inteligenciaModuleScore = moduleScoreForStatus(moduleStatusFromScore(inteligenciaScore.valor), inteligenciaScore.valor);

  const observacoesPorModulo = [
    buildModuleObservation({
      modulo: 'Comercial',
      status: moduleStatusFromScore(comercialScore.valor),
      score: comercialModuleScore,
      resumo: customersActive > 0 && customersAtRisk <= 0 && ordersMonth > 0 && revenueMonth > 0
        ? 'Base ativa presente e fluxo comercial em operação.'
        : customersAtRisk > 0
          ? 'Clientes em risco exigem monitoramento.'
          : 'Receita ou pedidos zerados comprometem o desempenho comercial.',
      observacoes: [
        `Clientes ativos: ${customersActive}`,
        `Clientes em risco: ${customersAtRisk}`,
        `Pedidos do mês: ${ordersMonth}`,
        `Receita do mês: ${revenueMonth > 0 ? revenueMonth : 0}`
      ],
      gerenteResponsavel: 'Gerente Comercial'
    }),
    buildModuleObservation({
      modulo: 'Produtos',
      status: moduleStatusFromScore(produtosScore.valor),
      score: produtosModuleScore,
      resumo: totalProducts > 0 && productIssues <= 0 && productsWithNoImage <= 0 && productsWithNoCategory <= 0
        ? 'Catálogo sem pendências relevantes.'
        : productIssues > 0 || auditCriticalProducts > 0
          ? 'Problemas de auditoria podem impactar operação.'
          : 'Foram encontradas pendências cadastrais.',
      observacoes: [
        `Produtos totais: ${totalProducts}`,
        `Pendências de auditoria: ${productIssues}`,
        `Críticos na auditoria: ${auditCriticalProducts}`,
        `Produtos sem imagem: ${productsWithNoImage}`,
        `Produtos sem categoria: ${productsWithNoCategory}`
      ],
      gerenteResponsavel: 'Gerente de Produtos'
    }),
    buildModuleObservation({
      modulo: 'Follow-up',
      status: moduleStatusFromScore(followupBaseScore),
      score: followupModuleScore,
      resumo: customersAtRisk > 0
        ? 'Clientes em risco exigem ação imediata.'
        : prioridades.length > 0
          ? 'Existem oportunidades comerciais sem acompanhamento.'
          : 'Fluxo de reativação operando normalmente.',
      observacoes: [
        `Oportunidades comerciais: ${oportunidades.length}`,
        `Prioridades comerciais: ${prioridades.filter((priority) => ['clientes', 'comercial'].includes(String(priority?.origem || '').toLowerCase())).length}`,
        `Clientes em risco: ${customersAtRisk}`
      ],
      gerenteResponsavel: 'Gerente de Follow-up'
    }),
    buildModuleObservation({
      modulo: 'Inteligência',
      status: moduleStatusFromScore(inteligenciaScore.valor),
      score: inteligenciaModuleScore,
      resumo: criticalMemories.length > 0 || alertas.length > 0
        ? 'Alertas críticos e ações prioritárias pendentes.'
        : 'Radar estratégico possui cobertura adequada.',
      observacoes: [
        `Memórias executivas críticas: ${criticalMemories.length}`,
        `Alertas do radar: ${alertas.length}`,
        `Prioridades ativas: ${prioridades.length}`,
        `Ações sugeridas: ${acoesSugeridas.length}`
      ],
      gerenteResponsavel: 'Diretor IA'
    })
  ];

  const pillarEntries = [
    ...comercialPenalties,
    ...operacionalPenalties,
    ...produtosPenalties,
    ...inteligenciaPenalties
  ].filter(Boolean);
  penalidades.push(...pillarEntries);
  penalidades.sort((a, b) => b.pontos - a.pontos);
  const topPenalties = penalidades.slice(0, 10);

  const score = clamp(Math.round(
    (comercialScore.valor * 0.35) +
    (operacionalScore.valor * 0.25) +
    (produtosScore.valor * 0.2) +
    (inteligenciaScore.valor * 0.2)
  ), 0, 100);
  const principalPenalty = topPenalties[0] || null;

  const principalAttention = customersAtRisk > 0
    ? 'clientes em risco'
    : ordersMonth <= 0
      ? 'pedidos zerados'
      : revenueMonth <= 0
        ? 'receita do mes'
        : productIssues > 0
          ? 'pendências operacionais'
          : 'a operação geral';
  const principalOpportunity = customersAtRisk > 0
    ? 'reativar a base comercial com apoio dos gerentes especializados'
    : availableManagers.length > 0
      ? 'ativar os gerentes especializados disponíveis'
      : 'explorar a base ativa existente';
  const principalPriority = prioridades[0] || null;
  const mainAction = acoesSugeridas[0] || null;
  const persistenceCandidates = [
    ...alertas
      .filter((item) => isPersistableRadarInsight(buildRadarInsightCandidate(item, 'alerta')))
      .map((item) => buildRadarInsightCandidate(item, 'alerta')),
    ...prioridades
      .filter((item) => isPersistableRadarInsight(buildRadarInsightCandidate(item, 'prioridade')))
      .map((item) => buildRadarInsightCandidate(item, 'prioridade')),
    ...acoesSugeridas
      .filter((item) => isPersistableRadarInsight(buildRadarInsightCandidate(item, 'acao')))
      .map((item) => buildRadarInsightCandidate(item, 'acao')),
    ...observacoesPorModulo
      .filter((item) => isPersistableRadarInsight(buildRadarInsightCandidate(item, 'observacao')))
      .map((item) => buildRadarInsightCandidate(item, 'observacao'))
  ];
  const uniquePersistenceCandidates = [...new Map(persistenceCandidates.map((item) => [fingerprintRadarInsight(item), item])).values()];
  const persistenciaInsights = await persistStrategicRadarInsights(context, uniquePersistenceCandidates).catch(() => ({
    candidates: uniquePersistenceCandidates.length,
    persistidos: 0,
    ignorados: uniquePersistenceCandidates.length
  }));
  if (persistenciaInsights && persistenciaInsights.candidatos > 0) fontesUtilizadas.add('executive_memories');
  if (prioridades.length) fontesUtilizadas.add('followup');

  const scoreExecutivoValido = clampPercent(score);
  const classificacaoExecutiva = classificationFromScore(scoreExecutivoValido);
  const tempoGeracaoMs = Math.max(0, Date.now() - radarStart);
  const auditoria = {
    versao: '2.1',
    geradoEm: new Date().toISOString(),
    tempoGeracaoMs,
    fontesUtilizadas: [...fontesUtilizadas],
    totalAlertas: alertas.length,
    totalOportunidades: oportunidades.length,
    totalPrioridades: prioridades.length,
    totalAcoes: acoesSugeridas.length,
    totalObservacoesModulares: observacoesPorModulo.length,
    scoreExecutivo: scoreExecutivoValido,
    classificacaoExecutiva,
    consistencia: {
      scoreValido: scoreExecutivoValido >= 0 && scoreExecutivoValido <= 100,
      prioridadesValidas: prioridades.every((priority, index, array) => index === 0 || array[index - 1].peso >= priority.peso),
      acoesValidas: acoesSugeridas.every((acao, index, array) => index === 0 || array[index - 1].ordem < acao.ordem),
      limitesRespeitados: prioridades.length <= 7 && acoesSugeridas.length <= 5
    },
    qualidade: {
      percentualPrioridadesComAcao: prioridades.length ? clampPercent((prioridades.filter((priority) => Boolean(priority?.acaoRecomendada)).length / prioridades.length) * 100) : 0,
      percentualPrioridadesComGerente: prioridades.length ? clampPercent((prioridades.filter((priority) => Boolean(priority?.gerenteSugerido)).length / prioridades.length) * 100) : 0,
      percentualObservacoesComResumo: observacoesPorModulo.length ? clampPercent((observacoesPorModulo.filter((item) => Boolean(item?.resumo)).length / observacoesPorModulo.length) * 100) : 0
    }
  };

  return validateRadarShape({
    observacoesPorModulo,
    scoreExecutivo: {
      valor: scoreExecutivoValido,
      classificacao: classificacaoExecutiva,
      pilares: {
        comercial: comercialScore,
        operacional: operacionalScore,
        produtos: produtosScore,
        inteligencia: inteligenciaScore
      },
      penalidades: topPenalties,
      diagnostico: principalPenalty
        ? `Score Executivo em nível ${classificacaoExecutiva}. ${summarizePenalties(topPenalties) || 'O principal impacto está distribuído entre os pilares.'}`
        : `Score Executivo em nível ${classificacaoExecutiva}. O radar não identificou penalidades relevantes no momento.`
    },
    resumoModular: summarizeModules(observacoesPorModulo),
    resumoExecutivo: principalPriority
      ? `Score Executivo ${scoreExecutivoValido} (${classificacaoExecutiva}). O Radar identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. A prioridade máxima é ${principalPriority.titulo}. A ação sugerida é ${mainAction?.descricao || principalPriority.acaoRecomendada || 'definir o próximo passo'}${mainAction?.gerenteSugerido ? ` com apoio do ${mainAction.gerenteSugerido}` : ''}.`
      : `Score Executivo ${scoreExecutivoValido} (${classificacaoExecutiva}). O Radar identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. Não há ações críticas pendentes no momento.`,
    alertas,
    oportunidades,
    prioridades,
    acoesSugeridas,
    persistenciaInsights,
    auditoria
  });
}
