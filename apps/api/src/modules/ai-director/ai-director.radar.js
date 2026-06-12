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

  let score = 100;
  if (customersAtRisk > 0) score -= Math.min(30, customersAtRisk * 5);
  if (ordersMonth <= 0) score -= 20;
  if (revenueMonth <= 0) score -= 20;
  if (productIssues > 0) score -= Math.min(15, productIssues * 3);
  if (criticalMemories.length > 0) score -= Math.min(15, criticalMemories.length * 5);
  score = clamp(score, 0, 100);

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

  return {
    scoreExecutivo: {
      valor: score,
      classificacao: classificationFromScore(score)
    },
    resumoExecutivo: principalPriority
      ? `Radar Estratégico identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. A prioridade máxima é ${principalPriority.titulo}, com apoio sugerido do ${principalPriority.gerenteSugerido || 'gestor responsável'}. A principal atenção está em ${principalAttention}. A principal oportunidade é ${principalOpportunity}.`
      : `Radar Estratégico identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. A principal atenção está em ${principalAttention}. A principal oportunidade é ${principalOpportunity}.`,
    alertas,
    oportunidades,
    prioridades
  };
}
