import { mapPedidosData } from './pedidos.mapper.js';

export async function fetchPedidosData(apiClient, options = {}) {
  const page = Number(options.page || 1);
  const limit = Number(options.limit || 10);
  const search = options.search || '';
  const status = options.status || 'all';
  const period = options.period || 'all';

  const response = await apiClient.get('/pedidos', {
    page,
    limit,
    status: status !== 'all' ? status : undefined
  });

  return mapPedidosData(response, { search, status, period });
}
