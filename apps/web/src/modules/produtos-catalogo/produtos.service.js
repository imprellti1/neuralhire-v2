import { mapProdutosData } from './produtos.mapper.js';

export async function fetchProdutosData(apiClient, options = {}) {
  const page = Number(options.page || 1);
  const limit = Number(options.limit || 10);
  const search = options.search || '';

  const response = await apiClient.get('/produtos', { page, limit, search });
  return mapProdutosData(response);
}
