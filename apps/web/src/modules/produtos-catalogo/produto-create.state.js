export function createProdutoCreateState() {
  return {
    form: {
      nome: '',
      sku: '',
      categoria_id: '',
      fabricante_id: '',
      preco: '',
      preco_promocional: '',
      icms_percentual: '',
      multiplo_venda: '1',
      video_url: '',
      descricao: '',
      status: 'ativo'
    },
    loading: false,
    error: '',
    success: '',
    fieldErrors: {},
    fabricantesLoading: false,
    fabricantesError: '',
    fabricantes: [],
    categorias: []
  };
}
