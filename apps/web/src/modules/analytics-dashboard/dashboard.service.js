import { mapDashboardData } from './dashboard.mapper.js';

export async function fetchDashboardData(apiClient, filters, headers = {}) {
  const q = {
    startDate: filters.startDate,
    endDate: filters.endDate,
    limit: 10
  };

  const [summary, customers, products, timeline] = await Promise.all([
    apiClient.get('/analytics/summary', q, headers),
    apiClient.get('/analytics/customers', q, headers),
    apiClient.get('/analytics/products', q, headers),
    apiClient.get('/analytics/timeline', q, headers)
  ]);

  return mapDashboardData(summary, customers, products, timeline);
}
