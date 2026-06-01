export function createOperationalDashboardState() {
  const today = new Date();
  const end = today.toISOString().slice(0, 10);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - 29);
  return {
    filters: { period: '30d', status: 'all', startDate: startDate.toISOString().slice(0, 10), endDate: end },
    loading: false,
    error: false,
    data: null
  };
}
