import { randomUUID } from 'node:crypto';
import { onboardingSteps } from './onboarding.schemas.js';
const store=new Map();
const base=(a)=>({id:randomUUID(),account_id:a,status:'not_started',current_step:'welcome',completed_steps:[],company_profile:{},team_profile:{},commercial_profile:{},import_profile:{},completed_at:null});
export const getOnboarding=(a)=>store.get(a)||null;
export const startOnboarding=(a)=>{if(store.has(a)) return store.get(a); const i={...base(a),status:'in_progress'};store.set(a,i);return i;};
export const saveStep=(a,step,data={})=>{const cur=startOnboarding(a); if(!onboardingSteps.includes(step)) throw new Error('step invalido'); const done=Array.from(new Set([...(cur.completed_steps||[]),step])); const next={...cur,current_step:step,completed_steps:done,status:'in_progress'}; if(step==='company') next.company_profile=data; if(step==='team') next.team_profile=data; if(step==='manufacturers'||step==='checklist') next.commercial_profile=data; if(step==='import_data') next.import_profile=data; store.set(a,next); return next;};
export const completeOnboarding=(a,data={})=>{const cur=startOnboarding(a); const next={...cur,status:'completed',current_step:'finish',completed_steps:Array.from(new Set([...(cur.completed_steps||[]),'finish'])),completed_at:new Date().toISOString(),commercial_profile:{...(cur.commercial_profile||{}),checklist:data}}; store.set(a,next); return next;};
