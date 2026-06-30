import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

function parseBody(res){ try { return JSON.parse(res.body||'{}'); } catch { return {}; } }
async function call(app,{method,url,role,accountId,userId,body}) {
  const headers={};
  if(role) headers['x-test-role']=role;
  if(accountId) headers['x-test-account-id']=accountId;
  if(userId) headers['x-test-user-id']=userId;
  if(body!==undefined) headers['content-type']='application/json';
  const req=createTestRequest({method,url,headers,body:body!==undefined?JSON.stringify(body):null});
  const res=createTestResponse();
  await app(req,res);
  return {res,body:parseBody(res)};
}

export function getCommercialOwnershipTests(){
  return [{
    name:'ownership comercial por vendedor em clientes/pedidos/analytics',
    run: async()=>{
      const app=createApiApp();
      const accountId='acc-own';
      const salesA={role:'sales',accountId,userId:'sales-a'};
      const salesB={role:'sales',accountId,userId:'sales-b'};
      const manager={role:'manager',accountId,userId:'mgr-1'};

      const cA=await call(app,{method:'POST',url:'/clientes',...salesA,body:{nome:'Cliente A',owner_user_id:'sales-b'}});
      assertEqual(cA.res.statusCode,200);
      assertEqual(cA.body.item.owner_user_id,'sales-a');

      const cB=await call(app,{method:'POST',url:'/clientes',...salesB,body:{nome:'Cliente B'}});
      assertEqual(cB.res.statusCode,200);

      const listA=await call(app,{method:'GET',url:'/clientes',...salesA});
      assertEqual(listA.body.items.length,1);
      assertEqual(listA.body.items[0].owner_user_id,'sales-a');

      const listManager=await call(app,{method:'GET',url:'/clientes',...manager});
      assertEqual(listManager.body.items.length,2);

      const otherTenant=await call(app,{method:'GET',url:'/clientes',role:'manager',accountId:'acc-other',userId:'mgr-o'});
      assertEqual(otherTenant.body.items.length,0);

      const pA=await call(app,{method:'POST',url:'/produtos',role:'admin',accountId,userId:'adm-1',body:{nome:'Produto A',preco:100}});
      const badPedido=await call(app,{method:'POST',url:'/pedidos',...salesA,body:{cliente_id:cB.body.item.id,itens:[{produto_id:pA.body.item.id,quantidade:1}]}});
      assertEqual(badPedido.res.statusCode,403);

      const okPedidoA=await call(app,{method:'POST',url:'/pedidos',...salesA,body:{cliente_id:cA.body.item.id,itens:[{produto_id:pA.body.item.id,quantidade:1}]}});
      assertEqual(okPedidoA.res.statusCode,200);
      const okPedidoB=await call(app,{method:'POST',url:'/pedidos',...salesB,body:{cliente_id:cB.body.item.id,itens:[{produto_id:pA.body.item.id,quantidade:2}]}});
      assertEqual(okPedidoB.res.statusCode,200);

      const pedidosA=await call(app,{method:'GET',url:'/pedidos',...salesA});
      assertEqual(pedidosA.body.items.length,2);

      const pedidosFiltrados=await call(app,{method:'GET',url:`/pedidos?cliente_id=${cA.body.item.id}`,...salesA});
      assertEqual(pedidosFiltrados.body.items.length,1);
      assertEqual(pedidosFiltrados.body.items[0].cliente_id,cA.body.item.id);

      const managerPedidos=await call(app,{method:'GET',url:'/pedidos',...manager});
      assertEqual(managerPedidos.body.items.length,2);

      const analyticsSales=await call(app,{method:'GET',url:'/analytics/summary',...salesA});
      assertEqual(analyticsSales.body.totalPedidos,2);

      const analyticsManager=await call(app,{method:'GET',url:'/analytics/summary',...manager});
      assertEqual(analyticsManager.body.totalPedidos,2);
    }
  }];
}
