export async function fetchAiDirectorDashboard(apiClient) {
  return apiClient.get('/ai-director/dashboard');
}

export async function listMemories(apiClient, params = {}) {
  return apiClient.get('/ai-director/memories', params);
}

export async function listExecutiveMemories(apiClient, params = {}) {
  return apiClient.get('/ai-director/executive-memories', params);
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

export async function listObservations(apiClient, params = {}) {
  return apiClient.get('/ai-director/observations', params);
}

export async function listActionPlans(apiClient, params = {}) {
  return apiClient.get('/ai-director/action-plans', params);
}

export async function updateActionPlanStatus(apiClient, id, payload) {
  return apiClient.patch(`/ai-director/action-plans/${id}/status`, payload);
}

export async function listTasks(apiClient, params = {}) {
  return apiClient.get('/ai-director/tasks', params);
}

export async function updateTaskStatus(apiClient, id, payload) {
  return apiClient.patch(`/ai-director/tasks/${id}/status`, payload);
}

export async function completeTask(apiClient, id, payload = {}) {
  return apiClient.patch(`/ai-director/tasks/${id}/complete`, payload);
}
