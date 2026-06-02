import { createLaunchTemplatesService } from './launch-templates.service.js';
import { mapLaunchTemplate, mapPreview } from './launch-templates.mapper.js';

export function createLaunchTemplatesState(apiClient){const s=createLaunchTemplatesService(apiClient);return{async load(){const r=await s.list();return (r.items||[]).map(mapLaunchTemplate);},create:s.create,patch:s.patch,archive:s.archive,async preview(payload){return mapPreview((await s.preview(payload)).item||{});},async listLeads(){const r=await s.listLeads({page:1,limit:100});return r.items||[];}};}
