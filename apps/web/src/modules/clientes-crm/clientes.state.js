export function createClientesState() {
  return {
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    search: '',
    loading: false,
    error: false,
    items: []
  };
}

