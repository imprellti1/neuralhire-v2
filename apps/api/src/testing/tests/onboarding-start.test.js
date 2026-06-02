import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

export function getOnboardingStartTests(){
  return [{ name:'iniciar onboarding e nao duplicar onboarding', run: async()=>{
    const app=createApiApp();
    const req1=createTestRequest({method:'POST',url:'/accounts/acc-1/onboarding/start',headers:{'content-type':'application/json'},body:'{}'});
    const res1=createTestResponse(); await app(req1,res1);
    const req2=createTestRequest({method:'POST',url:'/accounts/acc-1/onboarding/start',headers:{'content-type':'application/json'},body:'{}'});
    const res2=createTestResponse(); await app(req2,res2);
    assertEqual(res1.statusCode,200); assertEqual(res2.statusCode,200);
  }}];
}
