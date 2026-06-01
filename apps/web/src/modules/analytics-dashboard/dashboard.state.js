export function createDashboardState() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 29);
  const start = startDate.toISOString().slice(0, 10);

  return {
    filters: { period: '30d', startDate: start, endDate: end },
    loading: false,
    error: false,
    data: null
  };
}
