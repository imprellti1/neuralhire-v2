export function createProductAuditState() {
  return {
    loading: false,
    saving: false,
    error: false,
    empty: false,
    summary: null,
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    filters: { issue: '', fabricanteId: '', status: '', search: '', page: 1, limit: 20 },
    selected: null,
    fabricantes: [],
    modal: null
  };
}
