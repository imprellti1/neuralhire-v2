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

function buildPriority(ordem, titulo, impacto, motivo, origem) {
  return { ordem, titulo, impacto, motivo, origem };
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

  const prioridades = [];
  if (customersAtRisk > 0) prioridades.push(buildPriority(1, 'Clientes em risco', 'alto', `${customersAtRisk} cliente(s) exigem recuperação prioritária.`, 'clientes'));
  if (ordersMonth <= 0) prioridades.push(buildPriority(2, 'Pedidos zerados', 'alto', 'A operação comercial nao mostrou pedidos no periodo atual.', 'pedidos'));
  if (revenueMonth <= 0) prioridades.push(buildPriority(3, 'Receita zerada/baixa', 'alto', 'O faturamento precisa de checagem imediata.', 'revenue'));
  if (productIssues > 0) prioridades.push(buildPriority(4, 'Pendências operacionais/auditoria', 'medio', `${productIssues} produto(s) precisam de validação operacional.`, 'auditoria'));
  if (customersAtRisk > 0 || availableManagers.length > 0) prioridades.push(buildPriority(5, 'Oportunidades comerciais', 'medio', 'Existe espaço para reativação e atuação conjunta com os gerentes.', 'comercial'));

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

  return {
    scoreExecutivo: {
      valor: score,
      classificacao: classificationFromScore(score)
    },
    resumoExecutivo: `Radar Estratégico identificou ${alertas.length} alertas, ${oportunidades.length} oportunidades e ${prioridades.length} prioridades. A principal atenção está em ${principalAttention}. A principal oportunidade é ${principalOpportunity}.`,
    alertas,
    oportunidades,
    prioridades
  };
}
