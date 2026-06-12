export function previewClientesImport(apiClient, payload) {
  return apiClient.post('/clientes/importacao/preview', payload);
}

export function executeClientesImport(apiClient, payload) {
  return apiClient.post('/clientes/importacao', payload);
}
