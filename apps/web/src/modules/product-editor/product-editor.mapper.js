export function mapProductEditorList(response) {
  return { items: response?.items || [], pagination: response?.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 } };
}
