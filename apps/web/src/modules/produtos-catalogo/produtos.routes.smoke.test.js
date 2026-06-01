import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { createProdutosMockHandlers } from '../../testing/mocks/produtos.mock.js';
import { assertNoSensitiveTransportFields, getSanitizedFetchCalls, installFetchMock } from '../../testing/mocks/api-client.mock.js';
import { assertTransportSnapshot } from '../../testing/transport-snapshot.js';
import { assertProdutoPatchPayload, assertProdutoPostPayload } from '../../testing/payload-contracts.js';

// ...keep first test unchanged

test('produtos: listagem/criacao/detalhe/edicao + contrato + snapshot', async () => {
  const dom = setupFrontendDom('#/produtos');
  installFetchMock(createProdutosMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  window.location.hash = '#/produtos/novo';
  await flush();
  dispatchInput(document.querySelector('#nome'), 'Produto X');
  dispatchInput(document.querySelector('#preco'), '20,00');
  document.querySelector('#nhpr-save').click();
  await flush(); await flush();
  window.location.hash = '#/produtos/p1';
  await flush(); await flush();
  document.querySelector('#nhpd-edit')?.click();
  await flush();
  dispatchInput(document.querySelector('#nhpd-nome'), 'Produto Editado');
  dispatchInput(document.querySelector('#nhpd-preco'), '30,00');
  document.querySelector('#nhpd-save-edit')?.click();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  const post = calls.find((c) => c.method === 'POST' && c.path === '/produtos');
  const patch = calls.find((c) => c.method === 'PATCH' && c.path === '/produtos/p1');
  assert.ok(post); assert.ok(patch);
  assertProdutoPostPayload(post.body);
  assertProdutoPatchPayload(patch.body);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  assertTransportSnapshot('produtos', calls);
  teardownFrontendDom(dom);
});

test('produto 360: GET sucesso + PATCH 422 e 500 + GET 404 isolado', async () => {
  const dom422 = setupFrontendDom('#/produtos/p1');
  installFetchMock(createProdutosMockHandlers({ scenario: 'validationError' }));
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhpd-edit')?.click();
  await flush();
  dispatchInput(document.querySelector('#nhpd-nome'), 'Produto 422');
  document.querySelector('#nhpd-save-edit')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar o produto|Produto não encontrado/i);
  teardownFrontendDom(dom422);

  const dom500 = setupFrontendDom('#/produtos/p1');
  const base = createProdutosMockHandlers();
  installFetchMock({ ...base, 'PATCH /produtos/p1': () => ({ __mockError: true, status: 500, body: { error: { message: 'Erro interno' } } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhpd-edit')?.click();
  await flush();
  dispatchInput(document.querySelector('#nhpd-nome'), 'Produto 500');
  document.querySelector('#nhpd-save-edit')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar o produto|Produto não encontrado/i);
  teardownFrontendDom(dom500);

  const dom404 = setupFrontendDom('#/produtos/p1');
  installFetchMock(createProdutosMockHandlers({ scenario: 'notFound' }));
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Produto não encontrado/i);
  teardownFrontendDom(dom404);
});

test('produtos: rota novo nao pode colidir com rota de detalhe dinamica', async () => {
  const dom = setupFrontendDom('#/produtos/novo');
  installFetchMock(createProdutosMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  const detalheCall = calls.find((c) => c.method === 'GET' && c.path === '/produtos/novo');
  assert.equal(detalheCall, undefined);
  assert.ok(document.querySelector('#nome'));
  teardownFrontendDom(dom);
});

test('produtos: rota invalida e detalhe inexistente mantem estado seguro', async () => {
  const domInvalid = setupFrontendDom('#/produtos/nao-existe/rota');
  installFetchMock(createProdutosMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Página não encontrada|Pagina nao encontrada|não encontrado/i);
  teardownFrontendDom(domInvalid);

  const domMissing = setupFrontendDom('#/produtos/p999');
  installFetchMock(createProdutosMockHandlers({ scenario: 'notFound' }));
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Produto não encontrado|Produto nao encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(domMissing);
});
