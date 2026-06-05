import { mapVendedoresData } from './vendedores.mapper.js';

export async function fetchVendedoresData(apiClient, options = {}) {
  const response = await apiClient.get('/vendedores', { search: options.search || '', status: options.status || '' });
  return mapVendedoresData(response);
}

export async function fetchFabricantesLookup(apiClient) {
  return apiClient.get('/fabricantes', { limit: 500, page: 1 });
}

export async function saveVendedor(apiClient, payload, id = null) {
  return id ? apiClient.patch(`/vendedores/${id}`, payload) : apiClient.post('/vendedores', payload);
}

export async function saveVendedorFabricantes(apiClient, vendedorId, fabricanteIds) {
  return apiClient.put(`/vendedores/${vendedorId}/fabricantes`, { fabricante_ids: fabricanteIds });
}

export async function fetchVendedorFabricantes(apiClient, vendedorId) {
  return apiClient.get(`/vendedores/${vendedorId}/fabricantes`);
}
