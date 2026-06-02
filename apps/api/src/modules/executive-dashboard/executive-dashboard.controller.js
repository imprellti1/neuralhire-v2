import { getExecutiveDashboard } from './executive-dashboard.repository.js'; export async function getExecutiveDashboardHandler(ctx){ return getExecutiveDashboard(ctx.params.accountId); }
