import { mapClientesData } from './clientes.mapper.js';

export async function fetchClientesData(apiClient, options = {}) {
  const page = Number(options.page || 1);
  const limit = Number(options.limit || 10);
  const search = options.search || '';
  const vendedorId = options.vendedor_id || '';

  const response = await apiClient.get('/clientes', {
    page,
    limit,
    search,
    vendedor_id: vendedorId
  });
  return mapClientesData(response);
}

export async function enriquecerCliente(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/enriquecer`);
}
