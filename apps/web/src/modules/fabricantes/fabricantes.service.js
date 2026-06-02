export async function fetchFabricantesData(apiClient, params = {}) {
  return apiClient.get('/fabricantes', params);
}

export async function fetchFabricanteData(apiClient, id) {
  return apiClient.get(`/fabricantes/${id}`);
}

export async function saveFabricante(apiClient, payload, id = null) {
  return id ? apiClient.patch(`/fabricantes/${id}`, payload) : apiClient.post('/fabricantes', payload);
}

export async function fetchCondicoesPagamento(apiClient, id) {
  return apiClient.get(`/fabricantes/${id}/condicoes-pagamento`);
}

export async function saveCondicaoPagamento(apiClient, fabricanteId, payload, condicaoId = null) {
  return condicaoId
    ? apiClient.patch(`/fabricantes/${fabricanteId}/condicoes-pagamento/${condicaoId}`, payload)
    : apiClient.post(`/fabricantes/${fabricanteId}/condicoes-pagamento`, payload);
}
