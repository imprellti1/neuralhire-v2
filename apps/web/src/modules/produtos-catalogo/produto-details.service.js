import { mapProdutoDetailsData, mapProdutoUpdatePayload, mapProdutoUsageData } from './produto-details.mapper.js';

export async function fetchProdutoDetailsData(apiClient, produtoId) {
  const response = await apiClient.get(`/produtos/${produtoId}`);
  return mapProdutoDetailsData(response);
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
