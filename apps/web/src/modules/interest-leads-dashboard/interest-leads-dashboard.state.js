import { createInterestLeadsDashboardService } from './interest-leads-dashboard.service.js'; import { mapInterestLeadsDashboard } from './interest-leads-dashboard.mapper.js';
export function createInterestLeadsDashboardState(apiClient){const s=createInterestLeadsDashboardService(apiClient);return{async load(){return mapInterestLeadsDashboard(await s.get());}}}
