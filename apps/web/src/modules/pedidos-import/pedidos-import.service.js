export function previewPedidosImport(apiClient, payload) {
  return apiClient.post('/pedidos/importacao/preview', payload);
}

export function executePedidosImport(apiClient, payload) {
  return apiClient.post('/pedidos/importacao', payload);
}
