export function createProductEditorState() {
  return {
    loading: false,
    saving: false,
    error: false,
    empty: false,
    dirty: false,
    items: [],
    selected: null,
    variations: [],
    filters: { search: '' },
    form: { nome: '', sku: '', descricao: '', fabricanteId: '', categoria: '', subcategoria: '', familia: '', colecao: '', preco: '', precoUnitario: '', status: 'ativo', imagemUrl: '', galeria: [] }
  };
}
