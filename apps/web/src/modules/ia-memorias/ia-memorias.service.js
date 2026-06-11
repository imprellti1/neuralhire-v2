export function listIaMemorias(api, filters = {}) {
  return api.get('/ia-memorias', filters);
}

export function searchIaMemorias(api, payload = {}) {
  return api.post('/ia-memorias/search', payload);
}

export function getIaMemoria(api, id) {
  return api.get(`/ia-memorias/${id}`);
}

export function createIaMemoria(api, payload) {
  return api.post('/ia-memorias', payload);
}

export function updateIaMemoria(api, id, payload) {
  return api.patch(`/ia-memorias/${id}`, payload);
}

export function archiveIaMemoria(api, id) {
  return api.delete(`/ia-memorias/${id}`);
}
