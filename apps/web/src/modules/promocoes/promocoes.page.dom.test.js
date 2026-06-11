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
  await new Promise((resolve) => setTimeout(resolve, 800));
  await flush();
}

test('promoções: adicionar item, limpar editor e salvar itens separados', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);

  document.querySelector('#nhp-nome').value = 'Promo multi';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_inicio').value = '2026-06-01';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-30';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-percentual_desconto').value = '10';
  document.querySelector('#nhp-percentual_desconto').dispatchEvent(new Event('input', { bubbles: true }));

  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  const checksA = document.querySelectorAll('.nhp-variacao-check');
  checksA[0].checked = true;
  checksA[0].dispatchEvent(new Event('change', { bubbles: true }));
  const pctA = document.querySelector('.nhp-variacao-percentual');
  pctA.value = '12';
  pctA.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.equal(document.querySelector('#nhp-produto_display').value, '');
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 1);
  assert.match(document.body.textContent, /Produto A/);

  await chooseProduct('Produto B');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  const checksB = document.querySelectorAll('.nhp-variacao-check');
  checksB[1].checked = true;
  checksB[1].dispatchEvent(new Event('change', { bubbles: true }));
  const pctB = document.querySelectorAll('.nhp-variacao-percentual')[1];
  pctB.value = '13';
  pctB.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 2);

  document.querySelector('#nhp-save').click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(spy.payloads[0].produtos.length, 2);
  assert.equal(spy.payloads[0].produtos[0].produto_id, 'prod-a');
  assert.equal(spy.payloads[0].produtos[0].variacoes[0].variacao_id, 'a1');
  assert.equal(spy.payloads[0].produtos[1].produto_id, 'prod-b');
  assert.equal(spy.payloads[0].produtos[1].variacoes[0].variacao_id, 'b1');
  teardownFrontendDom(dom);
});

test('promoções: editar e remover item já adicionado', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  document.querySelector('#nhp-nome').value = 'Promo';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_inicio').value = '2026-06-01';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-30';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-all').click();
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  document.querySelector('.nhp-edit-item').click();
  await flush();
  assert.equal(document.querySelector('#nhp-produto_display').value, 'Produto A');
  document.querySelector('.nhp-remove-item').click();
  await flush();
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 0);
  teardownFrontendDom(dom);
});

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
