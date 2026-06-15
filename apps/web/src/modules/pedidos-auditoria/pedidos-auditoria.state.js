export function createPedidosAuditoriaState() {
  return {
    loading: true,
    error: false,
    items: [],
    pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    filters: { issue: '', status: '', search: '' },
    modal: null,
    selected: null,
    form: { comissao_principal_percentual: '', comissao_preposto_percentual: '', data_faturamento: '', vendedor_id: '' },
    vendedores: [],
    vendedoresLoading: false,
    vendedoresError: ''
  };
}
