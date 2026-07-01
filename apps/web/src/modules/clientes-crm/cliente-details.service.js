import { mapClienteDetailsData } from './cliente-details.mapper.js';
import { fetchClienteTimeline as fetchClienteTimelineApi } from './cliente-timeline.service.js';

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

export async function atualizarCliente(apiClient, clienteId, payload) {
  return apiClient.patch(`/clientes/${clienteId}`, payload);
}

export async function sincronizarCliente360(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/sincronizar-360`);
}

export async function discoverClienteWebsite(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/web-discovery`);
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

export async function calcularSegmentacaoCliente(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/calcular-segmentacao`);
}

export async function gerarAlertasCliente(apiClient, clienteId) {
  return apiClient.post(`/clientes/${clienteId}/gerar-alertas`);
}

export async function fetchAlertasCliente(apiClient, clienteId) {
  return apiClient.get(`/clientes/${clienteId}/alertas`);
}

export async function fetchWhatsappConversationsCliente(apiClient, clienteId) {
  return apiClient.get(`/clientes/${clienteId}/whatsapp/conversations`);
}

export async function fetchWhatsappConversationMessagesCliente(apiClient, clienteId, conversationId) {
  return apiClient.get(`/clientes/${clienteId}/whatsapp/conversations/${conversationId}/messages`);
}

export async function resolverAlertaCliente(apiClient, alertaId) {
  return apiClient.patch(`/clientes/alertas/${alertaId}/resolver`, { status: 'resolvido' });
}

export async function fetchClienteDetailsData(apiClient, clienteId) {
  const [clienteResponse, pedidosResponse] = await Promise.all([
    apiClient.get(`/clientes/${clienteId}`),
    fetchAllClientePedidos(apiClient, clienteId)
  ]);

  const cliente = clienteResponse?.item || clienteResponse?.cliente || clienteResponse || null;
  const pedidos = Array.isArray(pedidosResponse) ? pedidosResponse : [];
  const timelineResponse = await fetchClienteTimelineApi(apiClient, clienteId).catch(() => ({ items: [] }));
  const timeline = Array.isArray(timelineResponse?.items) ? timelineResponse.items : [];
  return mapClienteDetailsData({ cliente, pedidos, clienteId, timeline });
}
