export function createProdutoCreateState() {
  return {
    form: {
      nome: '',
      sku: '',
      categoria: '',
      fabricante_id: '',
      preco: '',
      descricao: '',
      status: 'ativo'
    },
    loading: false,
    error: '',
    success: '',
    fieldErrors: {},
    fabricantesLoading: false,
    fabricantesError: '',
    fabricantes: []
  };
}
