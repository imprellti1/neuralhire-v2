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
