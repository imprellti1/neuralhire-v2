export async function getExecutivePortfolioAnalytics(apiClient) {
  return apiClient.get('/executive-portfolio-analytics');
}
