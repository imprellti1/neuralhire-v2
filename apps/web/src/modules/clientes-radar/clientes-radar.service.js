export async function fetchClientesRadarData(apiClient, filters = {}) {
  return apiClient.get('/clientes/radar', {
    vendedor_id: filters.vendedor_id || '',
    cidade: filters.cidade || '',
    estado: filters.estado || '',
    segmento: filters.segmento || ''
  });
}
