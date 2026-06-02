import test from 'node:test'; import assert from 'node:assert/strict';
import { setupFrontendDom, teardownFrontendDom, flush, installFetchMock } from '../../testing/frontend-test-utils.js';
import { bootstrapWebApp } from '../../app.js';
test('activation route smoke', async()=>{ const dom=setupFrontendDom('#/activation'); installFetchMock({'GET /accounts/acc-demo/activation-status':()=>({ok:true,item:{empresaConfigurada:false,vendedoresCadastrados:false,clientesImportados:false,produtosImportados:false,pedidosImportados:false,dashboardDisponivel:false,percentual:0}})}); bootstrapWebApp(); await flush(); await flush(); assert.match(document.body.textContent,/Ativacao Inicial/i); teardownFrontendDom(dom);});
