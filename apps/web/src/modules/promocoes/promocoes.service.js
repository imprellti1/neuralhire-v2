export async function fetchPromocoesData(apiClient, params = {}) {
  return apiClient.get('/promocoes', params);
}

export async function fetchPromocaoData(apiClient, id) {
  return apiClient.get(`/promocoes/${id}`);
}

export async function fetchProdutoPromocoesData(apiClient, produtoId) {
  return apiClient.get(`/produtos/${produtoId}/promocoes`);
}

export async function savePromocao(apiClient, payload, id = null) {
  return id ? apiClient.patch(`/promocoes/${id}`, payload) : apiClient.post('/promocoes', payload);
}

export async function deletePromocao(apiClient, id) {
  return apiClient.delete(`/promocoes/${id}`);
}

