import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, getSanitizedFetchCalls, assertNoSensitiveTransportFields } from '../../testing/mocks/api-client.mock.js';

test('fabricantes: render lista e rota', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'f1', nome: 'Fábrica 1', cnpj: '123', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, prazo_maximo_dias: 30 }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /fabricantes/f1': () => ({ id: 'f1', nome: 'Fábrica 1' }),
    'GET /fabricantes/f1/condicoes-pagamento': () => ({ items: [] })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Fábricas/);
  assert.match(document.body.textContent, /Fábrica 1/);
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom);
});

test('fabricantes: salva fabricante e condição sem campos sensíveis', async () => {
  const dom = setupFrontendDom('#/fabricantes/novo');
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'POST /fabricantes': ({ body }) => ({ id: 'f2', ...body }),
    'GET /fabricantes/f2': () => ({ id: 'f2', nome: 'Nova' }),
    'GET /fabricantes/f2/condicoes-pagamento': () => ({ items: [] }),
    'POST /fabricantes/f2/condicoes-pagamento': ({ body }) => ({ id: 'c1', ...body })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-nome').value = 'Nova';
  document.querySelector('#nhf-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  assert.ok(calls.some((c) => c.method === 'POST' && c.path === '/fabricantes'));
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom);
});
