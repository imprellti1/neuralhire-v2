export function createProdutoCreateState() {
  return {
    form: {
      nome: '',
      sku: '',
      categoria: '',
      preco: '',
      descricao: '',
      status: 'ativo'
    },
    loading: false,
    error: '',
    success: '',
    fieldErrors: {}
  };
}
