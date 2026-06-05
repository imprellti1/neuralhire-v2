import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryInterestLeadsForTests } from '../../modules/interest-leads/interest-leads.repository.js';

function readJsonBody(response, fallback = {}) {
  if (!response?.body) return fallback;
  try {
    return JSON.parse(response.body);
  } catch {
    return fallback;
  }
}

export function getJornadaComercialE2ETests() { return [{ name:'jornada comercial ponta a ponta sem envio real', run: async()=>{ __resetMemoryInterestLeadsForTests(); const app=createApiApp(); let req=createTestRequest({method:'POST',url:'/interest-leads',headers:{'content-type':'application/json'},body:JSON.stringify({nome:'Ana',empresa:'Acme',email:'ana@acme.com'})}); let res=createTestResponse(); await app(req,res); assertEqual(res.statusCode,200); const leadId=readJsonBody(res).item?.id; assertEqual(Boolean(leadId), true); req=createTestRequest({method:'POST',url:'/launch/templates',headers:{'content-type':'application/json'},body:JSON.stringify({channel:'email',name:'Convite',subject:'Ola {{nome}}',body:'Bem-vinda {{nome}}',status:'active'})}); res=createTestResponse(); await app(req,res); const templateId=readJsonBody(res).item?.id; assertEqual(Boolean(templateId), true); req=createTestRequest({method:'POST',url:'/launch/preview',headers:{'content-type':'application/json'},body:JSON.stringify({leadId,templateId})}); res=createTestResponse(); await app(req,res); assertEqual(res.statusCode,200); req=createTestRequest({method:'POST',url:`/interest-leads/${leadId}/convert`}); res=createTestResponse(); await app(req,res); assertEqual(res.statusCode,200); const accountId=readJsonBody(res).accountId || readJsonBody(res).subscriberRef; assertEqual(Boolean(accountId), true); req=createTestRequest({method:'POST',url:`/accounts/${accountId}/subscription/prepare`,headers:{'content-type':'application/json'},body:JSON.stringify({planCode:'starter'})}); res=createTestResponse(); await app(req,res); assertEqual(readJsonBody(res).mode,'mock'); req=createTestRequest({method:'POST',url:`/accounts/${accountId}/onboarding/start`,headers:{'content-type':'application/json'},body:'{}'}); res=createTestResponse(); await app(req,res); assertEqual(res.statusCode,200); req=createTestRequest({method:'PATCH',url:`/accounts/${accountId}/onboarding/step`,headers:{'content-type':'application/json'},body:JSON.stringify({step:'company',data:{nomeFantasia:'Acme'}})}); res=createTestResponse(); await app(req,res); assertEqual(res.statusCode,200); req=createTestRequest({method:'POST',url:`/accounts/${accountId}/onboarding/complete`,headers:{'content-type':'application/json'},body:JSON.stringify({checklist:true})}); res=createTestResponse(); await app(req,res); assertEqual(res.statusCode,200); }}]; }
