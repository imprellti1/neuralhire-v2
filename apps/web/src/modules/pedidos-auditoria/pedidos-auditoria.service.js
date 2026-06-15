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
