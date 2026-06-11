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
        produto: { id: 'prod-1', nome: 'Camiseta Premium', descricao: 'Camiseta premium algodão' },
        percentual_desconto: 15,
        data_inicio: '2026-06-01',
        data_fim: '2026-06-30',
        status: 'ativa',
        aplicar_em_todas_variacoes: false,
        variacoesSelecionadas: [{ id: 'v1' }]
      }, {
        id: 'promo-2',
        nome: 'Liquidação',
        produto: { id: 'prod-2', nome: 'Calça Jeans', descricao: 'Calça jeans reta' },
        percentual_desconto: 10,
        data_inicio: '2026-06-01',
        data_fim: '2026-06-30',
        status: 'inativo',
        aplicar_em_todas_variacoes: true,
        variacoesSelecionadas: []
      }],
      total: 1
    }),
    delete: async () => ({ ok: true }),
    patch: async () => ({ ok: true })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Campanha Verão/);
  assert.match(document.body.textContent, /Ativa/);
  assert.match(document.body.textContent, /Variações específicas/);
  assert.match(document.body.textContent, /Camiseta Premium/);
  assert.doesNotMatch(document.body.textContent, /promo-1/);
  assert.match(document.body.textContent, /Editar/);
  assert.match(document.body.textContent, /Inativar/);
  assert.match(document.body.textContent, /Ativar/);
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

test('promoções: nome permanece ao alterar desconto individual', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-1', nome: 'Produto A', sku: 'SKU-A' }] };
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
  document.querySelector('#nhp-nome').value = 'Promo Nome';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  const discount = document.querySelector('.nhp-variacao-percentual');
  discount.value = '12';
  discount.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  assert.equal(document.querySelector('#nhp-nome')?.value, 'Promo Nome');
  teardownFrontendDom(dom);
});

test('promoções: botão salvar libera com variacao individual válida sem desconto global', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-1', nome: 'Produto A', sku: 'SKU-A' }] };
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
  let nome = document.querySelector('#nhp-nome');
  nome.value = 'Promo';
  nome.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  let dataInicio = document.querySelector('#nhp-data_inicio');
  dataInicio.value = '2026-06-01';
  dataInicio.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  let dataFim = document.querySelector('#nhp-data_fim');
  dataFim.value = '2026-06-30';
  dataFim.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  const checkbox = document.querySelector('.nhp-variacao-check');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  const discount = document.querySelector('.nhp-variacao-percentual');
  discount.value = '12';
  discount.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  await flush();
  assert.equal(document.querySelector('#nhp-save')?.disabled, false);
  teardownFrontendDom(dom);
});

test('promoções: botão salvar exige desconto global em todas as variações', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-1', nome: 'Produto A', sku: 'SKU-A' }] };
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
  document.querySelector('#nhp-nome').value = 'Promo';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_inicio').value = '2026-06-01';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-30';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-escopo-all')?.click();
  await flush();
  assert.equal(document.querySelector('#nhp-save')?.disabled, true);
  const percentual = document.querySelector('#nhp-percentual_desconto');
  percentual.value = '10';
  percentual.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.equal(document.querySelector('#nhp-save')?.disabled, false);
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
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.ok(document.querySelector('.nhp-product-row'));
  assert.match(document.body.textContent, /Produto A/);
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.equal(document.querySelector('#nhp-produto_display')?.value, 'Produto A');
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
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.ok(document.querySelector('.nhp-product-row'));
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  assert.match(document.body.textContent, /R\$\s*21,10/);
  const discount = document.querySelector('.nhp-variacao-percentual');
  discount.value = '10';
  discount.dispatchEvent(new Event('input', { bubbles: true }));
  discount.dispatchEvent(new Event('blur', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /R\$\s*18,99/);
  teardownFrontendDom(dom);
});

test('promoções: busca e desconto mantêm foco durante a digitação', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') {
        const q = params.q || params.search || '';
        return { items: q ? [{ id: 'prod-1', nome: 'Produto MASTER', sku: 'SKU-M' }] : [] };
      }
      if (path === '/produtos/prod-1') return { item: { id: 'prod-1', nome: 'Produto MASTER', sku: 'SKU-M', preco: 21.1 } };
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
  const search = document.querySelector('#nhp-product-search');
  search.focus();
  search.value = 'Produto';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(document.activeElement, search);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.ok(document.querySelector('.nhp-product-row'));
  assert.match(document.body.textContent, /Produto MASTER|Produto A/);
  await new Promise((resolve) => setTimeout(resolve, 200));
  await flush();
  teardownFrontendDom(dom);
});

test('promoções: payload envia produtos com variacoes por produto', async () => {
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
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.ok(document.querySelector('.nhp-product-row'));
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
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
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.ok(Array.isArray(lastPayload.produtos));
  assert.equal(lastPayload.produtos[0].produto_id, 'prod-1');
  assert.equal(lastPayload.produtos[0].variacoes[0].variacao_id, 'var-1');
  assert.equal(lastPayload.produtos[0].variacoes[0].percentual_desconto, 12);
  teardownFrontendDom(dom);
});

test('promoções: multi-produto envia variações separadas por produto e bloqueia produto sem seleção', async () => {
  const dom = setupFrontendDom('#/x');
  let lastPayload = null;
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') {
        const q = params.q || params.search || '';
        if (q.includes('A')) return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }] };
        if (q.includes('B')) return { items: [{ id: 'prod-b', nome: 'Produto B', sku: 'SKU-B' }] };
        return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }, { id: 'prod-b', nome: 'Produto B', sku: 'SKU-B' }] };
      }
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', sku: 'SKU-A', preco: 100 } };
      if (path === '/produtos/prod-b') return { item: { id: 'prod-b', nome: 'Produto B', sku: 'SKU-B', preco: 120 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100 }, { id: 'a2', sku: 'A2', cor: 'Azul', grade: 'GG', preco: 100 }] };
      if (path === '/produtos/prod-b/variacoes') return { items: [{ id: 'b1', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120 }, { id: 'b2', sku: 'B2', cor: 'Preto', grade: 'G', preco: 120 }] };
      return { items: [], total: 0 };
    },
    post: async (_path, payload) => { lastPayload = payload; return { ok: true, item: { id: 'promo-multi' } }; }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-nome').value = 'Promo multi';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_inicio').value = '2026-06-01';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-30';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto A';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  let checkbox = document.querySelector('.nhp-variacao-check');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  document.querySelector('.nhp-variacao-percentual').value = '11';
  document.querySelector('.nhp-variacao-percentual').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto B';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  checkbox = document.querySelector('.nhp-variacao-check');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  document.querySelector('.nhp-variacao-percentual').value = '13';
  document.querySelector('.nhp-variacao-percentual').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  document.querySelector('#nhp-save')?.dispatchEvent(new Event('click', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  assert.ok(lastPayload);
  assert.equal(lastPayload.produtos.length, 2);
  assert.equal(lastPayload.produtos[0].produto_id, 'prod-a');
  assert.equal(lastPayload.produtos[0].variacoes.length, 1);
  assert.equal(lastPayload.produtos[0].variacoes[0].variacao_id, 'a1');
  assert.equal(lastPayload.produtos[1].produto_id, 'prod-b');
  assert.equal(lastPayload.produtos[1].variacoes.length, 1);
  assert.equal(lastPayload.produtos[1].variacoes[0].variacao_id, 'b1');
  teardownFrontendDom(dom);
});

test('promoções: remover produto elimina suas variações do payload', async () => {
  const dom = setupFrontendDom('#/x');
  let lastPayload = null;
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }, { id: 'prod-b', nome: 'Produto B', sku: 'SKU-B' }] };
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', sku: 'SKU-A', preco: 100 } };
      if (path === '/produtos/prod-b') return { item: { id: 'prod-b', nome: 'Produto B', sku: 'SKU-B', preco: 120 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100 }] };
      if (path === '/produtos/prod-b/variacoes') return { items: [{ id: 'b1', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120 }] };
      return { items: [], total: 0 };
    },
    post: async (_path, payload) => { lastPayload = payload; return { ok: true, item: { id: 'promo-multi' } }; }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto A';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto B';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelectorAll('.nhp-product-row')[0]?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-remove-product[data-product-id="prod-a"]')?.click();
  await flush();
  document.querySelector('#nhp-save')?.dispatchEvent(new Event('click', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await flush();
  assert.equal(lastPayload.produtos.length, 1);
  assert.equal(lastPayload.produtos[0].produto_id, 'prod-b');
  teardownFrontendDom(dom);
});

test('promoções: bloqueia produto sem variação selecionada em escopo específico', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }] };
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', sku: 'SKU-A', preco: 100 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100 }] };
      return { items: [], total: 0 };
    },
    post: async () => ({ ok: true, item: { id: 'promo-multi' } })
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  document.querySelector('#nhp-product-search').value = 'Produto A';
  document.querySelector('#nhp-product-search').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('.nhp-product-row')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await flush();
  document.querySelector('#nhp-escopo-specific')?.click();
  await flush();
  document.querySelector('.nhp-variacao-check').checked = false;
  document.querySelector('.nhp-variacao-check').dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  const saveButton = document.querySelector('#nhp-save');
  saveButton.dispatchEvent(new Event('click', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /Selecione ao menos uma variação para o produto Produto A\./);
  teardownFrontendDom(dom);
});
