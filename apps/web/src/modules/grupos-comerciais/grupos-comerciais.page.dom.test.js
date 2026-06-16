import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, findButtonByText, flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { getCapturedFetchCalls, installFetchMock, resetFetchCalls } from '../../testing/mocks/api-client.mock.js';

function openNewGroupModal() {
  findButtonByText('Novo grupo').click();
}

test('grupos comerciais modal atualiza payload, valida nome e trata erro 422', async () => {
  const dom = setupFrontendDom('#/grupos-comerciais');
  mockAuthenticatedSession();

  const posted = [];
  installFetchMock({
    'GET /grupos-comerciais': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'POST /grupos-comerciais': ({ body }) => {
      posted.push(body);
      return { item: { id: 'gc-1' } };
    }
  });

  bootstrapWebApp();
  await flush();
  await flush();

  openNewGroupModal();
  dispatchInput(document.querySelector('#nhgc-nome'), 'Grupo Alpha');
  dispatchInput(document.querySelector('#nhgc-descricao'), 'Descricao teste');
  findButtonByText('Salvar').click();
  await flush();
  await flush();

  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0], { nome: 'Grupo Alpha', descricao: 'Descricao teste', ativo: true });
  assert.equal(getCapturedFetchCalls().some((call) => call.path === '/grupos-comerciais' && call.method === 'POST'), true);

  teardownFrontendDom(dom);
});

test('grupos comerciais nao chama api com nome vazio e mostra validacao local', async () => {
  const dom = setupFrontendDom('#/grupos-comerciais');
  mockAuthenticatedSession();
  let posted = 0;
  installFetchMock({
    'GET /grupos-comerciais': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'POST /grupos-comerciais': () => {
      posted += 1;
      return { item: { id: 'gc-1' } };
    }
  });

  bootstrapWebApp();
  await flush();
  await flush();

  openNewGroupModal();
  findButtonByText('Salvar').click();
  await flush();
  await flush();

  assert.equal(posted, 0);
  assert.match(document.body.textContent, /Informe um nome para o grupo comercial\./i);
  teardownFrontendDom(dom);
});

test('grupos comerciais limpa loading e mostra mensagem amigavel ao receber 422', async () => {
  const dom = setupFrontendDom('#/grupos-comerciais');
  mockAuthenticatedSession();
  resetFetchCalls();
  installFetchMock({
    'GET /grupos-comerciais': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'POST /grupos-comerciais': () => ({ __mockError: true, status: 422, body: { error: { message: 'Nome invalido' } } })
  });

  bootstrapWebApp();
  await flush();
  await flush();

  openNewGroupModal();
  dispatchInput(document.querySelector('#nhgc-nome'), 'Grupo Beta');
  findButtonByText('Salvar').click();
  await flush();
  await flush();
  await flush();

  const saveButton = findButtonByText('Salvar');
  assert.ok(saveButton);
  assert.equal(saveButton.disabled, false);
  assert.match(document.body.textContent, /Informe um nome para o grupo comercial\./i);
  assert.equal(document.body.textContent.includes('Salvando...'), false);

  teardownFrontendDom(dom);
});

test('clientes do grupo dispara busca com 1 caractere e ignora string vazia', async () => {
  const dom = setupFrontendDom('#/grupos-comerciais');
  mockAuthenticatedSession();
  resetFetchCalls();
  const searched = [];
  installFetchMock({
    'GET /grupos-comerciais': () => ({ items: [{ id: 'gc-1', nome: 'Grupo Alpha', descricao: '', ativo: true }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /grupos-comerciais/gc-1/clientes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 10 } }),
    'GET /clientes': ({ query }) => {
      searched.push(query?.search ?? null);
      return { items: [{ id: 'c-1', nome: 'Silva', email: 'silva@example.com' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 10 } };
    }
  });

  bootstrapWebApp();
  await flush();
  await flush();

  findButtonByText('Clientes do grupo').click();
  await flush();
  await flush();

  const modal = document.querySelector('.nhgc-modal');
  const input = document.querySelector('#nhgc-cliente-search');
  input.focus();
  dispatchInput(input, 'S');
  await flush();
  await flush();

  assert.deepEqual(searched, ['S']);
  assert.equal(document.querySelector('#nhgc-cliente-search'), input);
  assert.equal(document.querySelector('#nhgc-cliente-search')?.value, 'S');
  assert.equal(document.querySelector('.nhgc-modal'), modal);
  assert.equal(document.activeElement, input);
  assert.match(document.body.textContent, /Silva/i);

  dispatchInput(input, 'SA');
  await flush();
  await flush();

  assert.deepEqual(searched, ['S', 'SA']);
  assert.equal(document.querySelector('#nhgc-cliente-search'), input);
  assert.equal(document.querySelector('#nhgc-cliente-search')?.value, 'SA');
  assert.equal(document.querySelector('.nhgc-modal'), modal);
  assert.equal(document.activeElement, input);

  dispatchInput(input, 'SAN');
  await flush();
  await flush();

  assert.deepEqual(searched, ['S', 'SA', 'SAN']);
  assert.equal(document.querySelector('#nhgc-cliente-search'), input);
  assert.equal(document.querySelector('#nhgc-cliente-search')?.value, 'SAN');
  assert.equal(document.querySelector('.nhgc-modal'), modal);
  assert.equal(document.activeElement, input);

  dispatchInput(input, 'SANTA');
  await flush();
  await flush();

  assert.deepEqual(searched, ['S', 'SA', 'SAN', 'SANTA']);
  assert.equal(document.querySelector('#nhgc-cliente-search'), input);
  assert.equal(document.querySelector('#nhgc-cliente-search')?.value, 'SANTA');
  assert.equal(document.querySelector('.nhgc-modal'), modal);
  assert.equal(document.activeElement, input);

  dispatchInput(input, '');
  await flush();
  await flush();

  assert.deepEqual(searched, ['S', 'SA', 'SAN', 'SANTA']);
  assert.equal(document.querySelector('#nhgc-cliente-search'), input);
  assert.equal(document.querySelector('#nhgc-cliente-search')?.value, '');
  assert.equal(document.querySelector('.nhgc-modal'), modal);
  assert.equal(document.activeElement, input);
  teardownFrontendDom(dom);
});
