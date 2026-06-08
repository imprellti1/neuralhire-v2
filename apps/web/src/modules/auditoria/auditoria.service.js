export async function fetchAuditLogs(apiClient, params = {}) {
  return apiClient.get('/audit-logs', { page: params.page, limit: params.limit, search: params.search, status: params.status, data_inicial: params.startDate, data_final: params.endDate });
}
export async function fetchAuditLogById(apiClient, id) {
  return apiClient.get(`/audit-logs/${id}`);
}
