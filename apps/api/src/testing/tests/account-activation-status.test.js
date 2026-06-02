import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { completeOnboarding, startOnboarding } from '../../modules/onboarding/onboarding.repository.js';

export function getAccountActivationStatusTests(){
  return [{ name:'activation status tenant isolation and percentual', run: async()=>{
    const json = (res) => JSON.parse(String(res.body || '{}'));
    __resetMemoryClientesForTests(); __resetMemoryProdutosForTests(); __resetMemoryPedidosForTests();
    const app=createApiApp(); const accountA='acc-a'; const accountB='acc-b';
    const req0=createTestRequest({method:'GET',url:`/accounts/${accountA}/activation-status`,headers:{'x-account-id':accountA}}); const res0=createTestResponse(); await app(req0,res0);
    assertEqual(res0.statusCode,200); assertEqual(json(res0).item.percentual,0);
    startOnboarding(accountA); completeOnboarding(accountA,{ok:true});
    const cliente = await createCliente({ nome:'Acme', owner_user_id:'u1' }, { accountId:accountA });
    const clienteId = cliente.id;
    const produto = await createProduto({ nome:'Prod', preco:10 }, { accountId:accountA });
    const produtoId = produto.id;
    await createPedido({ cliente_id:clienteId, itens:[{ produto_id:produtoId, quantidade:1 }] }, { accountId:accountA });
    const reqA=createTestRequest({method:'GET',url:`/accounts/${accountA}/activation-status`,headers:{'x-account-id':accountA}}); const resA=createTestResponse(); await app(reqA,resA);
    const bodyA = json(resA);
    assertEqual(resA.statusCode,200); assertEqual(bodyA.item.clientesImportados,true); assertEqual(bodyA.item.produtosImportados,true); assertEqual(bodyA.item.pedidosImportados,true); assertEqual(bodyA.item.percentual >= 66, true);
    const reqB=createTestRequest({method:'GET',url:`/accounts/${accountB}/activation-status`,headers:{'x-account-id':accountB}}); const resB=createTestResponse(); await app(reqB,resB); assertEqual(json(resB).item.percentual,0);
  }}];
}

