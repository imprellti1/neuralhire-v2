import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

export function getOnboardingCompleteTests(){
  return [{ name:'concluir onboarding', run: async()=>{
    const app=createApiApp();
    const req=createTestRequest({method:'POST',url:'/accounts/acc-3/onboarding/complete',headers:{'content-type':'application/json'},body:JSON.stringify({checklist:true})});
    const res=createTestResponse(); await app(req,res);
    assertEqual(res.statusCode,200);
  }}];
}
