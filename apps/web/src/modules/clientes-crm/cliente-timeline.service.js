export async function fetchClienteTimeline(apiClient, clienteId) {
  return apiClient.get(`/clientes/${clienteId}/timeline`);
}
