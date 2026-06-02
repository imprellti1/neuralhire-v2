import { createTestContext } from '../create-test-context.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { registerModules } from '../../modules/index.js';
import { createRouter } from '../../core/router.js';
import { assertEqual, assertOk } from '../assert.js';

export async function run(){
  const router=createRouter(); registerModules(router);
  const req=createTestRequest({method:'GET',url:'/accounts/acc-ret-1/customer-retention',headers:{'x-tenant-id':'t1'}});
  const res=createTestResponse();
  await router.handle(req,res,createTestContext({params:{accountId:'acc-ret-1'}}));
  assertEqual(res.statusCode,200);
  const item=res.body?.item||{};
  assertOk(item.renovacao && typeof item.renovacao.diasRestantes==='number','renovacao ausente');
  assertOk(typeof item.expansaoScore==='number','expansaoScore ausente');
  assertOk(typeof item.churnPreventivo==='string','churnPreventivo ausente');
  assertOk(Array.isArray(item.acoes),'acoes ausente');
  const req2=createTestRequest({method:'GET',url:'/accounts/acc-ret-2/customer-retention',headers:{'x-tenant-id':'t2'}});
  const res2=createTestResponse();
  await router.handle(req2,res2,createTestContext({params:{accountId:'acc-ret-2'}}));
  assertEqual(res2.statusCode,200);
  assertOk((res2.body?.item?.accountId)!==(item.accountId)||JSON.stringify(res2.body?.item)!==JSON.stringify(item),'tenant isolation/regra por conta nao variou');
}
