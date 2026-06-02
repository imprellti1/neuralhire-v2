import { getExecutivePortfolioAnalytics } from './executive-portfolio-analytics.service.js';
import { mapExecutivePortfolioAnalyticsResponse } from './executive-portfolio-analytics.mapper.js';
import { createExecutivePortfolioAnalyticsState } from './executive-portfolio-analytics.state.js';

function formatCurrency(value) {
  return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderSkeleton() {
  return '<section><h1>Executive Portfolio Analytics</h1><p>Carregando...</p></section>';
}

function renderPage(data) {
  const overview = data.overview || {};
  return `<section class="executive-portfolio-analytics"><header><h1>Executive Portfolio Analytics</h1><p>Inteligência executiva consolidada da operação SaaS</p></header><div class="epa-kpis"><div>Total de contas: ${overview.totalAccounts ?? 0}</div><div>Receita total: ${formatCurrency(overview.totalRevenue ?? 0)}</div><div>Receita prevista: ${formatCurrency(overview.forecastRevenue ?? 0)}</div><div>Churn projetado: ${Number(overview.projectedChurn ?? 0).toFixed(1)}%</div><div>Health médio: ${Number(overview.averageHealthScore ?? 0).toFixed(1)}</div><div>Growth médio: ${Number(overview.averageGrowthScore ?? 0).toFixed(1)}</div></div><section><h2>Growth Drivers</h2><div class="epa-cards">${(data.growthDrivers || []).map((item) => `<article><strong>${item.accountName}</strong><span>Score: ${item.growthScore}</span><p>${item.reason}</p></article>`).join('')}</div></section><section><h2>Churn Risks</h2><div class="epa-cards">${(data.churnRisks || []).map((item) => `<article><strong>${item.accountName}</strong><span>${item.riskLevel}</span><p>${item.reason}</p></article>`).join('')}</div></section><section><h2>Segment Performance</h2><table><thead><tr><th>Segmento</th><th>Contas</th><th>Receita</th><th>Retenção</th><th>Growth</th></tr></thead><tbody>${(data.segmentPerformance || []).map((item) => `<tr><td>${item.segment}</td><td>${item.accounts}</td><td>${formatCurrency(item.revenue)}</td><td>${Number(item.retentionRate ?? 0).toFixed(1)}%</td><td>${Number(item.growthScore ?? 0).toFixed(1)}</td></tr>`).join('')}</tbody></table></section><section><h2>Benchmark Analysis</h2><table><thead><tr><th>Conta</th><th>Health</th><th>Benchmark</th><th>Diferença</th></tr></thead><tbody>${(data.benchmarkAnalysis || []).map((item) => `<tr><td>${item.accountName}</td><td>${item.healthScore}</td><td>${Number(item.benchmarkHealth ?? 0).toFixed(1)}</td><td>${Number(item.difference ?? 0).toFixed(1)}</td></tr>`).join('')}</tbody></table></section><section><h2>Recommended Actions</h2><div class="epa-cards">${(data.recommendedActions || []).map((item) => `<article data-severity="${item.severity}"><strong>${item.title}</strong><p>${item.description}</p></article>`).join('')}</div></section></section>`;
}

export async function renderExecutivePortfolioAnalyticsPage(container, { apiClient }) {
  const state = createExecutivePortfolioAnalyticsState();
  const render = () => {
    if (state.loading) { container.innerHTML = renderSkeleton(); return; }
    if (state.error) { container.innerHTML = '<section><h1>Executive Portfolio Analytics</h1><p>Não foi possível carregar Executive Portfolio Analytics.</p><button id="epa-retry">Tentar novamente</button></section>'; container.querySelector('#epa-retry')?.addEventListener('click', load); return; }
    container.innerHTML = renderPage(state.data || {});
  };
  const load = async () => {
    state.loading = true;
    state.error = null;
    render();
    try {
      state.data = mapExecutivePortfolioAnalyticsResponse(await getExecutivePortfolioAnalytics(apiClient));
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      render();
    }
  };
  await load();
}
