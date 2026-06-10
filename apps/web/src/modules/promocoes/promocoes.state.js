export function createPromocoesState() {
  return {
    items: [],
    loading: false,
    error: '',
    productSearchOpen: false,
    productSearchLoading: false,
    productSearchTerm: '',
    productSearchItems: [],
    productSearchError: '',
    form: {
      aplicar_em_todas_variacoes: true,
      variacao_ids: [],
      variacoesSelecionadas: [],
      produto: null,
      variacoes_disponiveis: []
    }
  };
}
