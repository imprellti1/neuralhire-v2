import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';
import { renderPromocoesPage } from './promocoes.page.js';

test('promoções: rota renderiza header, cards e empty state', async () => {
  const dom = setupFrontendDom('#/promocoes');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /promocoes': () => ({ items: [], total: 0 }) });
  bootstrapWebApp();
  await flush();
  assert.match(document.body.textContent, /Promoções/);
  assert.match(document.body.textContent, /Promoções ativas/);
  assert.match(document.body.textContent, /Nenhuma promoção cadastrada\./);
  assert.match(document.body.textContent, /Criar primeira promoção/);
  teardownFrontendDom(dom);
});

test('promoções: lista mostra badges e ações', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async () => ({
      items: [{
        id: 'promo-1',
        nome: 'Campanha Verão',
        produto_nome: 'Camiseta Premium',
        percentual_desconto: 15,
        data_inicio: '2026-06-01',
        data_fim: '2026-06-30',
        status: 'ativa',
        aplicar_em_todas_variacoes: false,
        variacoesSelecionadas: [{ id: 'v1' }]
      }],
      total: 1
    }),
    delete: async () => ({ ok: true })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Campanha Verão/);
  assert.match(document.body.textContent, /Ativa/);
  assert.match(document.body.textContent, /Variações específicas/);
  assert.match(document.body.textContent, /Editar/);
  assert.match(document.body.textContent, /Inativar/);
  teardownFrontendDom(dom);
});

test('promoções: formulário alterna entre todas variações e específicas', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async () => ({ items: [], total: 0 }),
    post: async () => ({ ok: true, item: { id: 'promo-2' } })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  assert.match(document.body.textContent, /Dados da promoção/);
  assert.match(document.body.textContent, /Todas as variações/);
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  assert.match(document.body.textContent, /Variações específicas/);
  teardownFrontendDom(dom);
});

test('promoções: modal de produtos abre, busca e seleciona produto', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') {
        const q = params.q || params.search || '';
        return { items: q ? [{ id: 'prod-1', nome: 'Produto A', sku: 'SKU-A', categoria_nome: 'Categoria', fabricante_nome: 'Fábrica' }] : [] };
      }
      if (path === '/produtos/prod-1') return { item: { id: 'prod-1', nome: 'Produto A', sku: 'SKU-A', preco: 21.1 } };
      if (path === '/produtos/prod-1/variacoes') return { items: [{ id: 'var-1', sku: 'VAR1', cor: 'Azul', grade: 'G', preco: 100 }] };
      return { items: [], total: 0 };
    },
    post: async () => ({ ok: true, item: { id: 'promo-2' } })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  const search = document.querySelector('#nhp-product-search');
  search.value = 'Produto';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /Produto A/);
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  assert.equal(document.querySelector('#nhp-produto_display')?.value, 'Produto A • SKU-A');
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  assert.match(document.body.textContent, /VAR1/);
  teardownFrontendDom(dom);
});

test('promoções: variação específica herda preço do produto pai para exibição e cálculo', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') {
        const q = params.q || params.search || '';
        return { items: q ? [{ id: 'prod-1', nome: 'Produto A', sku: 'SKU-A' }] : [] };
      }
      if (path === '/produtos/prod-1') return { item: { id: 'prod-1', nome: 'Produto A', sku: 'SKU-A', preco: 21.1 } };
      if (path === '/produtos/prod-1/variacoes') return { items: [{ id: 'var-1', sku: 'VAR1', cor: 'Azul', grade: 'G', preco: 0 }] };
      return { items: [], total: 0 };
    },
    post: async () => ({ ok: true, item: { id: 'promo-2' } })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await flush();
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  assert.match(document.body.textContent, /R\$\s*21,10/);
  const discount = document.querySelector('.nhp-variacao-percentual');
  discount.value = '10';
  discount.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /R\$\s*18,99/);
  teardownFrontendDom(dom);
});

test('promoções: payload envia variacoesSelecionadas como objetos', async () => {
  const dom = setupFrontendDom('#/x');
  let lastPayload = null;
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-1', nome: 'Produto A', sku: 'SKU-A' }] };
      if (path === '/produtos/prod-1/variacoes') return { items: [{ id: 'var-1', sku: 'VAR1', cor: 'Azul', grade: 'G', preco: 100 }] };
      return { items: [], total: 0 };
    },
    post: async (_path, payload) => { lastPayload = payload; return { ok: true, item: { id: 'promo-3' } }; }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await flush();
  document.querySelector('#nhp-nome').value = 'Promo';
  document.querySelector('#nhp-data_inicio').value = '2026-06-01';
  document.querySelector('#nhp-data_fim').value = '2026-06-30';
  document.querySelector('#nhp-percentual_desconto').value = '10';
  const specificRadio = document.querySelector('#nhp-escopo-specific');
  specificRadio.checked = true;
  specificRadio.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  await flush();
  const checkbox = document.querySelector('.nhp-variacao-check');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  const discount = document.querySelector('.nhp-variacao-percentual');
  discount.value = '12';
  discount.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  const saveButton = document.querySelector('#nhp-save');
  saveButton.dispatchEvent(new Event('click', { bubbles: true }));
  await flush();
  await flush();
  assert.ok(Array.isArray(lastPayload.variacoesSelecionadas));
  assert.equal(lastPayload.variacoesSelecionadas[0].variacaoId, 'var-1');
  assert.equal(lastPayload.variacoesSelecionadas[0].percentualDesconto, 12);
  teardownFrontendDom(dom);
});
