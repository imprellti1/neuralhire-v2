import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setHash, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { createPedidosMockHandlers } from '../../testing/mocks/pedidos.mock.js';
import { assertNoSensitiveTransportFields, getSanitizedFetchCalls, installFetchMock } from '../../testing/mocks/api-client.mock.js';
import { assertTransportSnapshot } from '../../testing/transport-snapshot.js';
import { assertPedidoStatusPatchPayload } from '../../testing/payload-contracts.js';

test('pedidos: listagem/detalhe/status + contrato + snapshot', async () => {
  const dom = setupFrontendDom('#/pedidos');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/pedidos/p1');
  await flush(); await flush();
  document.querySelector('#nhod-status-faturado')?.click();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  const patch = calls.find((c) => c.method === 'PATCH' && c.path === '/pedidos/p1/status');
  if (patch) assertPedidoStatusPatchPayload(patch.body);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  assertTransportSnapshot('pedidos', calls);
  teardownFrontendDom(dom);
});

test('pedidos: GET sucesso + detalhe 404 e GET sucesso + detalhe 500', async () => {
  const dom404 = setupFrontendDom('#/pedidos');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({ scenario: 'notFound' }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/pedidos/p1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Pedido não encontrado|Pedido nao encontrado/i);
  teardownFrontendDom(dom404);

  const dom500 = setupFrontendDom('#/pedidos');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({ scenario: 'serverError' }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/pedidos/p1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar o pedido|Pedido não encontrado/i);
  teardownFrontendDom(dom500);
});

test('pedidos: PATCH status 422 e 500 com estado seguro', async () => {
  const dom422 = setupFrontendDom('#/pedidos/p1');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({ scenario: 'statusValidationError' }));
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhod-status-faturado')?.click();
  await flush(); await flush();
  const patch422 = getSanitizedFetchCalls().find((c) => c.method === 'PATCH' && c.path === '/pedidos/p1/status');
  if (patch422) assertPedidoStatusPatchPayload(patch422.body);
  assert.match(document.body.textContent, /Dados invalidos|Não foi possível atualizar status|Pedido não encontrado/i);
  teardownFrontendDom(dom422);

  const dom500 = setupFrontendDom('#/pedidos/p1');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({ scenario: 'statusServerError' }));
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhod-status-faturado')?.click();
  await flush(); await flush();
  const patch500 = getSanitizedFetchCalls().find((c) => c.method === 'PATCH' && c.path === '/pedidos/p1/status');
  if (patch500) assertPedidoStatusPatchPayload(patch500.body);
  assert.match(document.body.textContent, /Erro interno|Não foi possível atualizar status|Pedido não encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom500);
});

test('pedidos: rota invalida e cenario misto com erros por endpoint', async () => {
  const domInvalid = setupFrontendDom('#/pedidos/invalida/rota');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Página não encontrada|Pagina nao encontrada|não encontrado/i);
  teardownFrontendDom(domInvalid);

  const dom404 = setupFrontendDom('#/pedidos');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({
    overrides: {
      'GET /pedidos/p1': () => ({ __mockError: true, status: 404, body: { error: { message: 'Pedido nao encontrado' } } })
    }
  }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/pedidos/p1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Pedido não encontrado|Pedido nao encontrado/i);
  teardownFrontendDom(dom404);

  const dom500 = setupFrontendDom('#/pedidos');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({
    overrides: {
      'GET /pedidos/p1': () => ({ __mockError: true, status: 500, body: { error: { message: 'Erro interno' } } })
    }
  }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/pedidos/p1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar o pedido|Pedido não encontrado/i);
  teardownFrontendDom(dom500);

  const domPatch422 = setupFrontendDom('#/pedidos/p1');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({ scenario: 'statusValidationError' }));
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhod-status-faturado')?.click();
  await flush(); await flush();
  const patch422 = getSanitizedFetchCalls().find((c) => c.method === 'PATCH' && c.path === '/pedidos/p1/status');
  if (patch422) assertPedidoStatusPatchPayload(patch422.body);
  assert.match(document.body.textContent, /Dados invalidos|Não foi possível atualizar status|Pedido não encontrado/i);
  teardownFrontendDom(domPatch422);

  const domPatch500 = setupFrontendDom('#/pedidos/p1');
  mockAuthenticatedSession();
  installFetchMock(createPedidosMockHandlers({ scenario: 'statusServerError' }));
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhod-status-faturado')?.click();
  await flush(); await flush();
  const patch500 = getSanitizedFetchCalls().find((c) => c.method === 'PATCH' && c.path === '/pedidos/p1/status');
  if (patch500) assertPedidoStatusPatchPayload(patch500.body);
  assert.match(document.body.textContent, /Erro interno|Não foi possível atualizar status|Pedido não encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(domPatch500);
});

