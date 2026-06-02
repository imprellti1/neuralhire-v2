export async function getPortfolioDashboard(apiClient) {
  return apiClient.get('/portfolio-dashboard');
}
