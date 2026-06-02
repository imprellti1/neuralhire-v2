import { createInterestLeadsLaunchService } from './interest-leads-launch.service.js';
import { mapLaunchLead } from './interest-leads-launch.mapper.js';

export function createInterestLeadsLaunchState(apiClient){const s=createInterestLeadsLaunchService(apiClient);return{loadDashboard:()=>s.dashboard(),async loadList(filters={}){const r=await s.list(filters);return{items:(r.items||[]).map(mapLaunchLead),pagination:r.pagination||{}};},invite:s.invite,bulk:s.bulk,listTemplates:s.listTemplates,preview:s.preview,queue:s.queue};}
