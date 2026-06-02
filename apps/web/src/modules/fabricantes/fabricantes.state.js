export function createFabricantesState() {
  return {
    loading: false,
    saving: false,
    error: false,
    empty: false,
    retry: false,
    success: false,
    search: '',
    status: '',
    items: [],
    selected: null,
    condicoes: [],
    form: {
      nome: '',
      razao_social: '',
      cnpj: '',
      logo_url: '',
      status: 'ativo',
      pedido_minimo: 0,
      boleto_minimo: 0,
      comissao_padrao_percentual: 0,
      prazo_maximo_dias: '',
      observacoes: ''
    },
    condicaoForm: {
      nome: '',
      codigo: '',
      parcelas: 1,
      prazo_medio_dias: 0,
      valor_minimo: 0,
      percentual_acrescimo: 0,
      ativo: true,
      observacoes: ''
    }
  };
}
