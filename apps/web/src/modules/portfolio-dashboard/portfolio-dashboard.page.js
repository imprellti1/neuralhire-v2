import { getPortfolioDashboard } from './portfolio-dashboard.service.js';
import { mapPortfolioDashboardResponse } from './portfolio-dashboard.mapper.js';
import { createPortfolioDashboardState } from './portfolio-dashboard.state.js';

const statusLabels = { all: 'Todas', healthy: 'Saudáveis', attention: 'Atenção', risk: 'Risco', critical: 'Críticas' };
const statusOrder = ['critical', 'risk', 'attention', 'healthy'];

function formatCurrency(value) { return `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function renderSkeleton() { return '<section><h1>Portfolio Dashboard</h1><p>Carregando...</p></section>'; }

function renderPage(data, state) {
  const accounts = (data.accounts || []).filter((item) => state.filter === 'all' || item.status === state.filter);
  const alerts = data.alerts || [];
  const rankings = data.rankings || {};
  if ((data.accounts || []).length === 0) {
    return '<section><h1>Portfolio Dashboard</h1><p>Nenhuma conta encontrada no portfolio.</p></section>';
  }
  return `<section class="portfolio-dashboard"><header><h1>Portfolio Dashboard</h1><p>Visão consolidada multi-contas da operação SaaS</p></header><div class="portfolio-kpis"><div>Total de contas: ${data.summary?.totalAccounts ?? 0}</div><div>Contas saudáveis: ${data.summary?.healthyAccounts ?? 0}</div><div>Contas em risco/críticas: ${(data.summary?.riskAccounts ?? 0) + (data.summary?.criticalAccounts ?? 0)}</div><div>MRR total: ${formatCurrency(data.summary?.totalMrr ?? 0)}</div><div>Receita prevista: ${formatCurrency(data.summary?.forecastRevenue ?? 0)}</div><div>Churn projetado: ${Number(data.summary?.projectedChurn ?? 0).toFixed(1)}%</div><div>Growth Score médio: ${Number(data.summary?.averageGrowthScore ?? 0).toFixed(1)}</div><div>Health Score médio: ${Number(data.summary?.averageHealthScore ?? 0).toFixed(1)}</div></div><div class="portfolio-filters">${Object.keys(statusLabels).map((key) => `<button data-filter="${key}"${state.filter === key ? ' aria-pressed="true"' : ''}>${statusLabels[key]}</button>`).join('')}</div><div class="portfolio-rankings"><section><h2>Top receita</h2><ol>${(rankings.topRevenue || []).map((item) => `<li>${item.accountName} - ${formatCurrency(item.mrr)}</li>`).join('')}</ol></section><section><h2>Top crescimento</h2><ol>${(rankings.topGrowth || []).map((item) => `<li>${item.accountName} - ${item.growthScore}</li>`).join('')}</ol></section><section><h2>Top health</h2><ol>${(rankings.topHealth || []).map((item) => `<li>${item.accountName} - ${item.healthScore}</li>`).join('')}</ol></section><section><h2>Top adoção</h2><ol>${(rankings.topAdoption || []).map((item) => `<li>${item.accountName} - ${item.adoptionScore}</li>`).join('')}</ol></section></div><h2>Contas</h2><table><thead><tr><th>Conta</th><th>Status</th><th>Health Score</th><th>Growth Score</th><th>MRR</th><th>Receita prevista</th><th>Churn projetado</th><th>TTV</th><th>Adoção</th><th>Alerta principal</th></tr></thead><tbody>${accounts.map((item) => `<tr><td>${item.accountName}</td><td>${item.status}</td><td>${item.healthScore}</td><td>${item.growthScore}</td><td>${formatCurrency(item.mrr)}</td><td>${formatCurrency(item.forecastRevenue)}</td><td>${item.projectedChurn}%</td><td>${item.ttvDays}</td><td>${item.adoptionScore}</td><td>${item.mainAlert}</td></tr>`).join('')}</tbody></table><h2>Alertas executivos</h2><div class="portfolio-alerts">${alerts.map((item) => `<article data-severity="${item.severity}"><strong>${item.accountName}</strong><span>${item.message}</span></article>`).join('')}</div></section>`;
}

export async function renderPortfolioDashboardPage(container, { apiClient }) {
  const state = createPortfolioDashboardState();
  const render = () => {
    if (state.loading) { container.innerHTML = renderSkeleton(); return; }
    if (state.error) { container.innerHTML = '<section><h1>Portfolio Dashboard</h1><p>Não foi possível carregar o Portfolio Dashboard.</p><button id="pd-retry">Tentar novamente</button></section>'; container.querySelector('#pd-retry')?.addEventListener('click', load); return; }
    container.innerHTML = renderPage(state.data, state);
    container.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.getAttribute('data-filter') || 'all'; render(); }));
  };
  const load = async () => {
    state.loading = true; state.error = null; render();
    try { state.data = mapPortfolioDashboardResponse(await getPortfolioDashboard(apiClient)); }
    catch (error) { state.error = error; }
    finally { state.loading = false; render(); }
  };
  await load();
}
