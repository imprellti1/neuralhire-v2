import { mapClientesData } from './clientes.mapper.js';

export async function fetchClientesData(apiClient, options = {}) {
  const page = Number(options.page || 1);
  const limit = Number(options.limit || 10);
  const search = options.search || '';

  const response = await apiClient.get('/clientes', { page, limit });
  return mapClientesData(response, search);
}
