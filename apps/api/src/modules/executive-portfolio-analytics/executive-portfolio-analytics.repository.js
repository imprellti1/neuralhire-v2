import { getCustomerSuccess } from '../customer-success/customer-success.repository.js';
import { getCustomerRetention } from '../customer-retention/customer-retention.repository.js';
import { getImplementationStatus } from '../implementation-tracker/implementation-tracker.repository.js';
import { getRevenueIntelligence } from '../revenue-intelligence/revenue-intelligence.repository.js';
import { getExecutiveDashboard } from '../executive-dashboard/executive-dashboard.repository.js';
import { getPortfolioDashboard } from '../portfolio-dashboard/portfolio-dashboard.repository.js';

const accountSeeds = [
  { accountId: 'acc-alpha', accountName: 'Alpha Cloud' },
  { accountId: 'acc-bravo', accountName: 'Bravo SaaS' },
  { accountId: 'acc-charlie', accountName: 'Charlie Stack' },
  { accountId: 'acc-delta', accountName: 'Delta Growth' },
  { accountId: 'acc-echo', accountName: 'Echo Platform' }
];

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value, digits = 1) { const factor = 10 ** digits; return Math.round(Number(value || 0) * factor) / factor; }
function average(items, key) { return items.length === 0 ? 0 : round(items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / items.length, 1); }
function segmentFor(accountId, explicitSegment) { if (explicitSegment) return explicitSegment; const order = ['SMB', 'Mid Market', 'Enterprise']; const index = Math.abs(String(accountId || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % order.length; return order[index]; }
function formatReason({ growthScore, healthScore, mrr, forecastRevenue, churnProjected }) { if (growthScore >= 80 && forecastRevenue >= mrr * 2) return 'Alta adoção e crescimento consistente.'; if (forecastRevenue >= mrr * 1.6) return 'Expansão acelerada de receita.'; if (healthScore >= 75) return 'Saúde operacional acima da média.'; if (churnProjected >= 55) return 'Conta com sinais claros de retenção em risco.'; return 'Conta com performance relevante no portfolio.'; }
function benchmarkDifference(value, benchmark) { return round(Number(value || 0) - Number(benchmark || 0), 1); }
function recommendedActionFor(account) { if (account.status === 'critical') return { severity: 'critical', title: 'Priorizar Customer Success em contas críticas.', description: `${account.accountName} exige intervenção imediata para conter risco de churn.` }; if (account.projectedChurn >= 45) return { severity: 'warning', title: 'Executar plano de retenção.', description: `${account.accountName} apresenta churn projetado elevado e precisa de acompanhamento dedicado.` }; if (account.growthScore >= 75) return { severity: 'info', title: 'Explorar expansão nas contas líderes.', description: `${account.accountName} tem sinais consistentes de expansão e é uma boa candidata a upsell.` }; if (account.healthScore < 60) return { severity: 'warning', title: 'Revisar onboarding de contas com TTV elevado.', description: `${account.accountName} precisa reduzir fricções operacionais para melhorar adoção.` }; return { severity: 'info', title: 'Manter acompanhamento da conta.', description: `${account.accountName} está estável, mas vale monitorar a evolução do portfolio.` }; }

async function buildAccount(seed, portfolioAccount) {
  const [cs, retention, implementation, revenue, executive] = await Promise.all([
    getCustomerSuccess(seed.accountId),
    getCustomerRetention(seed.accountId),
    Promise.resolve(getImplementationStatus(seed.accountId)),
    getRevenueIntelligence(seed.accountId),
    getExecutiveDashboard(seed.accountId)
  ]);
  const healthScore = Number(cs?.healthScore ?? 0);
  const growthScore = clamp(Math.round((Number(revenue?.growthScore ?? 0) + Number(retention?.expansaoScore ?? 0) + Number(implementation?.score ?? 0) + Number(cs?.adocao ?? 0)) / 4), 0, 100);
  const mrr = Number(revenue?.mrr ?? portfolioAccount?.mrr ?? 0);
  const forecastRevenue = round(Number(revenue?.receita90 ?? portfolioAccount?.forecastRevenue ?? mrr * 3), 2);
  const projectedChurn = round(clamp(Number(revenue?.churnProjetado ?? 0), 0, 100), 1);
  const status = healthScore <= 25 || projectedChurn >= 70 ? 'critical' : healthScore <= 50 || projectedChurn >= 45 ? 'risk' : 'healthy';
  return { accountId: seed.accountId, accountName: seed.accountName, segment: segmentFor(seed.accountId, portfolioAccount?.segment), status, healthScore, growthScore, mrr, forecastRevenue, projectedChurn, executiveScore: Number(executive?.executiveScore ?? 0), reason: formatReason({ growthScore, healthScore, mrr, forecastRevenue, churnProjected: projectedChurn }), riskLevel: status === 'critical' ? 'critical' : status === 'risk' ? 'warning' : 'info', retentionRate: clamp(round(100 - projectedChurn, 1), 0, 100) };
}

export async function getExecutivePortfolioAnalytics() {
  const portfolio = await getPortfolioDashboard();
  const accounts = await Promise.all(accountSeeds.map((seed, index) => buildAccount(seed, portfolio.accounts?.[index])));
  if (accounts.length === 0) return { overview: { totalAccounts: 0, healthyAccounts: 0, riskAccounts: 0, criticalAccounts: 0, totalRevenue: 0, forecastRevenue: 0, projectedChurn: 0, averageHealthScore: 0, averageGrowthScore: 0 }, growthDrivers: [], churnRisks: [], segmentPerformance: [], benchmarkAnalysis: [], recommendedActions: [] };
  const overview = accounts.reduce((acc, account) => { acc.totalAccounts += 1; acc.totalRevenue += account.mrr; acc.forecastRevenue += account.forecastRevenue; acc.projectedChurn += account.projectedChurn; acc.averageHealthScore += account.healthScore; acc.averageGrowthScore += account.growthScore; if (account.status === 'healthy') acc.healthyAccounts += 1; if (account.status === 'risk') acc.riskAccounts += 1; if (account.status === 'critical') acc.criticalAccounts += 1; return acc; }, { totalAccounts: 0, healthyAccounts: 0, riskAccounts: 0, criticalAccounts: 0, totalRevenue: 0, forecastRevenue: 0, projectedChurn: 0, averageHealthScore: 0, averageGrowthScore: 0 });
  overview.totalRevenue = round(overview.totalRevenue, 2); overview.forecastRevenue = round(overview.forecastRevenue, 2); overview.projectedChurn = round(overview.projectedChurn / overview.totalAccounts, 1); overview.averageHealthScore = average(accounts, 'healthScore'); overview.averageGrowthScore = average(accounts, 'growthScore');
  const growthDrivers = [...accounts].sort((a, b) => (b.growthScore - a.growthScore) || (b.mrr - a.mrr) || (b.forecastRevenue - a.forecastRevenue)).slice(0, 5).map(({ accountId, accountName, growthScore, reason }) => ({ accountId, accountName, growthScore, reason }));
  const churnRisks = [...accounts]
    .sort((a, b) => (b.projectedChurn - a.projectedChurn) || (a.healthScore - b.healthScore))
    .slice(0, 5)
    .map((account) => ({
      accountId: account.accountId,
      accountName: account.accountName,
      riskLevel: account.riskLevel,
      healthScore: account.healthScore,
      reason: account.projectedChurn >= 70 ? 'Churn projetado muito elevado.' : account.status === 'critical' ? 'Conta em estado crítico.' : account.projectedChurn >= 45 ? 'Sinais de retenção exigem atenção.' : 'Saúde abaixo do benchmark executivo.'
    }));
  const segmentOrder = ['SMB', 'Mid Market', 'Enterprise'];
  const segmentPerformance = segmentOrder.map((segment) => { const segmentAccounts = accounts.filter((account) => account.segment === segment); const totalRevenue = segmentAccounts.reduce((sum, account) => sum + account.mrr, 0); return { segment, accounts: segmentAccounts.length, revenue: round(totalRevenue, 2), retentionRate: round(segmentAccounts.length ? segmentAccounts.reduce((sum, account) => sum + account.retentionRate, 0) / segmentAccounts.length : 0, 1), growthScore: round(segmentAccounts.length ? segmentAccounts.reduce((sum, account) => sum + account.growthScore, 0) / segmentAccounts.length : 0, 1) }; });
  const benchmarkHealth = overview.averageHealthScore; const benchmarkGrowth = overview.averageGrowthScore;
  const benchmarkAnalysis = accounts.map((account) => ({ accountId: account.accountId, accountName: account.accountName, healthScore: account.healthScore, benchmarkHealth, difference: benchmarkDifference(account.healthScore, benchmarkHealth) }));
  const recommendedActions = accounts.map((account) => ({ ...recommendedActionFor(account), _score: account.growthScore + account.healthScore - account.projectedChurn })).sort((a, b) => b._score - a._score).slice(0, 5).map(({ _score, ...action }) => action);
  return { overview, growthDrivers, churnRisks, segmentPerformance, benchmarkAnalysis, recommendedActions, benchmark: { healthScore: benchmarkHealth, growthScore: benchmarkGrowth } };
}
