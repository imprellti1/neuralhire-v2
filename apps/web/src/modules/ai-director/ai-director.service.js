export async function fetchAiDirectorDashboard(apiClient) {
  return apiClient.get('/ai-director/dashboard');
}

export async function listMemories(apiClient, params = {}) {
  return apiClient.get('/ai-director/memories', params);
}

export async function createMemory(apiClient, payload) {
  return apiClient.post('/ai-director/memories', payload);
}
