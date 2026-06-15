export async function fetchPedidosAuditoria(apiClient, params = {}) {
  return apiClient.get('/pedidos/auditoria', {
    page: params.page,
    limit: params.limit,
    issue: params.issue,
    status: params.status,
    search: params.search
  });
}

export async function patchPedidoComissao(apiClient, pedidoId, body) {
  return apiClient.patch(`/pedidos/${pedidoId}/comissao`, body);
}

export async function patchPedidoFaturamento(apiClient, pedidoId, body) {
  return apiClient.patch(`/pedidos/${pedidoId}/faturamento`, body);
}

export async function patchPedidoVendedor(apiClient, pedidoId, body) {
  return apiClient.patch(`/pedidos/${pedidoId}/vendedor`, body);
}

export async function fetchVendedoresData(apiClient) {
  return apiClient.get('/vendedores', { limit: 500, page: 1 });
}
