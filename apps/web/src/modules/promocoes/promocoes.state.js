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
      nome: '',
      descricao: '',
      status: 'ativa',
      data_inicio: '',
      data_fim: '',
      percentual_desconto: '',
      produto_id: '',
      produtos: [],
      aplicar_em_todas_variacoes: true,
      variacao_ids: [],
      variacoesSelecionadas: [],
      produto: null,
      variacoes_disponiveis: []
    }
  };
}
