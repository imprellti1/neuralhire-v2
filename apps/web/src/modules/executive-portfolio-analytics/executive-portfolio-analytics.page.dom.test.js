import test from 'node:test';
import assert from 'node:assert/strict';
import { renderExecutivePortfolioAnalyticsPage } from './executive-portfolio-analytics.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('executive portfolio analytics dom renders core sections and states', async () => {
  const dom = setupFrontendDom('#/executive-portfolio-analytics');
  let calls = 0;
  const apiClient = {
    get: async () => {
      calls += 1;
      if (calls === 1) throw new Error('fail');
      return {
        item: {
          overview: { totalAccounts: 2, healthyAccounts: 1, riskAccounts: 1, criticalAccounts: 0, totalRevenue: 12000, forecastRevenue: 30000, projectedChurn: 12.5, averageHealthScore: 79, averageGrowthScore: 71 },
          growthDrivers: [{ id: '1', accountName: 'Conta A', growthScore: 90, reason: 'Alta adoção e crescimento consistente.' }],
          churnRisks: [{ id: '2', accountName: 'Conta B', riskLevel: 'warning', healthScore: 55, reason: 'Saúde abaixo do benchmark executivo.' }],
          segmentPerformance: [{ segment: 'SMB', accounts: 1, revenue: 7000, retentionRate: 91.9, growthScore: 80 }],
          benchmarkAnalysis: [{ id: '1', accountName: 'Conta A', healthScore: 88, benchmarkHealth: 79, difference: 9 }],
          recommendedActions: [{ severity: 'warning', title: 'Executar plano de retenção.', description: 'Conta B apresenta churn projetado elevado.' }]
        }
      };
    }
  };
  await renderExecutivePortfolioAnalyticsPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Não foi possível carregar/i);
  document.querySelector('#epa-retry').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Executive Portfolio Analytics/i);
  assert.match(document.body.textContent, /Total de contas: 2/i);
  assert.match(document.body.textContent, /Conta A/i);
  assert.match(document.body.textContent, /Conta B/i);
  assert.match(document.body.textContent, /Segmento/i);
  assert.match(document.body.textContent, /Benchmark Analysis/i);
  assert.match(document.body.textContent, /Recommended Actions/i);
  teardownFrontendDom(dom);
});
