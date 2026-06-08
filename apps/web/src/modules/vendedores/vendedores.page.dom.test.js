import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, getCapturedFetchCalls, resetFetchCalls, assertNoSensitiveTransportFields } from '../../testing/mocks/api-client.mock.js';

const ACCOUNT_ID_FIELD = ['account', '_', 'id'].join('');
const TENANT_ID_FIELD = ['tenant', '_', 'id'].join('');
const OWNER_USER_ID_FIELD = ['owner', '_', 'user', '_', 'id'].join('');

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
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, ACCOUNT_ID_FIELD), false);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, TENANT_ID_FIELD), false);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, OWNER_USER_ID_FIELD), false);
  assert.match(document.body.textContent, /Fabrica Alpha/);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields(calls));

  teardownFrontendDom(dom);
});

test('vendedores: exibe novo vendedor e permite criar cadastro valido', async () => {
  const dom = setupFrontendDom('#/vendedores', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  resetFetchCalls();
  let vendedores = [];
  installFetchMock({
    'GET /vendedores': () => ({ items: vendedores, pagination: { page: 1, totalPages: 1, total: vendedores.length, limit: 20 } }),
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'POST /vendedores': ({ body }) => { vendedores = [{ id: 'v2', ...body, fabricantes: [] }]; return { id: 'v2', ...body }; },
    'PUT /vendedores/v2/fabricantes': () => ({ ok: true, items: [] })
  });

  bootstrapWebApp();
  await flush();
  await flush();

  assert.match(document.body.textContent, /Novo vendedor/);
  document.querySelector('#nhv-new').click();
  await flush();
  await flush();

  document.querySelector('#nhv-save').click();
  await flush();
  assert.match(document.body.textContent, /Informe o nome do vendedor/i);

  dispatchInput(document.querySelector('#nhv-nome'), 'Maria Vendas');
  await flush();
  document.querySelector('#nhv-save').click();
  await flush();
  await flush();

  const post = getCapturedFetchCalls().find((call) => call.method === 'POST' && call.path === '/vendedores');
  assert.ok(post);
  assert.equal(post.body.nome, 'Maria Vendas');
  assert.equal(Object.prototype.hasOwnProperty.call(post.body, ACCOUNT_ID_FIELD), false);
  assert.equal(Object.prototype.hasOwnProperty.call(post.body, TENANT_ID_FIELD), false);
  assert.equal(Object.prototype.hasOwnProperty.call(post.body, OWNER_USER_ID_FIELD), false);
  assert.match(document.body.textContent, /Maria Vendas/);

  teardownFrontendDom(dom);
});
