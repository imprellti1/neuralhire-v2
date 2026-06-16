export function createGruposComerciaisState() {
  return {
    loading: false,
    error: false,
    items: [],
    selected: null,
    form: null,
    modalOpen: false,
    clientesModalOpen: false,
    clientesLoading: false,
    clientesError: '',
    clientesDisponiveis: [],
    clientesVinculados: [],
    search: '',
    clienteSearch: '',
    selectedClienteIds: new Set(),
    saving: false,
    formError: ''
  };
}
