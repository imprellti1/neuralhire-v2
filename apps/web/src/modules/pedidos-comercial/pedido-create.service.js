import { mapPedidoCreatePayload } from './pedido-create.mapper.js';

export async function fetchPedidoCreateDependencies(apiClient) {
  const [clientesResponse, produtosResponse] = await Promise.all([
    apiClient.get('/clientes', { page: 1, limit: 500 }),
    apiClient.get('/produtos', { page: 1, limit: 500 })
  ]);

  const clientesRaw = Array.isArray(clientesResponse?.items) ? clientesResponse.items : [];
  const produtosRaw = Array.isArray(produtosResponse?.items) ? produtosResponse.items : [];

  const clientes = clientesRaw.map((item) => ({
    id: item?.id,
    nome: item?.empresa || item?.razao_social || item?.nome || 'Cliente sem nome'
  }));

  const produtos = produtosRaw.map((item) => ({
    id: item?.id,
    nome: item?.nome || item?.produto || 'Produto sem nome',
    preco: Number(item?.preco ?? item?.price ?? 0)
  }));

  return { clientes, produtos };
}

export async function createPedido(apiClient, state) {
  const payload = mapPedidoCreatePayload(state);
  return apiClient.post('/pedidos', payload);
}
