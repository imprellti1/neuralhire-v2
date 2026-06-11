const initialProdutosState = {
  pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
  search: '',
  searchDraft: '',
  searchApplied: '',
  loading: false,
  error: false,
  items: [],
  scrollTop: 0,
  scrollY: 0
};

let produtosState = null;

export function createProdutosState() {
  return {
    ...initialProdutosState,
    pagination: { ...initialProdutosState.pagination },
    items: []
  };
}

export function getProdutosState() {
  if (!produtosState) produtosState = createProdutosState();
  return produtosState;
}

export function resetProdutosState() {
  produtosState = createProdutosState();
  return produtosState;
}

export function updateProdutosState(patch = {}) {
  const current = getProdutosState();
  Object.assign(current, patch);
  current.pagination = {
    ...current.pagination,
    ...(patch.pagination || {})
  };
  if (Array.isArray(patch.items)) current.items = patch.items;
  produtosState = current;
  return current;
}
