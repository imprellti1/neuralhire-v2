export function createPedidosState() {
  return {
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    search: '',
    status: 'all',
    period: 'all',
    loading: false,
    error: false,
    items: []
  };
}
