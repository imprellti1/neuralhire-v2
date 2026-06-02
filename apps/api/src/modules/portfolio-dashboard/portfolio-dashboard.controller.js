import { getPortfolioDashboard } from './portfolio-dashboard.repository.js';

export async function getPortfolioDashboardHandler() {
  return getPortfolioDashboard();
}
