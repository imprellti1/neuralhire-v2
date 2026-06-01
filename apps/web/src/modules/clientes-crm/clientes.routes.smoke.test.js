import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, flush, setHash, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { createClientesMockHandlers } from '../../testing/mocks/clientes.mock.js';
import { assertNoSensitiveTransportFields, getSanitizedFetchCalls, installFetchMock } from '../../testing/mocks/api-client.mock.js';
import { assertTransportSnapshot } from '../../testing/transport-snapshot.js';
import { assertClientePostPayload } from '../../testing/payload-contracts.js';

test('clientes: listagem/detalhe/criacao + contrato + snapshot', async () => {
  const dom = setupFrontendDom('#/clientes');
  installFetchMock(createClientesMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  setHash('#/clientes/novo');
  await flush();
  dispatchInput(document.querySelector('#empresa'), 'Acme');
  dispatchInput(document.querySelector('#nome_contato'), 'Cliente X');
  document.querySelector('#salvar')?.click();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  const post = calls.find((c) => c.method === 'POST' && c.path === '/clientes');
  if (post) assertClientePostPayload(post.body);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  assertTransportSnapshot('clientes', calls);
  teardownFrontendDom(dom);
});

test('clientes: GET sucesso + detalhe 404 e GET sucesso + detalhe 500', async () => {
  const dom404 = setupFrontendDom('#/clientes');
  installFetchMock(createClientesMockHandlers({ scenario: 'notFound' }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Cliente não encontrado|Cliente nao encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom404);

  const dom500 = setupFrontendDom('#/clientes');
  installFetchMock(createClientesMockHandlers({ scenario: 'serverError' }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar o cliente|Cliente não encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom500);
});

test('clientes: POST 422 e POST 500 em criação com erro seguro', async () => {
  const dom422 = setupFrontendDom('#/clientes/novo');
  installFetchMock(createClientesMockHandlers({ scenario: 'createValidationError' }));
  bootstrapWebApp();
  await flush();
  dispatchInput(document.querySelector('#empresa'), 'Acme');
  dispatchInput(document.querySelector('#nome_contato'), 'Cliente 422');
  document.querySelector('#salvar')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Dados invalidos|Não foi possível criar cliente/i);
  teardownFrontendDom(dom422);

  const dom500 = setupFrontendDom('#/clientes/novo');
  installFetchMock(createClientesMockHandlers({ scenario: 'createServerError' }));
  bootstrapWebApp();
  await flush();
  dispatchInput(document.querySelector('#empresa'), 'Acme');
  dispatchInput(document.querySelector('#nome_contato'), 'Cliente 500');
  document.querySelector('#salvar')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Erro interno|Não foi possível criar cliente/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom500);
});

test('clientes: cenario misto com listagem sucesso + detalhe 404/500 + criacao 422/500', async () => {
  const dom404 = setupFrontendDom('#/clientes');
  installFetchMock(createClientesMockHandlers({
    overrides: {
      'GET /clientes/c1': () => ({ __mockError: true, status: 404, body: { error: { message: 'Cliente nao encontrado' } } })
    }
  }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Cliente não encontrado|Cliente nao encontrado/i);
  teardownFrontendDom(dom404);

  const dom500 = setupFrontendDom('#/clientes');
  installFetchMock(createClientesMockHandlers({
    overrides: {
      'GET /clientes/c1': () => ({ __mockError: true, status: 500, body: { error: { message: 'Erro interno' } } })
    }
  }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar o cliente|Cliente não encontrado/i);
  teardownFrontendDom(dom500);

  const dom422 = setupFrontendDom('#/clientes/novo');
  installFetchMock(createClientesMockHandlers({ scenario: 'createValidationError' }));
  bootstrapWebApp();
  await flush();
  dispatchInput(document.querySelector('#empresa'), 'Acme');
  dispatchInput(document.querySelector('#nome_contato'), 'Cliente 422');
  document.querySelector('#salvar')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Dados invalidos|Não foi possível criar cliente/i);
  const post422 = getSanitizedFetchCalls().find((c) => c.method === 'POST' && c.path === '/clientes');
  if (post422) assertClientePostPayload(post422.body);
  teardownFrontendDom(dom422);

  const dom500Create = setupFrontendDom('#/clientes/novo');
  installFetchMock(createClientesMockHandlers({ scenario: 'createServerError' }));
  bootstrapWebApp();
  await flush();
  dispatchInput(document.querySelector('#empresa'), 'Acme');
  dispatchInput(document.querySelector('#nome_contato'), 'Cliente 500');
  document.querySelector('#salvar')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Erro interno|Não foi possível criar cliente/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom500Create);
});
