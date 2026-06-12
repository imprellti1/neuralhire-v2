export async function fetchAiDirectorDashboard(apiClient) {
  return apiClient.get('/ai-director/dashboard');
}
