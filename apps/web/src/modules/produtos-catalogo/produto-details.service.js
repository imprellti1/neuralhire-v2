import { mapProdutoDetailsData, mapProdutoUpdatePayload, mapProdutoUsageData } from './produto-details.mapper.js';

export async function fetchProdutoDetailsData(apiClient, produtoId) {
  const response = await apiClient.get(`/produtos/${produtoId}`);
  let enriched = response;
  if (!Array.isArray(response?.item?.variacoes) && !Array.isArray(response?.item?.variations) && !Array.isArray(response?.variacoes) && !Array.isArray(response?.variations)) {
    try {
      const variationsResponse = await apiClient.get(`/produtos/${produtoId}/variacoes`);
      enriched = { ...response, variacoes: Array.isArray(variationsResponse?.items) ? variationsResponse.items : variationsResponse?.variacoes };
    } catch {
      enriched = response;
    }
  }
  return mapProdutoDetailsData(enriched);
}

export async function fetchProdutoImagens(apiClient, produtoId) {
  const response = await apiClient.get(`/produtos/${produtoId}/imagens`);
  return Array.isArray(response?.items) ? response.items : [];
}

export async function uploadProdutoImagem(apiClient, produtoId, payload) {
  return apiClient.post(`/produtos/${produtoId}/imagens`, payload);
}

export async function updateProdutoImagem(apiClient, produtoId, imagemId, payload) {
  return apiClient.patch(`/produtos/${produtoId}/imagens/${imagemId}`, payload);
}

export async function deleteProdutoImagem(apiClient, produtoId, imagemId) {
  return apiClient.delete(`/produtos/${produtoId}/imagens/${imagemId}`);
}

export async function updateProduto(apiClient, produtoId, form) {
  const payload = mapProdutoUpdatePayload(form);
  return apiClient.patch(`/produtos/${produtoId}`, payload);
}

export async function fetchProdutoUsageData(apiClient, produtoId) {
  const list = await apiClient.get('/pedidos', { page: 1, limit: 200 });
  const pedidos = Array.isArray(list?.items) ? list.items : [];
  const hydrated = await Promise.all(pedidos.map(async (pedido) => {
    if (Array.isArray(pedido?.itens) && pedido.itens.length) return pedido;
    try {
      const detail = await apiClient.get(`/pedidos/${pedido.id}`);
      return { ...pedido, itens: Array.isArray(detail?.itens) ? detail.itens : [] };
    } catch {
      return { ...pedido, itens: [] };
    }
  }));
  return mapProdutoUsageData(produtoId, hydrated);
}
