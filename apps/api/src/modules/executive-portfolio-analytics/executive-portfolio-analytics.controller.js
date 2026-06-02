import { getExecutivePortfolioAnalytics } from './executive-portfolio-analytics.repository.js';

export async function getExecutivePortfolioAnalyticsHandler() {
  return getExecutivePortfolioAnalytics();
}
