import { getCustomerSuccess } from '../customer-success/customer-success.repository.js';
import { getCustomerRetention } from '../customer-retention/customer-retention.repository.js';
import { getImplementationStatus } from '../implementation-tracker/implementation-tracker.repository.js';
import { getExecutiveDashboard } from '../executive-dashboard/executive-dashboard.repository.js';
import { getRevenueIntelligence } from '../revenue-intelligence/revenue-intelligence.repository.js';

const accountSeeds = [
  { accountId: 'acc-alpha', accountName: 'Alpha Cloud' },
  { accountId: 'acc-bravo', accountName: 'Bravo SaaS' },
  { accountId: 'acc-charlie', accountName: 'Charlie Stack' },
  { accountId: 'acc-delta', accountName: 'Delta Growth' },
  { accountId: 'acc-echo', accountName: 'Echo Platform' }
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value, digits = 0) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function classifyStatus(healthScore, churnScore, implementationScore) {
  const value = Math.round((healthScore * 0.5) + ((100 - churnScore) * 0.3) + (implementationScore * 0.2));
  if (value <= 25) return 'critical';
  if (value <= 50) return 'risk';
  if (value <= 75) return 'attention';
  return 'healthy';
}
function deriveAlert(account, status, healthScore, churnScore, growthScore, ttvDays) {
  if (status === 'critical') return 'Acompanhar risco de churn e retenção.';
  if (status === 'risk') return 'Reduzir riscos de expansão e adoção.';
  if (ttvDays > 30) return 'TTV acima do esperado.';
  if (growthScore >= 80) return 'Conta com forte potencial de crescimento.';
  if (healthScore < 55) return 'Health abaixo da meta.';
  if (churnScore >= 60) return 'Sinal de churn precisa de atenção.';
  return `${account.accountName} está estável.`;
}
function alertSeverity(status, churnScore, growthScore) {
  if (status === 'critical' || churnScore >= 70) return 'critical';
  if (status === 'risk' || churnScore >= 50 || growthScore < 45) return 'warning';
  return 'info';
}

async function buildAccount(accountSeed) {
  const [cs, ret, impl, exec, revenue] = await Promise.all([
    getCustomerSuccess(accountSeed.accountId),
    getCustomerRetention(accountSeed.accountId),
    Promise.resolve(getImplementationStatus(accountSeed.accountId)),
    getExecutiveDashboard(accountSeed.accountId),
    getRevenueIntelligence(accountSeed.accountId)
  ]);
  const healthScore = Number(cs?.healthScore ?? 0);
  const adoptionScore = Number(cs?.adocao ?? 0);
  const implementationScore = Number(impl?.score ?? 0);
  const churnScore = clamp(Math.round((100 - healthScore + (ret?.churnPreventivo === 'Critico' ? 35 : ret?.churnPreventivo === 'Alto' ? 22 : ret?.churnPreventivo === 'Medio' ? 12 : 4)) / 2), 0, 100);
  const ttvDays = Number(impl?.ttv?.dias ?? 31);
  const growthScore = clamp(Math.round((Number(revenue?.growthScore ?? 0) + adoptionScore + implementationScore + (100 - churnScore)) / 4), 0, 100);
  const mrr = Number(revenue?.mrr ?? 0);
  const forecastRevenue = round(Number(revenue?.receita90 ?? mrr * 3), 2);
  const projectedChurn = round(clamp(Number(revenue?.churnProjetado ?? 0), 0, 100), 1);
  const status = classifyStatus(healthScore, churnScore, implementationScore);
  const alert = deriveAlert(accountSeed, status, healthScore, churnScore, growthScore, ttvDays);
  return {
    accountId: accountSeed.accountId,
    accountName: accountSeed.accountName,
    status,
    healthScore,
    growthScore,
    mrr: round(mrr, 2),
    forecastRevenue,
    projectedChurn,
    ttvDays,
    adoptionScore,
    riskLevel: status === 'critical' ? 'high' : status === 'risk' ? 'elevated' : status === 'attention' ? 'moderate' : 'low',
    mainAlert: alert,
    _metrics: { churnScore, implementationScore, executiveScore: Number(exec?.executiveScore ?? 0) }
  };
}

function rankBy(items, key, limit = 5) { return [...items].sort((a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0)).slice(0, limit).map(({ _metrics, ...item }) => item); }

export async function getPortfolioDashboard() {
  const accounts = await Promise.all(accountSeeds.map(buildAccount));
  if (accounts.length === 0) {
    return { summary: { totalAccounts: 0, healthyAccounts: 0, attentionAccounts: 0, riskAccounts: 0, criticalAccounts: 0, totalMrr: 0, forecastRevenue: 0, projectedChurn: 0, averageGrowthScore: 0, averageHealthScore: 0 }, accounts: [], rankings: { topRevenue: [], topGrowth: [], topHealth: [], topAdoption: [] }, alerts: [] };
  }
  const summary = accounts.reduce((acc, item) => {
    acc.totalAccounts += 1;
    acc.totalMrr += item.mrr;
    acc.forecastRevenue += item.forecastRevenue;
    acc.projectedChurn += item.projectedChurn;
    acc.averageGrowthScore += item.growthScore;
    acc.averageHealthScore += item.healthScore;
    acc[`${item.status}Accounts`] += 1;
    return acc;
  }, { totalAccounts: 0, healthyAccounts: 0, attentionAccounts: 0, riskAccounts: 0, criticalAccounts: 0, totalMrr: 0, forecastRevenue: 0, projectedChurn: 0, averageGrowthScore: 0, averageHealthScore: 0 });
  summary.projectedChurn = round(summary.projectedChurn / summary.totalAccounts, 1);
  summary.averageGrowthScore = round(summary.averageGrowthScore / summary.totalAccounts, 1);
  summary.averageHealthScore = round(summary.averageHealthScore / summary.totalAccounts, 1);
  summary.totalMrr = round(summary.totalMrr, 2);
  summary.forecastRevenue = round(summary.forecastRevenue, 2);
  const alerts = accounts.map((item) => ({ accountId: item.accountId, accountName: item.accountName, severity: alertSeverity(item.status, item._metrics.churnScore, item.growthScore), type: item.status === 'critical' ? 'churn-risk' : item.status === 'risk' ? 'growth-risk' : 'health-watch', message: item.mainAlert }));
  return { summary, accounts: accounts.map(({ _metrics, ...item }) => item), rankings: { topRevenue: rankBy(accounts, 'mrr'), topGrowth: rankBy(accounts, 'growthScore'), topHealth: rankBy(accounts, 'healthScore'), topAdoption: rankBy(accounts, 'adoptionScore') }, alerts };
}
