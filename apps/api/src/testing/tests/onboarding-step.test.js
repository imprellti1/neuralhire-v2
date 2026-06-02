import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

export function getOnboardingStepTests(){
  return [{ name:'salvar e retomar step onboarding', run: async()=>{
    const app=createApiApp();
    const req=createTestRequest({method:'PATCH',url:'/accounts/acc-2/onboarding/step',headers:{'content-type':'application/json'},body:JSON.stringify({step:'company',data:{nomeFantasia:'Acme'}})});
    const res=createTestResponse(); await app(req,res);
    assertEqual(res.statusCode,200);
  }}];
}
