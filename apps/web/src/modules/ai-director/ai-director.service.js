export async function fetchAiDirectorDashboard(apiClient) {
  return apiClient.get('/ai-director/dashboard');
}

export async function listMemories(apiClient, params = {}) {
  return apiClient.get('/ai-director/memories', params);
}

export async function createMemory(apiClient, payload) {
  return apiClient.post('/ai-director/memories', payload);
}

export async function listManagers(apiClient) {
  return apiClient.get('/ai-director/managers');
}

export async function consultManager(apiClient, managerId, payload) {
  return apiClient.post(`/ai-director/managers/${managerId}/consult`, payload);
}

export async function delegateQuestion(apiClient, payload) {
  return apiClient.post('/ai-director/delegate', payload);
}

export async function askDirector(apiClient, payload) {
  return apiClient.post('/ai-director/ask', payload);
}
