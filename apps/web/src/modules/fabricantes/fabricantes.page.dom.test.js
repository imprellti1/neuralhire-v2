import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { dispatchInput, flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, getSanitizedFetchCalls, assertNoSensitiveTransportFields } from '../../testing/mocks/api-client.mock.js';

test('fabricantes: modal novo abre com title e bloqueio por CNPJ', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
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
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190', razao_social: 'Empresa Teste LTDA', nome_fantasia: 'Teste', email: 'contato@teste.com', telefone: '11999990000', site: 'https://teste.com', endereco: { logradouro: 'Rua X', numero: '10', complemento: '', bairro: 'Centro', cidade: 'Sao Paulo', uf: 'SP', cep: '01000000' }, atividade_principal: 'Comercio' } }),
    'POST /fabricantes': ({ body }) => ({ id: 'f2', ...body })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  const cnpjInput = document.querySelector('#nhf-cnpj');
  cnpjInput.focus();
  dispatchInput(cnpjInput, '12345678000190');
  await flush();
  assert.equal(document.activeElement, cnpjInput);
  assert.equal(cnpjInput.value, '12.345.678/0001-90');
  assert.equal(document.querySelector('#nhf-buscar-cnpj').disabled, false);
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  assert.equal(document.querySelector('[data-form-field="razao_social"]').value, 'Empresa Teste LTDA');
  assert.equal(document.querySelector('[data-form-field="nome_fantasia"]').value, 'Teste');
  assert.equal(document.querySelector('[data-form-field="email_comercial"]').value, 'contato@teste.com');
  teardownFrontendDom(dom);
});

test('fabricantes: retorno parcial de CNPJ mostra mensagem honesta', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190', razao_social: 'Empresa Parcial LTDA' } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  document.querySelector('#nhf-unlock-manual').click();
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Alguns campos foram preenchidos automaticamente/);
  assert.equal(document.querySelector('[data-form-field="razao_social"]').value, 'Empresa Parcial LTDA');
  assert.match(document.querySelector('.nhf-lookup-partial').textContent, /Alguns campos/);
  teardownFrontendDom(dom);
});

test('fabricantes: logo aceita upload local e mostra preview', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  const fileInput = document.querySelector('[data-form-field="logo_upload"]');
  const file = new File(['fake-image'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush(); await flush();
  assert.match(document.body.textContent, /logo.png/);
  assert.ok(document.querySelector('.nhf-logo-box'));
  teardownFrontendDom(dom);
});

test('fabricantes: upload real envia logo depois de salvar e recarrega url persistida', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  let uploadCalled = false;
  const items = [];
  installFetchMock({
    'GET /fabricantes': () => ({ items, pagination: { page: 1, totalPages: 1, total: items.length, limit: 20 } }),
    'GET /vendedores': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190', razao_social: 'Fab Nova LTDA' } }),
    'POST /fabricantes': ({ body }) => { const row = { id: 'fab-upload', ...body }; items.splice(0, items.length, row); return row; },
    'POST /fabricantes/fab-upload/logo': () => { uploadCalled = true; return { logo_url: 'https://cdn.local/fab-upload/logo.png' }; },
    'GET /fabricantes/fab-upload': () => ({ id: 'fab-upload', nome: 'Fab Nova LTDA', cnpj: '12345678000190', logo_url: 'https://cdn.local/fab-upload/logo.png' }),
    'GET /fabricantes/fab-upload/condicoes-pagamento': () => ({ items: [], total: 0 })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  const fileInput = document.querySelector('[data-form-field="logo_upload"]');
  const file = new File(['fake-image'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush(); await flush();
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  assert.equal(uploadCalled, true);
  document.querySelector('[data-edit-id="fab-upload"]').click();
  await flush(); await flush();
  assert.equal(document.querySelector('.nhf-logo-preview').src, 'https://cdn.local/fab-upload/logo.png');
  teardownFrontendDom(dom);
});

test('fabricantes: upload falho mostra erro inline e nao simula sucesso', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /vendedores': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190', razao_social: 'Fab Nova LTDA' } }),
    'POST /fabricantes': ({ body }) => ({ id: 'fab-upload-err', ...body }),
    'POST /fabricantes/fab-upload-err/logo': () => { throw new Error('upload failed'); }
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  const fileInput = document.querySelector('[data-form-field="logo_upload"]');
  const file = new File(['fake-image'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush(); await flush();
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  assert.match(document.body.textContent, /upload failed|Falha ao enviar a logo|Falha ao enviar logo/i);
  assert.ok(document.querySelector('#nhf-modal-backdrop'));
  teardownFrontendDom(dom);
});

test('fabricantes: falha de consulta libera preenchimento manual', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
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

test('fabricantes: modal carrega vendedores reais e exibe loading', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /vendedores': () => ({ items: [{ id: 'vend-1', nome: 'Ana Vendas', email: 'ana@empresa.com.br', status: 'ativo' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  assert.match(document.body.textContent, /Carregando vendedores/);
  await flush(); await flush();
  const select = document.querySelector('[data-form-field="responsavel_vendedor_id"]');
  assert.ok(select);
  assert.match(select.innerHTML, /Sem responsável definido/);
  assert.match(select.innerHTML, /Ana Vendas/);
  teardownFrontendDom(dom);
});

test('fabricantes: edição preserva responsavel comercial vinculado', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'f-resp', nome: 'Fab Responsável', cnpj: '12345678000190', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, responsavel_vendedor_id: 'vend-2', responsavel_comercial_nome: 'Bruno Vendas', responsavel_comercial_email: 'bruno@empresa.com.br' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /fabricantes/f-resp': () => ({ id: 'f-resp', nome: 'Fab Responsável', cnpj: '12345678000190', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, responsavel_vendedor_id: 'vend-2', responsavel_comercial_nome: 'Bruno Vendas', responsavel_comercial_email: 'bruno@empresa.com.br' }),
    'GET /fabricantes/f-resp/condicoes-pagamento': () => ({ items: [], total: 0 }),
    'GET /vendedores': () => ({ items: [{ id: 'vend-2', nome: 'Bruno Vendas', email: 'bruno@empresa.com.br', status: 'ativo' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('[data-edit-id="f-resp"]').click();
  await flush(); await flush();
  const select = document.querySelector('[data-form-field="responsavel_vendedor_id"]');
  assert.equal(select.value, 'vend-2');
  teardownFrontendDom(dom);
});

test('fabricantes: salva responsavel_vendedor_id sem campos sensiveis', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /vendedores': () => ({ items: [{ id: 'vend-3', nome: 'Carla Vendas', email: 'carla@empresa.com.br', status: 'ativo' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190', razao_social: 'Fab Nova LTDA' } }),
    'POST /fabricantes': ({ body }) => ({ id: 'fab-new', ...body })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush(); await flush();
  const cnpjInput = document.querySelector('#nhf-cnpj');
  dispatchInput(cnpjInput, '12345678000190');
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  document.querySelector('[data-form-field="responsavel_vendedor_id"]').value = 'vend-3';
  document.querySelector('[data-form-field="responsavel_vendedor_id"]').dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('[data-form-field="nome_fantasia"]').value = 'Nova';
  document.querySelector('[data-form-field="nome_fantasia"]').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  const calls = getSanitizedFetchCalls();
  const post = calls.find((c) => c.method === 'POST' && c.path === '/fabricantes');
  assert.ok(post);
  assert.equal(post.body.responsavel_vendedor_id, 'vend-3');
  assert.doesNotThrow(() => assertNoSensitiveTransportFields());
  teardownFrontendDom(dom);
});

test('fabricantes: envia e recarrega regras comerciais', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  let savedBody = null;
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'fab-rr', nome: 'Regra Teste', cnpj: '12345678000190', status: 'ativo', valor_minimo_duplicata: 0, aceita_bonificacao: false, aceita_consignacao: false }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /fabricantes/fab-rr': () => ({ id: 'fab-rr', nome: 'Regra Teste', cnpj: '12345678000190', valor_minimo_duplicata: 1000, aceita_bonificacao: true, aceita_consignacao: true }),
    'GET /fabricantes/fab-rr/condicoes-pagamento': () => ({ items: [], total: 0 }),
    'PATCH /fabricantes/fab-rr': ({ body }) => { savedBody = body; return { id: 'fab-rr', ...body }; }
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('[data-edit-id="fab-rr"]').click();
  await flush(); await flush();
  document.querySelector('[data-tab="regras"]').click();
  await flush();
  assert.equal(document.querySelector('[data-form-field="pedido_minimo_valor"]').value.includes('R$'), true);
  assert.equal(document.querySelector('[data-form-field="pedido_minimo"]').value.includes('R$'), true);
  assert.equal(document.querySelector('[data-form-field="aceita_bonificacao"]').value, 'true');
  assert.equal(document.querySelector('[data-form-field="aceita_consignacao"]').value, 'true');
  document.querySelector('[data-form-field="pedido_minimo_valor"]').value = 'R$ 750,00';
  document.querySelector('[data-form-field="pedido_minimo_valor"]').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-form-field="pedido_minimo"]').value = 'R$ 125,00';
  document.querySelector('[data-form-field="pedido_minimo"]').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  assert.equal(savedBody.pedido_minimo_valor, 750);
  assert.equal(savedBody.valor_minimo_duplicata, 125);
  assert.equal(savedBody.aceita_bonificacao, true);
  assert.equal(savedBody.aceita_consignacao, true);
  teardownFrontendDom(dom);
});

test('fabricantes: regras comerciais em aba separada e lista sem prazo maximo', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'f1', nome: 'Fábrica 1', cnpj: '123', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5 }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.doesNotMatch(document.body.textContent, /Prazo máximo/);
  document.querySelector('#nhf-new').click();
  await flush();
  const regraTab = document.querySelector('[data-tab="regras"]');
  regraTab.click();
  await flush();
  assert.match(document.body.textContent, /Regras comerciais/);
  teardownFrontendDom(dom);
});

test('fabricantes: regras comerciais validam campos basicos', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  document.querySelector('#nhf-unlock-manual').click();
  await flush();
  document.querySelector('[data-tab="regras"]').click();
  await flush();
  document.querySelector('[data-payment-add]').click();
  await flush();
  const prazoInput = document.querySelector('[data-payment-prazo]');
  assert.equal(prazoInput.type, 'text');
  dispatchInput(prazoInput, '30/60/90');
  await flush();
  assert.match(document.body.textContent, /3 parcelas · prazo médio 60 dias/);
  document.querySelector('[data-payment-add]').click();
  await flush();
  const pagamentos = document.querySelectorAll('[data-payment-prazo]');
  dispatchInput(pagamentos[1], '28/35/42/49');
  await flush();
  assert.match(document.body.textContent, /4 parcelas · prazo médio 39 dias/);
  document.querySelector('[data-payment-remove]').click();
  await flush();
  assert.equal(document.querySelectorAll('[data-payment-prazo]').length, 1);
  const pedido = document.querySelector('[data-form-field="pedido_minimo"]');
  const itens = document.querySelector('[data-form-field="pedido_minimo_itens"]');
  const prazo = document.querySelector('[data-form-field="prazo_entrega_dias"]');
  const comissao = document.querySelector('[data-form-field="comissao_padrao_percentual"]');
  dispatchInput(pedido, 'R$ 150,00');
  dispatchInput(itens, '4');
  dispatchInput(prazo, '7');
  dispatchInput(comissao, '12');
  await flush();
  assert.match(pedido.value, /^R\$/);
  assert.equal(itens.value, '4');
  assert.equal(prazo.value, '7');
  assert.equal(comissao.value, '12');
  teardownFrontendDom(dom);
});

test('fabricantes: salva e reabre condicoes estruturadas', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  let savedBody = null;
  const items = [];
  installFetchMock({
    'GET /fabricantes': () => ({ items, pagination: { page: 1, totalPages: 1, total: items.length, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190' } }),
    'POST /fabricantes': ({ body }) => { savedBody = body; items.splice(0, items.length, { id: 'fab-1', nome: body.nome, cnpj: body.cnpj, condicoes_pagamento: body.condicoes_pagamento }); return { id: 'fab-1', ...body }; },
    'GET /fabricantes/fab-1': () => ({ id: 'fab-1', nome: 'Fab Nova', cnpj: '12345678000190', condicoes_pagamento: savedBody?.condicoes_pagamento || [] })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  dispatchInput(document.querySelector('#nhf-cnpj'), '12345678000190');
  await flush();
  document.querySelector('#nhf-buscar-cnpj').click();
  await flush(); await flush();
  document.querySelector('[data-tab="regras"]').click();
  await flush();
  document.querySelector('[data-payment-add]').click();
  await flush();
  dispatchInput(document.querySelector('[data-payment-prazo]'), '30/60/90');
  document.querySelector('[data-payment-prazo]').dispatchEvent(new Event('blur', { bubbles: true }));
  await flush();
  document.querySelector('#nhf-save').click();
  await flush(); await flush();
  assert.deepEqual(savedBody.condicoes_pagamento, [{ prazo: '30/60/90', parcelas: 3, prazo_medio_dias: 60 }]);
  document.querySelector('[data-edit-id="fab-1"]').click();
  await flush(); await flush();
  document.querySelector('[data-tab="regras"]').click();
  await flush();
  assert.equal(document.querySelector('[data-payment-prazo]').value, '30/60/90');
  teardownFrontendDom(dom);
});

test('fabricantes: condicao calcula parcelas e prazo medio ao digitar prazo livre', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  document.querySelector('#nhf-unlock-manual').click();
  await flush();
  document.querySelector('[data-tab="regras"]').click();
  await flush();
  document.querySelector('[data-payment-add]').click();
  await flush();
  const prazo = document.querySelector('[data-payment-prazo]');
  dispatchInput(prazo, '30 / 60 / 90');
  await flush();
  assert.equal(prazo.value, '30 / 60 / 90');
  prazo.dispatchEvent(new Event('blur', { bubbles: true }));
  await flush();
  assert.equal(document.querySelector('[data-payment-prazo]').value, '30/60/90');
  assert.match(document.body.textContent, /3 parcelas · prazo médio 60 dias/);
  teardownFrontendDom(dom);
});

test('fabricantes: salva sem campos sensiveis', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }),
    'GET /cnpj/12345678000190': () => ({ ok: true, data: { cnpj: '12345678000190' } }),
    'POST /fabricantes': ({ body }) => ({ id: 'f2', ...body })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  const cnpjInput = document.querySelector('#nhf-cnpj');
  cnpjInput.focus();
  dispatchInput(cnpjInput, '12345678000190');
  await flush();
  assert.equal(cnpjInput.value, '12.345.678/0001-90');
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

test('fabricantes: site e contato voltam ao editar', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'f-site', nome: 'APPEL HOME', cnpj: '12345678000190', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, site: 'https://appelhome.com', email_comercial: 'contato@appelhome.com', telefone: '11999990000', regiao_atendida: 'SP' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /fabricantes/f-site': () => ({ id: 'f-site', nome: 'APPEL HOME', cnpj: '12345678000190', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, site: 'https://appelhome.com', email_comercial: 'contato@appelhome.com', telefone: '11999990000', regiao_atendida: 'SP' }),
    'GET /fabricantes/f-site/condicoes-pagamento': () => ({ items: [], total: 0 })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('[data-edit-id="f-site"]').click();
  await flush(); await flush();
  assert.equal(document.querySelector('[data-form-field="site"]').value, 'https://appelhome.com');
  assert.equal(document.querySelector('[data-form-field="email_comercial"]').value, 'contato@appelhome.com');
  assert.equal(document.querySelector('[data-form-field="telefone"]').value, '11999990000');
  assert.equal(document.querySelector('[data-form-field="regiao_atendida"]').value, 'SP');
  teardownFrontendDom(dom);
});

test('fabricantes: endereco volta ao editar', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /fabricantes': () => ({ items: [{ id: 'f-end', nome: 'APPEL HOME', cnpj: '12345678000190', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, logradouro: 'Rua A', numero: '10', complemento: 'Sala 1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01000-000', endereco_completo: 'Rua A, 10 | Sala 1 | Centro - São Paulo - SP | 01000-000' }], pagination: { page: 1, totalPages: 1, total: 1, limit: 20 } }),
    'GET /fabricantes/f-end': () => ({ id: 'f-end', nome: 'APPEL HOME', cnpj: '12345678000190', status: 'ativo', pedido_minimo: 10, boleto_minimo: 20, comissao_padrao_percentual: 5, logradouro: 'Rua A', numero: '10', complemento: 'Sala 1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01000-000', endereco_completo: 'Rua A, 10 | Sala 1 | Centro - São Paulo - SP | 01000-000' }),
    'GET /fabricantes/f-end/condicoes-pagamento': () => ({ items: [], total: 0 })
  });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('[data-edit-id="f-end"]').click();
  await flush(); await flush();
  assert.equal(document.querySelector('[data-form-field="logradouro"]').value, 'Rua A');
  assert.equal(document.querySelector('[data-form-field="numero"]').value, '10');
  assert.equal(document.querySelector('[data-form-field="bairro"]').value, 'Centro');
  assert.equal(document.querySelector('[data-form-field="cidade"]').value, 'São Paulo');
  assert.match(document.querySelector('[data-form-field="endereco_completo"]').value, /Rua A/);
  teardownFrontendDom(dom);
});

test('fabricantes: formatCnpj mascara enquanto digita sem perder foco', async () => {
  const dom = setupFrontendDom('#/fabricantes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /fabricantes': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 20 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('#nhf-new').click();
  await flush();
  const cnpjInput = document.querySelector('#nhf-cnpj');
  cnpjInput.focus();
  dispatchInput(cnpjInput, '1');
  await flush();
  dispatchInput(cnpjInput, '12');
  await flush();
  dispatchInput(cnpjInput, '12345678000190');
  await flush();
  assert.equal(document.activeElement, cnpjInput);
  assert.equal(cnpjInput.value, '12.345.678/0001-90');
  teardownFrontendDom(dom);
});
