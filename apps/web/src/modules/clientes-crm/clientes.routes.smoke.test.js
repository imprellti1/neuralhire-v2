import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchChange, dispatchInput, flush, mockAuthenticatedSession, setHash, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { createClientesMockHandlers } from '../../testing/mocks/clientes.mock.js';
import { assertNoSensitiveTransportFields, getSanitizedFetchCalls, installFetchMock } from '../../testing/mocks/api-client.mock.js';
import { assertTransportSnapshot } from '../../testing/transport-snapshot.js';
import { assertClientePostPayload } from '../../testing/payload-contracts.js';

test('clientes: listagem/detalhe/criacao + contrato + snapshot', async () => {
  const dom = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock(createClientesMockHandlers());
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  const detailCalls = getSanitizedFetchCalls();
  assert.ok(detailCalls.some((c) => c.method === 'GET' && c.path === '/clientes/c1'));
  assert.ok(detailCalls.some((c) => c.method === 'GET' && c.path === '/pedidos' && String(c.query.cliente_id || '') === 'c1'));
  assert.ok(!detailCalls.some((c) => c.method === 'GET' && c.path === '/clientes' && String(c.query.page || '') === '1' && String(c.query.limit || '') === '200'));
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

test('clientes: busca remota com debounce, paginação e filtro de vendedor', async () => {
  const dom = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /clientes': ({ query }) => {
      const search = String(query.search || '');
      const vendedorId = String(query.vendedor_id || '');
      return {
        items: search.toLowerCase() === 'lc' ? [{ id: 'c-lc', empresa: 'LC & V COMERCIO DE CAMA, MESA E BANHO LTDA', razao_social: 'LC & V COMERCIO DE CAMA, MESA E BANHO LTDA', nome_contato: 'Contato LC', cidade: 'Curitiba', estado: 'PR', status: 'ativo', created_at: '2026-05-01T00:00:00.000Z' }] : [{ id: 'c1', empresa: 'Cliente A', razao_social: 'Cliente A LTDA', nome_contato: 'Ana', cidade: 'Sao Paulo', estado: 'SP', status: 'ativo', created_at: '2026-05-01T00:00:00.000Z' }],
        pagination: { page: Number(query.page || 1), totalPages: 2, total: 2, limit: Number(query.limit || 10) },
        meta: { vendedorId }
      };
    },
    'GET /vendedores': () => ({ items: [{ id: 'vend-1', nome: 'Vendedor 1' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } })
  });
  bootstrapWebApp();
  await flush(); await flush();

  const search = document.querySelector('#nhc-search');
  dispatchInput(search, 'l');
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  let calls = getSanitizedFetchCalls().filter((call) => call.path === '/clientes');
  assert.equal(calls.at(-1)?.query?.search || '', '');

  dispatchInput(search, 'lc');
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  calls = getSanitizedFetchCalls().filter((call) => call.path === '/clientes');
  assert.equal(calls.at(-1)?.query?.search || '', 'lc');
  assert.match(document.body.textContent, /LC & V COMERCIO DE CAMA, MESA E BANHO LTDA/i);

  const vendedor = document.querySelector('#nhc-vendedor');
  dispatchChange(vendedor, 'vend-1');
  await flush(); await flush();
  calls = getSanitizedFetchCalls().filter((call) => call.path === '/clientes');
  assert.equal(calls.at(-1)?.query?.vendedor_id || '', 'vend-1');

  document.querySelector('#nhc-refresh')?.click();
  await flush(); await flush();
  calls = getSanitizedFetchCalls().filter((call) => call.path === '/clientes');
  assert.equal(calls.at(-1)?.query?.search || '', 'lc');
  assert.equal(calls.at(-1)?.query?.vendedor_id || '', 'vend-1');

  teardownFrontendDom(dom);
});

test('clientes: GET sucesso + detalhe 404 e GET sucesso + detalhe 500', async () => {
  const dom404 = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock(createClientesMockHandlers({ scenario: 'notFound' }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  const calls404 = getSanitizedFetchCalls();
  assert.ok(calls404.some((c) => c.method === 'GET' && c.path === '/clientes/c1'));
  assert.match(document.body.textContent, /Cliente não encontrado|Cliente nao encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom404);

  const dom500 = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock(createClientesMockHandlers({ scenario: 'serverError' }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  const calls500 = getSanitizedFetchCalls();
  assert.ok(calls500.some((c) => c.method === 'GET' && c.path === '/clientes/c1'));
  assert.match(document.body.textContent, /Não foi possível carregar o cliente|Cliente não encontrado/i);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom500);
});

test('clientes: POST 422 e POST 500 em criação com erro seguro', async () => {
  const dom422 = setupFrontendDom('#/clientes/novo');
  mockAuthenticatedSession();
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
  mockAuthenticatedSession();
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
  mockAuthenticatedSession();
  installFetchMock(createClientesMockHandlers({
    overrides: {
      'GET /clientes/c1': () => ({ __mockError: true, status: 404, body: { error: { message: 'Cliente nao encontrado' } } })
    }
  }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.ok(getSanitizedFetchCalls().some((c) => c.method === 'GET' && c.path === '/clientes/c1'));
  assert.match(document.body.textContent, /Cliente não encontrado|Cliente nao encontrado/i);
  teardownFrontendDom(dom404);

  const dom500 = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock(createClientesMockHandlers({
    overrides: {
      'GET /clientes/c1': () => ({ __mockError: true, status: 500, body: { error: { message: 'Erro interno' } } })
    }
  }));
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.ok(getSanitizedFetchCalls().some((c) => c.method === 'GET' && c.path === '/clientes/c1'));
  assert.match(document.body.textContent, /Não foi possível carregar o cliente|Cliente não encontrado/i);
  teardownFrontendDom(dom500);

  const dom422 = setupFrontendDom('#/clientes/novo');
  mockAuthenticatedSession();
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
  mockAuthenticatedSession();
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

test('clientes: detalhe 360 abre com abas e accordion de pedidos', async () => {
  const dom = setupFrontendDom('#/clientes');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /clientes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 10 } }),
    'GET /clientes/c1': () => ({ item: { id: 'c1', empresa: 'Cliente A', cidade: 'São Paulo', estado: 'SP', created_at: '2026-05-01T00:00:00.000Z', status: 'ativo', vendedor_nome: 'Vendedor 1', documento: '00.000.000/0001-00', telefone: '(11) 99999-9999', email: 'a@a.com' } }),
    'GET /clientes/c1/timeline': () => ({ items: [{ id: 't1', categoria: 'cadastro', titulo: 'Cliente cadastrado', descricao: 'Cadastro concluído', created_at: '2026-06-10T10:00:00.000Z' }] }),
    'GET /pedidos': ({ query }) => String(query.cliente_id || '') === 'c1'
      ? { items: [{ id: 'p1', cliente_id: 'c1', numero: '1001', status: 'faturado', created_at: '2026-05-28T00:00:00.000Z', data_faturamento: '2026-06-01T00:00:00.000Z', total: 123.45, itens: [{ produto: 'Produto X', quantidade: 2, preco_unitario: 10, total: 20, status_vinculo: 'vinculado' }] }], pagination: { page: 1, totalPages: 1, total: 1, limit: 100 } }
      : { items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } },
    'GET /pedidos/p1': () => ({ item: { id: 'p1', itens: [{ produto: 'Produto X', quantidade: 2, preco_unitario: 10, total: 20, status_vinculo: 'vinculado' }] } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  setHash('#/clientes/c1');
  await flush(); await flush();
  assert.ok(document.querySelector('[data-tab="geral"]'));
  assert.ok(document.querySelector('[data-tab="dados-relevantes"]'));
  assert.ok(document.querySelector('[data-tab="comercial"]'));
  assert.ok(document.querySelector('[data-tab="alertas"]'));
  document.querySelector('[data-tab="comercial"]')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Últimos Pedidos/i);
  assert.match(document.body.textContent, /01\/06\/2026/);
  document.querySelector('[data-toggle-group="faturados"]')?.click();
  await flush(); await flush();
  document.querySelector('[data-toggle-pedido="p1"]')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Produto X/);
  document.querySelector('[data-tab="dados-relevantes"]')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Dados principais/i);
  document.querySelector('[data-tab="timeline"]')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Cliente cadastrado/i);
  teardownFrontendDom(dom);
});
