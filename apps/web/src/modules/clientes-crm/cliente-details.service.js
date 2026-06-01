import { mapClienteDetailsData } from './cliente-details.mapper.js';

export async function fetchClienteDetailsData(apiClient, clienteId) {
  const [clientesResponse, pedidosResponse] = await Promise.all([
    apiClient.get('/clientes', { page: 1, limit: 200 }),
    apiClient.get('/pedidos', { page: 1, limit: 500 })
  ]);

  const pedidos = Array.isArray(pedidosResponse?.items) ? pedidosResponse.items : [];
  const pedidosCliente = pedidos.filter((pedido) => String(pedido?.cliente_id || '') === String(clienteId || ''));
  const pedidosComItens = await Promise.all(
    pedidosCliente.map(async (pedido) => {
      if (Array.isArray(pedido?.itens) && pedido.itens.length) return pedido;
      try {
        const detail = await apiClient.get(`/pedidos/${pedido.id}`);
        return { ...pedido, itens: Array.isArray(detail?.itens) ? detail.itens : [] };
      } catch {
        return { ...pedido, itens: [] };
      }
    })
  );

  const pedidosById = new Map(pedidosComItens.map((p) => [p.id, p]));
  const hydratedPedidos = pedidos.map((p) => pedidosById.get(p.id) || p);
  return mapClienteDetailsData({ clientesResponse, pedidosResponse: { ...pedidosResponse, items: hydratedPedidos }, clienteId });
}
