export function createProdutoDetailsState() {
  return {
    loading: false,
    error: false,
    notFound: false,
    data: null,
    editing: false,
    saving: false,
    form: {},
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
    usageDrillDown: null
  };
}
