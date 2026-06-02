export function createProductAuditState() {
  return {
    loading: false,
    saving: false,
    error: false,
    empty: false,
    summary: null,
    items: [],
    filters: { issue: '', fabricanteId: '', status: '', search: '', page: 1, limit: 20 },
    selected: null,
    fabricantes: [],
    modal: null
  };
}
