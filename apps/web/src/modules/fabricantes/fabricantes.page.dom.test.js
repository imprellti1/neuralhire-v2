import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush, dispatchInput } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, getSanitizedFetchCalls, assertNoSensitiveTransportFields } from '../../testing/mocks/api-client.mock.js';

test('fabricantes: modal novo abre com title e bloqueio por CNPJ', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({ 'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  assert.match(document.body.textContent, /Nova fábrica/);
  assert.match(document.querySelector('#nhf-cnpj').closest('label').textContent, /CNPJ/);
  assert.equal(document.querySelector('[data-form-field="nome_fantasia"]').disabled, true);
  teardownFrontendDom(dom);
});

test('fabricantes: buscar CNPJ habilita com 14 digitos e preenche campos', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190', razao_social: 'Empresa Teste LTDA', nome_fantasia: 'Teste', email: 'contato@teste.com', telefone: '11999990000', site: 'https://teste.com', endereco: { logradouro: 'Rua X', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP', cep: '01000000' }, atividade_principal: 'Comercio' } }),
    'POST /fabricantes': ({ body }) => ({ id: 'f2', ...body })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  assert.equal(document.querySelector('#nhf-buscar-cnpj').disabled, false);
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  assert.equal(document.querySelector('[data-form-field="razao_social"]').value, 'Empresa Teste LTDA');
  assert.equal(document.querySelector('[data-form-field="nome_fantasia"]').value, 'Teste');
  assert.equal(document.querySelector('[data-form-field="email_comercial"]').value, 'contato@teste.com');
  teardownFrontendDom(dom);
});

test('fabricantes: falha de consulta libera preenchimento manual', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => { throw new Error('fail'); }
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  assert.match(document.body.textContent, /preenchimento manual/i);
  assert.equal(document.querySelector('[data-form-field="nome_fantasia"]').disabled, false);
  teardownFrontendDom(dom);
});

test('fabricantes: regras comerciais em aba separada e lista sem prazo maximo', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'f1', nome: 'Fábrica 1', cnpj: '123', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5 }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.doesNotMatch(document.body.textContent, /Prazo máximo/);
  document.querySelector('#nhf-new').click();
  await flush();
  document.querySelector('[data-tab="regras"]').click();
  await flush();
  assert.match(document.body.textContent, /Regras comerciais/);
  teardownFrontendDom(dom);
});

test('fabricantes: salva sem campos sensiveis', async () => {
  const dom = setupFrontendDom('#/fabricantes');
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190' } }),
    'POST /fabricantes': ({ body }) => ({ id: 'f2', ...body })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  document.querySelector('[data-form-field="nome_fantasia"]').value = 'Nova';
  document.querySelector('[data-form-field="nome_fantasia"]').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  assert.ok(calls.some((c) => c.method === 'POST' && c.path === '/fabricantes'));
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom);
});
