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
      produto: null,
      feedback: '',
      itemEditor: {
        produto: null,
        produto_id: '',
        escopo: 'all',
        aplicar_em_todas_variacoes: true,
        painel_variacoes_aberto: true,
        percentual_desconto: '',
        variacoes_disponiveis: [],
        variacao_ids: [],
        selectedVariationIds: [],
        variacoesSelecionadas: [],
        descontosPorVariacao: {},
        variacoesLoading: false,
        variacoesError: '',
        variacoesRequestId: 0,
        variacoesProdutoId: '',
        feedback: '',
        error: ''
      }
    }
  };
}
