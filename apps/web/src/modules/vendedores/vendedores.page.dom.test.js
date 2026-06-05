import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, getCapturedFetchCalls, resetFetchCalls } from '../../testing/mocks/api-client.mock.js';

test('vendedores: nome atualiza form, trim envia payload e valida antes da api', async () => {
  const dom = setupFrontendDom('#/vendedores', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  resetFetchCalls();
  let vendedores = [];
  installFetchMock({
    'GET /vendedores': () => ({ items: vendedores, pagination: { page: 1, totalPages: 1, total: vendedores.length, limit: 20 } }),
    'GET /fabricantes': () => ({ items: [{ id: 'fab-1', nome: 'Fabrica Alpha', cnpj: '123' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'POST /vendedores': ({ body }) => { vendedores = [{ id: 'v1', ...body, fabricantes: [] }]; return { id: 'v1', ...body }; },
    'PUT /vendedores/v1/fabricantes': ({ body }) => {
      vendedores = [{ id: 'v1', nome: 'Ana Souza', email: null, telefone: null, status: 'ativo', observacoes: null, fabricantes: [{ fabricante_id: 'fab-1', fabricantes: { nome: 'Fabrica Alpha' } }] }];
      return { ok: true, items: [{ fabricante_id: 'fab-1', fabricantes: { nome: 'Fabrica Alpha' } }] };
    }
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
  assert.match(document.body.textContent, /Fabrica Alpha/);

  teardownFrontendDom(dom);
});
