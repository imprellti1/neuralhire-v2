export function createIaMemoriasState() {
  return {
    loading: false,
    error: null,
    items: [],
    filters: { search: '', tipo: '', modulo: '', tag: '', status: 'ativa' },
    selected: null,
    editing: null,
    showForm: false
  };
}

