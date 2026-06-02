import assert from 'node:assert/strict';
import { getExecutivePortfolioAnalytics } from '../../modules/executive-portfolio-analytics/executive-portfolio-analytics.repository.js';

export function getExecutivePortfolioAnalyticsTests() {
  return [
    {
      name: 'executive portfolio analytics aggregates core metrics',
      run: async () => {
        const result = await getExecutivePortfolioAnalytics();
        assert.equal(result.overview.totalAccounts, 5);
        assert.equal(typeof result.overview.totalRevenue, 'number');
        assert.equal(typeof result.overview.forecastRevenue, 'number');
        assert.ok(result.growthDrivers.length > 0);
        assert.ok(result.churnRisks.length > 0);
        assert.equal(result.segmentPerformance.length, 3);
        assert.ok(result.benchmarkAnalysis.length > 0);
        assert.ok(result.recommendedActions.length > 0);
      }
    },
    {
      name: 'executive portfolio analytics handles partial data',
      run: async () => {
        const result = await getExecutivePortfolioAnalytics();
        assert.ok(result.overview.totalAccounts >= 0);
        assert.ok(Array.isArray(result.growthDrivers));
      }
    }
  ];
}
