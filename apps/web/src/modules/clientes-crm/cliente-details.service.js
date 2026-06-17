import { mapClienteDetailsData } from './cliente-details.mapper.js';

async function fetchAllClientePedidos(apiClient, clienteId) {
  const items = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await apiClient.get('/pedidos', { page, limit: 100, cliente_id: clienteId });
    const pageItems = Array.isArray(response?.items) ? response.items : [];
    items.push(...pageItems);
    totalPages = Number(response?.pagination?.totalPages || 1);
    page += 1;
  } while (page <= totalPages);
  return items;
}

export async function fetchPedidoDetailsForCliente(apiClient, pedidoId) {
  return apiClient.get(`/pedidos/${pedidoId}`);
}

export async function enriquecerCliente(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/enriquecer`);
}

export async function geolocalizarCliente(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/geolocalizar`);
}

export async function calcularScoreCliente(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/calcular-score`);
}

export async function fetchClienteDetailsData(apiClient, clienteId) {
  const [clienteResponse, pedidosResponse] = await Promise.all([
    apiClient.get(`/clientes/${clienteId}`),
    fetchAllClientePedidos(apiClient, clienteId)
  ]);

  const cliente = clienteResponse?.item || clienteResponse?.cliente || clienteResponse || null;
  const pedidos = Array.isArray(pedidosResponse) ? pedidosResponse : [];
  return mapClienteDetailsData({ cliente, pedidos, clienteId });
}
