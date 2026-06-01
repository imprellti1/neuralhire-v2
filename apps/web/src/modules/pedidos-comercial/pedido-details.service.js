import { mapPedidoDetailsData } from './pedido-details.mapper.js';

function unwrapPayload(payload = {}) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object') return payload.data;
  return payload;
}

export async function fetchPedidoDetailsData(apiClient, pedidoId) {
  const [pedidoResponse, historyResponse] = await Promise.all([
    apiClient.get(`/pedidos/${pedidoId}`),
    apiClient.get(`/pedidos/${pedidoId}/history`).catch(() => ({ items: [] }))
  ]);

  return mapPedidoDetailsData(unwrapPayload(pedidoResponse), unwrapPayload(historyResponse));
}

export async function updatePedidoStatus(apiClient, pedidoId, status) {
  return apiClient.patch(`/pedidos/${pedidoId}/status`, { status });
}

export async function fetchProdutosCatalogData(apiClient) {
  const response = unwrapPayload(await apiClient.get('/produtos', { page: 1, limit: 500 }));
  return Array.isArray(response?.items) ? response.items : [];
}

export async function updatePedidoItens(apiClient, pedidoId, itens) {
  return apiClient.patch(`/pedidos/${pedidoId}/itens`, { itens });
}

export async function fetchClientesCatalogData(apiClient) {
  const response = unwrapPayload(await apiClient.get('/clientes', { page: 1, limit: 500 }));
  return Array.isArray(response?.items) ? response.items : [];
}

export async function updatePedidoGeral(apiClient, pedidoId, payload) {
  return apiClient.patch(`/pedidos/${pedidoId}`, payload);
}
