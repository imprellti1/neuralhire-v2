import { mapProdutoCreatePayload } from './produto-create.mapper.js';

export async function createProduto(apiClient, form) {
  const payload = mapProdutoCreatePayload(form);
  return apiClient.post('/produtos', payload);
}
