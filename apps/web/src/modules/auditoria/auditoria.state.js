export function createAuditoriaState() {
  return { loading: true, error: false, items: [], selected: null, search: '', filters: { status: '', startDate: '', endDate: '' }, pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } };
}
