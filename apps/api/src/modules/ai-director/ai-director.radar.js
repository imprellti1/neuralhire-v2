import { listClientes } from '../clientes/clientes.repository.js';
import { listPedidos } from '../pedidos/pedidos.repository.js';
import { listProdutos } from '../produtos/produtos.repository.js';
import { auditSummary } from '../product-audit/product-audit.repository.js';
import { getRevenueIntelligence } from '../revenue-intelligence/revenue-intelligence.repository.js';
import { listExecutiveMemories, listManagers } from './ai-director.repository.js';

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function classificationFromScore(score) {
  if (score >= 90) return 'Excelente';
  if (score >= 75) return 'Boa';
  if (score >= 60) return 'Atenção';
  return 'Crítica';
}

function pillarStatusFromScore(score) {
  if (score >= 90) return 'excelente';
  if (score >= 75) return 'bom';
  if (score >= 60) return 'atencao';
  return 'critico';
}

function buildPenalty(origem, pontos, motivo) {
  const safePoints = Math.max(0, Math.round(safeNumber(pontos, 0)));
  return safePoints > 0 ? { origem, pontos: safePoints, motivo } : null;
}

function buildPillar(value, fatores = []) {
  const score = clamp(Math.round(value), 0, 100);
  return {
    valor: score,
    status: pillarStatusFromScore(score),
    fatores: fatores.filter(Boolean)
  };
}

function moduleStatusFromScore(score) {
  if (score >= 80) return 'saudavel';
  if (score >= 60) return 'atencao';
  return 'critico';
}

function moduleScoreForStatus(status, base = 0) {
  const safeBase = clamp(Math.round(base), 0, 100);
  if (status === 'saudavel') return clamp(Math.max(80, safeBase), 0, 100);
  if (status === 'atencao') return clamp(Math.max(60, safeBase), 0, 100);
  return clamp(Math.min(59, safeBase || 45), 0, 100);
}

function buildModuleObservation({ modulo, status, score, resumo, observacoes = [], gerenteResponsavel = null }) {
  return {
    modulo,
    status,
    score: clamp(Math.round(score), 0, 100),
    resumo,
    observacoes: Array.isArray(observacoes) ? observacoes.filter(Boolean) : [],
    gerenteResponsavel
  };
}

function summarizeModules(modulos = []) {
  const total = modulos.length;
  const counts = modulos.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { saudavel: 0, atencao: 0, critico: 0 });
  const principal = [...modulos].sort((a, b) => {
    const rank = { critico: 3, atencao: 2, saudavel: 1 };
    if ((rank[b.status] || 0) !== (rank[a.status] || 0)) return (rank[b.status] || 0) - (rank[a.status] || 0);
    return a.score - b.score;
  })[0];
  const principalText = principal ? `O principal ponto de atenção está no módulo ${principal.modulo}.` : 'Nenhum módulo apresentou desvio relevante.';
  return `${total} módulos observados. ${counts.saudavel} saudáveis, ${counts.atencao} em atenção e ${counts.critico} crítico${counts.critico === 1 ? '' : 's'}. ${principalText}`;
}

function summarizePenalties(penalidades = []) {
  if (!penalidades.length) return null;
  const main = penalidades[0];
  return `O principal impacto está no pilar ${String(main.origem || '').toLowerCase()}, com ${main.motivo.toLowerCase()}`;
}

async function safeCall(fn, fallback) {
  try {
    return await fn();
  } catch {
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function buildAlert(tipo, descricao, origem) {
  return { tipo, titulo: tipo, descricao, origem };
}

function buildOpportunity(tipo, descricao, origem) {
  return { tipo, titulo: tipo, descricao, origem };
}

function normalizeUrgency(value) {
  const text = String(value ?? '').toLowerCase();
  if (text === 'alta') return 'alta';
  if (text === 'media' || text === 'média') return 'media';
  return 'baixa';
}

function normalizeImpact(value) {
  const text = String(value ?? '').toLowerCase();
  if (text === 'alto' || text === 'alta') return 'alto';
  if (text === 'medio' || text === 'médio' || text === 'media' || text === 'média') return 'medio';
  return 'baixo';
}

function clampPriorityWeight(value) {
  return clamp(Math.round(value), 0, 100);
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
    titulo,
    impacto: normalizeImpact(impacto),
    urgencia: normalizeUrgency(urgencia),
    motivo,
    origem,
    acaoRecomendada,
    gerenteSugerido: gerenteSugerido ?? null,
    peso: clampPriorityWeight(peso)
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
  const peso = basePeso + impactBonus(impacto) + urgencyBonus(urgencia) + severityBonus(severidade) + quantBonus(numericBoost);
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
      titulo,
      descricao: String(priority?.acaoRecomendada || priority?.motivo || '').trim() || 'Ação sugerida pelo radar executivo.',
      tipo,
      prioridade,
      origem: String(priority?.origem || 'geral'),
      gerenteSugerido: priority?.gerenteSugerido ?? null,
      prazoSugerido: mapActionDeadline(priority),
      criterioConclusao: actionConclusionForType(tipo)
    });
    if (actions.length >= 5) break;
  }
  return actions;
}

export async function buildStrategicRadar(context = {}) {
  const accountId = context?.accountId || context?.account_id || null;
  const [clientes, pedidos, produtos, audit, revenue, executiveMemories, managers] = await Promise.all([
    accountId ? safeCall(() => listClientes({ limit: 200 }, { accountId }), { items: [], total: 0 }) : { items: [], total: 0 },
    accountId ? safeCall(() => listPedidos({ limit: 200 }, { accountId }), { items: [], total: 0 }) : { items: [], total: 0 },
    accountId ? safeCall(() => listProdutos({ limit: 200 }, { accountId }), { items: [], total: 0 }) : { items: [], total: 0 },
    accountId ? safeCall(() => auditSummary({ accountId }), { totalProdutos: 0, comProblemas: 0, criticos: 0 }) : { totalProdutos: 0, comProblemas: 0, criticos: 0 },
    accountId ? safeCall(() => getRevenueIntelligence(accountId), {}) : {},
    accountId ? safeCall(() => listExecutiveMemories({ limit: 10 }, { accountId }), { items: [] }) : { items: [] },
    listManagers()
  ]);

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

  return {
    observacoesPorModulo,
    scoreExecutivo: {
      valor: score,
      classificacao: classificationFromScore(score),
      pilares: {
        comercial: comercialScore,
        operacional: operacionalScore,
        produtos: produtosScore,
        inteligencia: inteligenciaScore
      },
      penalidades: topPenalties,
      diagnostico: principalPenalty
        ? `Score Executivo em nível ${classificationFromScore(score)}. ${summarizePenalties(topPenalties) || 'O principal impacto está distribuído entre os pilares.'}`
        : `Score Executivo em nível ${classificationFromScore(score)}. O radar não identificou penalidades relevantes no momento.`
    },
    resumoModular: summarizeModules(observacoesPorModulo),
    resumoExecutivo: principalPriority
      ? `Score Executivo ${score} (${classificationFromScore(score)}). O Radar identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. A prioridade máxima é ${principalPriority.titulo}. A ação sugerida é ${mainAction?.descricao || principalPriority.acaoRecomendada || 'definir o próximo passo'}${mainAction?.gerenteSugerido ? ` com apoio do ${mainAction.gerenteSugerido}` : ''}.`
      : `Score Executivo ${score} (${classificationFromScore(score)}). O Radar identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. Não há ações críticas pendentes no momento.`,
    alertas,
    oportunidades,
    prioridades,
    acoesSugeridas
  };
}
