export async function fetchFabricantesData(apiClient, params = {}) {
  return apiClient.get('/fabricantes', params);
}

export async function fetchFabricanteData(apiClient, id) {
  return apiClient.get(`/fabricantes/${id}`);
}

export async function saveFabricante(apiClient, payload, id = null) {
  return id ? apiClient.patch(`/fabricantes/${id}`, payload) : apiClient.post('/fabricantes', payload);
}

export async function uploadFabricanteLogo(apiClient, fabricanteId, file) {
  const formData = new FormData();
  formData.append('logo', file);
  return apiClient.post(`/fabricantes/${fabricanteId}/logo`, formData);
}

export async function fetchCondicoesPagamento(apiClient, id) {
  return apiClient.get(`/fabricantes/${id}/condicoes-pagamento`);
}

export async function saveCondicaoPagamento(apiClient, fabricanteId, payload, condicaoId = null) {
  return condicaoId
    ? apiClient.patch(`/fabricantes/${fabricanteId}/condicoes-pagamento/${condicaoId}`, payload)
    : apiClient.post(`/fabricantes/${fabricanteId}/condicoes-pagamento`, payload);
}

export async function deleteCondicaoPagamento(apiClient, fabricanteId, condicaoId) {
  return apiClient.delete(`/fabricantes/${fabricanteId}/condicoes-pagamento/${condicaoId}`);
}

export async function fetchFabricanteVendedores(apiClient, fabricanteId) {
  return apiClient.get(`/fabricantes/${fabricanteId}/vendedores`);
}

export async function saveFabricanteVendedores(apiClient, fabricanteId, vendedores) {
  return apiClient.put(`/fabricantes/${fabricanteId}/vendedores`, { vendedores });
}

export async function saveFabricanteVendedor(apiClient, fabricanteId, vendedorId, payload) {
  return apiClient.patch(`/fabricantes/${fabricanteId}/vendedores/${vendedorId}`, payload);
}

export async function deleteFabricanteVendedor(apiClient, fabricanteId, vendedorId) {
  return apiClient.delete(`/fabricantes/${fabricanteId}/vendedores/${vendedorId}`);
}

export async function lookupCnpj(apiClient, cnpj) {
  return apiClient.get(`/cnpj/${cnpj}`);
}
