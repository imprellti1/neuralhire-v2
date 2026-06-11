import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPromocoesPage } from './promocoes.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

function createApiClient(spy) {
  return {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') {
        const q = String(params.q || params.search || '').toLowerCase();
        if (q.includes('a')) return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }] };
        if (q.includes('b')) return { items: [{ id: 'prod-b', nome: 'Produto B', sku: 'SKU-B' }] };
        return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }, { id: 'prod-b', nome: 'Produto B', sku: 'SKU-B' }] };
      }
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', descricao: 'Descricao A', preco: 100 } };
      if (path === '/produtos/prod-b') return { item: { id: 'prod-b', nome: 'Produto B', descricao: 'Descricao B', preco: 120 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100 }, { id: 'a2', sku: 'A2', cor: 'Azul', grade: 'GG', preco: 100 }] };
      if (path === '/produtos/prod-b/variacoes') return { items: [{ id: 'b1', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120 }, { id: 'b2', sku: 'B2', cor: 'Preto', grade: 'G', preco: 120 }] };
      return { items: [], total: 0 };
    },
    post: async (_path, payload) => {
      spy.payloads.push(payload);
      return { ok: true, item: { id: `promo-${spy.payloads.length}` } };
    }
  };
}

async function openForm(apiClient) {
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
}

async function chooseProduct(term) {
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  const search = document.querySelector('#nhp-product-search');
  search.value = term;
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await flush();
  document.querySelector('.nhp-product-search-item')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await flush();
}

function fillPromoBase() {
  document.querySelector('#nhp-nome').value = 'Promo multi';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_inicio').value = '2026-06-01';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-30';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
}

test('promoções: bloqueia adicionar item específico sem variação e salvar sem itens', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  document.querySelectorAll('.nhp-variacao-check').forEach((el) => {
    el.checked = false;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Selecione ao menos uma variação/);
  assert.equal(document.querySelector('#nhp-save').disabled, true);
  teardownFrontendDom(dom);
});

test('promoções: bloqueia adicionar item sem desconto geral', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  fillPromoBase();
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-all').click();
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Informe um desconto válido para o item da promoção/);
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 0);
  teardownFrontendDom(dom);
});

test('promoções: bloqueia adicionar item com variações específicas sem desconto', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  fillPromoBase();
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  const checks = document.querySelectorAll('.nhp-variacao-check');
  checks[0].checked = true;
  checks[0].dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Informe um desconto válido para todas as variações selecionadas/);
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 0);
  teardownFrontendDom(dom);
});

test('promoções: bloqueia salvar se algum item estiver sem desconto válido', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  fillPromoBase();
  document.querySelector('#nhp-percentual_desconto').value = '10';
  document.querySelector('#nhp-percentual_desconto').dispatchEvent(new Event('input', { bubbles: true }));
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  let checks = document.querySelectorAll('.nhp-variacao-check');
  checks[1].checked = false;
  checks[1].dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  let inputs = document.querySelectorAll('.nhp-variacao-percentual');
  inputs[0].value = '12';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Variações específicas • 1 variação\(ões\) • 12%/);
  document.querySelector('#nhp-save').click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(spy.payloads.length, 1);
  teardownFrontendDom(dom);
});

test('promoções: resumo e payload usam desconto válido', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  fillPromoBase();
  document.querySelector('#nhp-percentual_desconto').value = '10';
  document.querySelector('#nhp-percentual_desconto').dispatchEvent(new Event('input', { bubbles: true }));
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  let checks = document.querySelectorAll('.nhp-variacao-check');
  checks[1].checked = false;
  checks[1].dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  let inputs = document.querySelectorAll('.nhp-variacao-percentual');
  inputs[0].value = '12';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Variações específicas • 1 variação\(ões\) • 12%/);
  document.querySelector('#nhp-save').click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(spy.payloads[0].produtos[0].percentual_desconto, null);
  assert.equal(spy.payloads[0].produtos[0].variacoes[0].percentual_desconto, 12);
  teardownFrontendDom(dom);
});
