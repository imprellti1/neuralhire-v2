export function createProdutoDetailsState() {
  return {
    loading: false,
    error: false,
    notFound: false,
    data: null,
    editing: false,
    saving: false,
    form: {},
    fabricantes: [],
    categorias: [],
    fabricantesLoading: false,
    fabricantesError: '',
    fieldErrors: {},
    feedbackMessage: '',
    usageLoading: false,
    usageError: false,
    usage: null,
    usageFilters: {
      period: '30d',
      status: 'todos'
    },
    usageVisibleCount: 5,
    usageDrillDown: null,
    variationsExpanded: true
  };
}
