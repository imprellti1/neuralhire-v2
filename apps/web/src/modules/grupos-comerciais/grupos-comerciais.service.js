export async function fetchGruposComerciais(apiClient) { return apiClient.get('/grupos-comerciais'); }
export async function saveGrupoComercial(apiClient, payload, id = null) { return id ? apiClient.patch(`/grupos-comerciais/${id}`, payload) : apiClient.post('/grupos-comerciais', payload); }
export async function fetchGrupoComercialClientes(apiClient, grupoId) { return apiClient.get(`/grupos-comerciais/${grupoId}/clientes`); }
export async function addGrupoComercialClientes(apiClient, grupoId, clienteIds) { return apiClient.post(`/grupos-comerciais/${grupoId}/clientes`, { clienteIds }); }
export async function removeGrupoComercialCliente(apiClient, grupoId, clienteId) { return apiClient.delete(`/grupos-comerciais/${grupoId}/clientes/${clienteId}`); }
export async function searchClientes(apiClient, search) { return apiClient.get('/clientes', { search, limit: 10, page: 1 }); }
