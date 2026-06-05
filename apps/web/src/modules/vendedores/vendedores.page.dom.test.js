import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, getCapturedFetchCalls, resetFetchCalls } from '../../testing/mocks/api-client.mock.js';

test('vendedores: nome atualiza form, trim envia payload e valida antes da api', async () => {
  const dom = setupFrontendDom('#/vendedores', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  resetFetchCalls();
  installFetchMock({
    'GET /vendedores': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'POST /vendedores': ({ body }) => ({ id: 'v1', ...body }),
    'PUT /vendedores/v1/fabricantes': () => ({ ok: true, items: [] })
  });

  bootstrapWebApp();
  await flush();
  await flush();

  document.querySelector('#nhv-new').click();
  await flush();
  await flush();

  const nomeInput = document.querySelector('#nhv-nome');
  dispatchInput(nomeInput, '  Ana Souza  ');
  await flush();

  assert.equal(nomeInput.value, '  Ana Souza  ');
  assert.equal(document.querySelector('#nhv-save').textContent.trim(), 'Criar vendedor');

  nomeInput.value = ' ';
  nomeInput.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhv-save').click();
  await flush();

  assert.match(document.body.textContent, /Informe o nome do vendedor/i);
  assert.equal(getCapturedFetchCalls().some((call) => call.method === 'POST' && call.path === '/vendedores'), false);

  dispatchInput(nomeInput, '  Ana Souza  ');
  await flush();
  document.querySelector('#nhv-save').click();
  await flush();
  await flush();

  const calls = getCapturedFetchCalls().filter((call) => call.method === 'POST' && call.path === '/vendedores');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.nome, 'Ana Souza');
  assert.equal(calls[0].body.email, null);

  teardownFrontendDom(dom);
});
