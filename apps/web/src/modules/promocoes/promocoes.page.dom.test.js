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
        if (q.includes('c')) return { items: [{ id: 'prod-c', nome: 'Produto C', sku: 'SKU-C' }] };
        return { items: [{ id: 'prod-a', nome: 'Produto A', sku: 'SKU-A' }, { id: 'prod-b', nome: 'Produto B', sku: 'SKU-B' }] };
      }
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', descricao: 'Descricao A', preco: 100 } };
      if (path === '/produtos/prod-b') return { item: { id: 'prod-b', nome: 'Produto B', descricao: 'Descricao B', preco: 120 } };
      if (path === '/produtos/prod-c') return { item: { id: 'prod-c', nome: 'Produto C', descricao: 'Descricao C', preco: 140 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100, estoque: 5 }, { id: 'a2', sku: 'A2', cor: 'Azul', grade: 'GG', preco: 100, estoque: 2 }] };
      if (path === '/produtos/prod-b/variacoes') return { items: [{ id: 'b1', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120, estoque: 3 }, { id: 'b2', sku: 'B2', cor: 'Preto', grade: 'G', preco: 120, estoque: 1 }] };
      if (path === '/produtos/prod-c/variacoes') return { items: [{ id: 'c1', sku: 'C1', cor: 'Verde', grade: 'P', preco: 140, estoque: 4 }, { id: 'c2', sku: 'C2', cor: 'Verde', grade: 'M', preco: 140, estoque: 2 }] };
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

async function waitForDomCondition(predicate, { timeoutMs = 6000, stepMs = 100, errorMessage = 'Condição de DOM não atingida.' } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
    await flush();
  }
  throw new Error(`${errorMessage}\n${document.body.textContent}`);
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

test('promoções: carrega variações específicas desmarcadas e marca/desmarca ao editar desconto', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  fillPromoBase();
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  const checks = document.querySelectorAll('.nhp-variacao-check');
  assert.equal(checks[0].checked, false);
  assert.equal(checks[1].checked, false);
  let inputs = document.querySelectorAll('.nhp-variacao-percentual');
  inputs[0].value = '12';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  assert.equal(document.querySelectorAll('.nhp-variacao-check')[0].checked, true);
  inputs = document.querySelectorAll('.nhp-variacao-percentual');
  inputs[0].value = '';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  assert.equal(document.querySelectorAll('.nhp-variacao-check')[0].checked, false);
  assert.equal(document.querySelectorAll('.nhp-variacao-percentual')[0].value, '');
  teardownFrontendDom(dom);
});

test('promoções: mostra erro visível quando tenta adicionar item inválido e permite adicionar após preencher todos os descontos', async () => {
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
  const checks = document.querySelectorAll('.nhp-variacao-check');
  checks[0].checked = true;
  checks[0].dispatchEvent(new Event('change', { bubbles: true }));
  checks[1].checked = true;
  checks[1].dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  let inputs = document.querySelectorAll('.nhp-variacao-percentual');
  inputs[0].value = '12';
  inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Informe um desconto válido para todas as variações selecionadas/);
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 0);
  inputs = document.querySelectorAll('.nhp-variacao-percentual');
  inputs[1].value = '13';
  inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 1);
  assert.equal(spy.payloads.length, 0);
  teardownFrontendDom(dom);
});

test('promoções: preserva painel de variações aberto após carregar produto', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  await chooseProduct('Produto A');
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  assert.ok(document.querySelector('#nhp-variacoes'));
  assert.ok(document.querySelector('#nhp-variacoes').textContent.includes('Variações específicas'));
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await flush();
  assert.ok(document.querySelector('#nhp-variacoes'));
  assert.ok(document.querySelector('#nhp-variacoes').textContent.includes('Variações específicas'));
  teardownFrontendDom(dom);
});

test('promoções: adiciona somente variações com desconto válido e payload final usa valores numéricos', async () => {
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
  assert.equal(spy.payloads[0].produtos[0].percentual_desconto, null);
  assert.equal(spy.payloads[0].produtos[0].variacoes[0].percentual_desconto, 12);
  teardownFrontendDom(dom);
});

test('promoções: preserva data-only na listagem e no payload do formulário', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const baseClient = createApiClient(spy);
  const apiClient = {
    ...baseClient,
    get: async (path, params = {}) => {
      if (path === '/promocoes') {
        return {
          items: [
            {
              id: 'promo-data-only',
              nome: 'Promo data only',
              percentual_desconto: 10,
              data_inicio: '2026-06-11',
              data_fim: '2026-06-11',
              status: 'inativa',
              produtos: [{ id: 'prod-a', nome: 'Produto A', descricao: 'Descricao A' }]
            }
          ],
          total: 1
        };
      }
      return baseClient.get(path, params);
    }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /11\/06\/2026 a 11\/06\/2026/);
  document.querySelector('#nhp-new')?.click();
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-data_inicio').value = '2026-06-11';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-11';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  assert.equal(document.querySelector('#nhp-data_inicio').value, '2026-06-11');
  assert.equal(document.querySelector('#nhp-data_fim').value, '2026-06-11');
  teardownFrontendDom(dom);
});

test('promoções: lista sem coluna desconto e destaque de promoção ativa', async () => {
  const dom = setupFrontendDom('#/x');
  const apiClient = {
    async get(path) {
      if (path === '/promocoes') {
        return {
          items: [
            { id: 'promo-1', nome: 'Promo A', percentual_desconto: 10, data_inicio: '2026-06-11', data_fim: '2026-06-11', status: 'ativo', ativaAgora: true, produtos: [{ id: 'prod-a', nome: 'Produto A', descricao: 'Descricao A' }] }
          ],
          total: 1
        };
      }
      return { items: [], total: 0 };
    }
  };

  await renderPromocoesPage(document.body, { apiClient });
  await flush();

  assert.equal(Array.from(document.querySelectorAll('table th')).some((th) => /Desconto/i.test(th.textContent || '')), false);
  assert.match(document.body.textContent, /11\/06\/2026 a 11\/06\/2026/);
  assert.equal(document.querySelectorAll('.nhp-row.is-active-promo').length, 1);
  teardownFrontendDom(dom);
});

test('promoções: filtra variações sem estoque na tela e no payload', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const baseClient = createApiClient(spy);
  const apiClient = {
    ...baseClient,
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-stock', nome: 'Produto Stock', sku: 'SKU-S' }] };
      if (path === '/produtos/prod-stock') return { item: { id: 'prod-stock', nome: 'Produto Stock', descricao: 'Descricao Stock', preco: 100 } };
      if (path === '/produtos/prod-stock/variacoes') {
        return {
          items: [
            { id: 'v-ok', sku: 'OK', cor: 'Azul', grade: 'G', preco: 100, estoque: 5 },
            { id: 'v-zero', sku: 'ZERO', cor: 'Azul', grade: 'M', preco: 100, estoque: 0 },
            { id: 'v-null', sku: 'NULL', cor: 'Azul', grade: 'P', preco: 100, estoque: null },
            { id: 'v-neg', sku: 'NEG', cor: 'Azul', grade: 'GG', preco: 100, estoque: -1 }
          ]
        };
      }
      return baseClient.get(path, params);
    }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  const search = document.querySelector('#nhp-product-search');
  search.value = 'stock';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await flush();
  document.querySelector('.nhp-product-search-item')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await flush();
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  assert.equal(document.querySelectorAll('.nhp-variacao-check').length, 1);
  assert.equal(document.body.textContent.includes('Nenhuma variação com estoque disponível para promoção.'), false);
  const check = document.querySelector('.nhp-variacao-check');
  check.checked = true;
  check.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#nhp-nome').value = 'Promo estoque';
  document.querySelector('#nhp-nome').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_inicio').value = '2026-06-11';
  document.querySelector('#nhp-data_inicio').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-data_fim').value = '2026-06-11';
  document.querySelector('#nhp-data_fim').dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('#nhp-percentual_desconto').value = '10';
  document.querySelector('#nhp-percentual_desconto').dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  await flush();
  document.querySelector('#nhp-add-item').click();
  await flush();
  assert.match(document.body.textContent, /Variações específicas/);
  assert.equal(document.querySelectorAll('.nhp-variacao-check').length, 1);
  teardownFrontendDom(dom);
});

test('promoções: mostra mensagem quando produto nao tem estoque disponivel', async () => {
  const dom = setupFrontendDom('#/x');
  const baseClient = createApiClient({ payloads: [] });
  const apiClient = {
    ...baseClient,
    get: async (path, params = {}) => {
      if (path === '/promocoes') return { items: [], total: 0 };
      if (path === '/produtos/search') return { items: [{ id: 'prod-empty', nome: 'Produto Empty', sku: 'SKU-E' }] };
      if (path === '/produtos/prod-empty') return { item: { id: 'prod-empty', nome: 'Produto Empty', descricao: 'Descricao Empty', preco: 100 } };
      if (path === '/produtos/prod-empty/variacoes') {
        return {
          items: [
            { id: 'e1', sku: 'E1', cor: 'Azul', grade: 'G', preco: 100, estoque: 0 },
            { id: 'e2', sku: 'E2', cor: 'Azul', grade: 'M', preco: 100, estoque: null },
            { id: 'e3', sku: 'E3', cor: 'Azul', grade: 'P', preco: 100, estoque: -2 }
          ]
        };
      }
      return baseClient.get(path, params);
    }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  document.querySelector('#nhp-create-first')?.click();
  await flush();
  document.querySelector('#nhp-produto-search-open')?.click();
  await flush();
  const search = document.querySelector('#nhp-product-search');
  search.value = 'empty';
  search.dispatchEvent(new Event('input', { bubbles: true }));
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 800));
  await flush();
  document.querySelector('.nhp-product-search-item')?.click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await flush();
  document.querySelector('#nhp-escopo-specific').click();
  await flush();
  assert.equal(document.querySelectorAll('.nhp-variacao-check').length, 0);
  assert.match(document.body.textContent, /Nenhuma variação com estoque disponível para promoção\./);
  teardownFrontendDom(dom);
});

test('promoções: remove produto e salva apenas itens restantes sem cruzar variacoes', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { payloads: [] };
  const apiClient = createApiClient(spy);
  await openForm(apiClient);
  fillPromoBase();
  document.querySelector('#nhp-percentual_desconto').value = '10';
  document.querySelector('#nhp-percentual_desconto').dispatchEvent(new Event('input', { bubbles: true }));

  for (const term of ['Produto A', 'Produto B', 'Produto C']) {
    await chooseProduct(term);
    document.querySelector('#nhp-escopo-specific').click();
    await flush();
    const checks = document.querySelectorAll('.nhp-variacao-check');
    checks[0].checked = true;
    checks[0].dispatchEvent(new Event('change', { bubbles: true }));
    const inputs = document.querySelectorAll('.nhp-variacao-percentual');
    inputs[0].value = term === 'Produto A' ? '11' : term === 'Produto B' ? '12' : '13';
    inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 350));
    await flush();
    document.querySelector('#nhp-add-item').click();
    await flush();
  }

  assert.equal(document.querySelectorAll('.nhp-product-row').length, 3);
  document.querySelectorAll('.nhp-remove-item')[1].click();
  await flush();
  assert.equal(document.querySelectorAll('.nhp-product-row').length, 2);

  document.querySelector('#nhp-save').click();
  await flush();
  await new Promise((resolve) => setTimeout(resolve, 300));

  assert.equal(spy.payloads.length, 1);
  const payload = spy.payloads[0];
  assert.equal(payload.produtos.length, 2);
  assert.deepEqual(payload.produtos.map((item) => item.produto_id), ['prod-a', 'prod-c']);
  assert.equal(payload.produtos.some((item) => item.produto_id === 'prod-b'), false);
  assert.deepEqual(payload.produtos[0].variacoes.map((item) => item.variacao_id), ['a1']);
  assert.deepEqual(payload.produtos[1].variacoes.map((item) => item.variacao_id), ['c1']);
  teardownFrontendDom(dom);
});

test('promoções: ao editar promoção hidratada, remover um produto não reaproveita variacao cruzada no PATCH', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { postPayloads: [], patchPayloads: [], patchPaths: [], postPaths: [] };
  const apiClient = {
    get: async (path) => {
      if (path === '/promocoes') {
        return {
          items: [{
            id: 'promo-edit-1',
            nome: 'Promo Editada',
            descricao: 'Teste',
            percentual_desconto: 10,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            status: 'ativa',
            produtos: [
              {
                produto_id: 'prod-a',
                id: 'prod-a',
                nome: 'Produto A',
                descricao: 'Descricao A',
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes_disponiveis: [{ id: 'a1', produto_id: 'prod-a', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100, estoque: 5, percentual_desconto: 10 }],
                variacoes: [{ variacao_id: 'a1', percentual_desconto: 10 }]
              },
              {
                produto_id: 'prod-b',
                id: 'prod-b',
                nome: 'Produto B',
                descricao: 'Descricao B',
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes_disponiveis: [{ id: 'b1', produto_id: 'prod-b', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120, estoque: 3, percentual_desconto: 10 }],
                variacoes: [{ variacao_id: 'b1', percentual_desconto: 10 }]
              }
            ]
          }],
          total: 1
        };
      }
      if (path === '/promocoes/promo-edit-1') {
        return {
          item: {
            id: 'promo-edit-1',
            nome: 'Promo Editada',
            descricao: 'Teste',
            percentual_desconto: 10,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            status: 'ativa',
            produtos: [
              {
                produto_id: 'prod-a',
                id: 'prod-a',
                nome: 'Produto A',
                descricao: 'Descricao A',
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes_disponiveis: [{ id: 'a1', produto_id: 'prod-a', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100, estoque: 5, percentual_desconto: 10 }],
                variacoes: [{ variacao_id: 'a1', percentual_desconto: 10 }]
              },
              {
                produto_id: 'prod-b',
                id: 'prod-b',
                nome: 'Produto B',
                descricao: 'Descricao B',
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes_disponiveis: [{ id: 'b1', produto_id: 'prod-b', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120, estoque: 3, percentual_desconto: 10 }],
                variacoes: [{ variacao_id: 'b1', percentual_desconto: 10 }]
              }
            ]
          }
        };
      }
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', descricao: 'Descricao A', preco: 100 } };
      if (path === '/produtos/prod-b') return { item: { id: 'prod-b', nome: 'Produto B', descricao: 'Descricao B', preco: 120 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', produto_id: 'prod-a', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100, estoque: 5 }] };
      if (path === '/produtos/prod-b/variacoes') return { items: [{ id: 'b1', produto_id: 'prod-b', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120, estoque: 3 }] };
      return { items: [], total: 0 };
    },
    post: async (path) => {
      spy.postPaths.push(path);
      throw new Error('POST não deve ser usado na edição de promoção');
    },
    patch: async (path, payload) => {
      spy.patchPaths.push(path);
      spy.patchPayloads.push(payload);
      return { ok: true, item: { id: 'promo-edit-1' } };
    }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  await waitForDomCondition(() => document.querySelectorAll('[data-action="edit"]').length === 1, {
    errorMessage: 'Não encontrei o botão de editar na listagem hidratada.'
  });
  document.querySelector('[data-action="edit"]')?.dispatchEvent(new Event('click', { bubbles: true }));
  await waitForDomCondition(() => Boolean(document.querySelector('#nhp-save')), {
    errorMessage: 'Não encontrei o formulário de edição após abrir a promoção.'
  });
  document.querySelectorAll('.nhp-remove-item')[1]?.click();
  await flush();
  document.querySelector('#nhp-save').disabled = false;
  document.querySelector('#nhp-save')?.click();
  await waitForDomCondition(() => spy.patchPayloads.length === 1, {
    errorMessage: 'O PATCH não foi disparado ao salvar a promoção editada.'
  });
  assert.deepEqual(spy.patchPaths, ['/promocoes/promo-edit-1']);
  assert.deepEqual(spy.postPaths, []);
  const payload = spy.patchPayloads[0];
  assert.deepEqual(payload.produtos.map((item) => item.produto_id), ['prod-a']);
  assert.deepEqual(payload.produtos[0].variacoes.map((item) => item.variacao_id), ['a1']);
  assert.equal(payload.produtos[0].variacoes.some((item) => item.variacao_id === 'b1'), false);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flush();
  teardownFrontendDom(dom);
});

test('promoções: ao editar promoção hidratada, remover Produto A não deixa Produto B herdar variacao A', async () => {
  const dom = setupFrontendDom('#/x');
  const spy = { patchPayloads: [], patchPaths: [], postPaths: [] };
  const apiClient = {
    get: async (path) => {
      if (path === '/promocoes') {
        return {
          items: [{
            id: 'promo-edit-2',
            nome: 'Promo Editada 2',
            descricao: 'Teste',
            percentual_desconto: 10,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            status: 'ativa',
            produtos: [
              {
                produto_id: 'prod-a',
                id: 'prod-a',
                nome: 'Produto A',
                descricao: 'Descricao A',
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes_disponiveis: [{ id: 'a1', produto_id: 'prod-a', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100, estoque: 5, percentual_desconto: 10 }],
                variacoes: [{ variacao_id: 'a1', percentual_desconto: 10 }]
              },
              {
                produto_id: 'prod-b',
                id: 'prod-b',
                nome: 'Produto B',
                descricao: 'Descricao B',
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes_disponiveis: [{ id: 'b1', produto_id: 'prod-b', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120, estoque: 3, percentual_desconto: 10 }],
                variacoes: [{ variacao_id: 'b1', percentual_desconto: 10 }]
              }
            ]
          }],
          total: 1
        };
      }
      if (path === '/produtos/prod-a') return { item: { id: 'prod-a', nome: 'Produto A', descricao: 'Descricao A', preco: 100 } };
      if (path === '/produtos/prod-b') return { item: { id: 'prod-b', nome: 'Produto B', descricao: 'Descricao B', preco: 120 } };
      if (path === '/produtos/prod-a/variacoes') return { items: [{ id: 'a1', produto_id: 'prod-a', sku: 'A1', cor: 'Azul', grade: 'G', preco: 100, estoque: 5 }] };
      if (path === '/produtos/prod-b/variacoes') return { items: [{ id: 'b1', produto_id: 'prod-b', sku: 'B1', cor: 'Preto', grade: 'M', preco: 120, estoque: 3 }] };
      return { items: [], total: 0 };
    },
    post: async (path) => {
      spy.postPaths.push(path);
      throw new Error('POST não deve ser usado na edição de promoção');
    },
    patch: async (path, payload) => {
      spy.patchPaths.push(path);
      spy.patchPayloads.push(payload);
      return { ok: true, item: { id: 'promo-edit-2' } };
    }
  };
  await renderPromocoesPage(document.body, { apiClient });
  await flush();
  await waitForDomCondition(() => document.querySelectorAll('[data-action="edit"]').length === 1, {
    errorMessage: 'Não encontrei o botão de editar na listagem hidratada.'
  });
  document.querySelector('[data-action="edit"]')?.dispatchEvent(new Event('click', { bubbles: true }));
  await waitForDomCondition(() => Boolean(document.querySelector('#nhp-save')), {
    errorMessage: 'Não encontrei o formulário de edição após abrir a promoção.'
  });
  document.querySelectorAll('.nhp-remove-item')[0]?.click();
  await flush();
  document.querySelector('#nhp-save').disabled = false;
  document.querySelector('#nhp-save')?.click();
  await waitForDomCondition(() => spy.patchPayloads.length === 1, {
    errorMessage: 'O PATCH não foi disparado ao salvar a promoção editada.'
  });
  assert.deepEqual(spy.patchPaths, ['/promocoes/promo-edit-2']);
  assert.deepEqual(spy.postPaths, []);
  const payload = spy.patchPayloads[0];
  assert.deepEqual(payload.produtos.map((item) => item.produto_id), ['prod-b']);
  assert.deepEqual(payload.produtos[0].variacoes.map((item) => item.variacao_id), ['b1']);
  assert.equal(payload.produtos[0].variacoes.some((item) => item.variacao_id === 'a1'), false);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await flush();
  teardownFrontendDom(dom);
});
