import { mapOperationalDashboardData } from './operational-dashboard.mapper.js';

export async function fetchOperationalDashboardData(apiClient, filters) {
  const response = await apiClient.get('/pedidos', { page: 1, limit: 100, status: filters.status !== 'all' ? filters.status : undefined });
  return mapOperationalDashboardData(response?.items || [], filters);
}
