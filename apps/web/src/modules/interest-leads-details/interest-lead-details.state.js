import { createInterestLeadDetailsService } from './interest-lead-details.service.js'; import { mapInterestLeadDetails } from './interest-lead-details.mapper.js';
export function createInterestLeadDetailsState(apiClient){const s=createInterestLeadDetailsService(apiClient);return{async load(id){const [l,e]=await Promise.all([s.get(id),s.events(id)]);return{lead:mapInterestLeadDetails(l.item||{}),events:e.items||[]};},patch:(id,p)=>s.patch(id,p),convert:(id)=>s.convert(id)}}

