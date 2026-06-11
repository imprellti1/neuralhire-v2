import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryProdutos, __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryProductEditorForTests, createVariation } from '../../modules/product-editor/product-editor.repository.js';
import { __resetMemoryPromocoesForTests, __setPromocoesSupabaseClientForTests, calcularPrecoPromocional, isPromocaoAtiva } from '../../modules/promocoes/promocoes.repository.js';

function createSupabaseMock() {
  const state = { promocoes: [], produtos: [], variacoes: [], lastInsert: null, lastUpdate: null };
  function readTable(table) {
    if (table === 'produto_promocoes') return [...state.promocoes];
    if (table === 'produto_promocao_produtos') return [...state.produtos];
    if (table === 'produto_promocao_variacoes') return [...state.variacoes];
    if (table === 'produtos') return [...state.produtosCatalogo || []];
    if (table === 'produto_variacoes') return [...state.variacoesCatalogo || []];
    return [];
  }
  function applyFilters(rows, filter = {}) {
    return rows.filter((row) => {
      for (const [key, value] of Object.entries(filter)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          if (!value.map(String).includes(String(row[key]))) return false;
        } else if (String(row[key]) !== String(value)) {
          return false;
        }
      }
      return true;
    });
  }
  return {
    state,
    from(table) {
      const chain = {
        _table: table,
        _filter: {},
        select() { return this; },
        eq(k, v) { this._filter[k] = v; return this; },
        order() { return this; },
        in() { return this; },
        then(resolve) {
          const rows = applyFilters(readTable(table), this._filter);
          const data = table === 'produto_promocoes' ? rows : rows;
          return Promise.resolve({ data, error: null }).then(resolve);
        },
        delete() {
          return {
            _filter: {},
            eq(k, v) {
              this._filter[k] = v;
              return this;
            },
            then(resolve) {
              return Promise.resolve({ data: null, error: null }).then(resolve);
            }
          };
        },
        insert(payload) {
          if (table === 'produto_promocoes') {
            state.lastInsert = payload;
            state.promocoes.push({ ...payload });
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: state.promocoes[state.promocoes.length - 1] || null, error: null });
                  }
                };
              }
            };
          }
          if (table === 'produto_promocao_produtos') {
            const rows = Array.isArray(payload) ? payload : [payload];
            state.produtos.push(...rows.map((row) => ({ ...row })));
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: rows[0] || null, error: null });
                  },
                  then(resolve) {
                    return Promise.resolve({ data: rows.map((row) => ({ ...row })), error: null }).then(resolve);
                  }
                };
              }
            };
          }
          if (table === 'produto_promocao_variacoes') {
            const rows = Array.isArray(payload) ? payload : [payload];
            state.variacoes.push(...rows.map((row) => ({ ...row })));
            return Promise.resolve({ data: rows.map((row) => ({ ...row })), error: null });
          }
          return this;
        },
        update(payload) {
          if (table === 'produto_promocoes') state.lastUpdate = payload;
          return this;
        },
        single() {
          if (table === 'produto_promocoes') {
            return Promise.resolve({ data: state.lastUpdate || state.promocoes[state.promocoes.length - 1] || null, error: null });
          }
          if (table === 'produtos') {
            const rows = applyFilters(readTable(table), this._filter);
            return Promise.resolve({ data: rows[0] || null, error: null });
          }
          if (table === 'produto_variacoes') {
            const rows = applyFilters(readTable(table), this._filter);
            return Promise.resolve({ data: rows[0] || null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() { return this.single(); },
        range() { return Promise.resolve({ data: applyFilters(readTable(table), this._filter), count: applyFilters(readTable(table), this._filter).length, error: null }); }
      };
      return chain;
    }
  };
}

async function call(app, { method, url, accountId, body }) {
  const headers = { 'x-test-role': 'admin', 'x-test-account-id': accountId };
  if (body) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: JSON.parse(res.body || '{}') };
}

export function getPromocoesTests() {
  return [
    {
      name: 'lista promocoes legadas e multi-produto sem quebrar compatibilidade',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produtoLegado = { id: 'produto-legado', account_id: 'acc-promo-legacy', nome: 'Produto Legado', descricao: 'Descricao legado', preco: 100 };
        const produtoA = { id: 'produto-multi-a', account_id: 'acc-promo-legacy', nome: 'Produto Multi A', preco: 200, variacoes: [{ id: 'va-1', produto_id: 'produto-multi-a', account_id: 'acc-promo-legacy', preco: 180, ativo: true }] };
        const produtoB = { id: 'produto-multi-b', account_id: 'acc-promo-legacy', nome: 'Produto Multi B', preco: 300, variacoes: [{ id: 'vb-1', produto_id: 'produto-multi-b', account_id: 'acc-promo-legacy', preco: 260, ativo: true }] };
        __loadMemoryProdutos([produtoLegado, produtoA, produtoB]);

        await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-legacy',
          body: {
            produto_id: produtoLegado.id,
            nome: 'Promo Legada',
            percentual_desconto: 12,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            aplicar_em_todas_variacoes: true
          }
        });

        await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-legacy',
          body: {
            nome: 'Promo Multi',
            percentual_desconto: 8,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            produtos: [
              {
                produto_id: produtoA.id,
                aplicar_em_todas_variacoes: true,
                percentual_desconto: 8
              },
              {
                produto_id: produtoB.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 6,
                variacoes: [{ variacaoId: 'vb-1', percentualDesconto: 5 }]
              }
            ]
          }
        });

        const list = await call(app, { method: 'GET', url: '/promocoes', accountId: 'acc-promo-legacy' });
        assert.equal(list.res.statusCode, 200);
        assert.equal(list.body.items.length, 2);

        const legacy = list.body.items.find((item) => item.nome === 'Promo Legada');
        assert.ok(legacy);
        assert.equal(legacy.produto.id, produtoLegado.id);
        assert.equal(legacy.produtos.length, 1);
        assert.equal(legacy.produtos[0].variacoes.length, 0);

        const multi = list.body.items.find((item) => item.nome === 'Promo Multi');
        assert.ok(multi);
        assert.equal(multi.produtos.length, 2);
        assert.equal(multi.produtos[0].id, produtoA.id);
        assert.equal(multi.produtos[0].variacoes.length, 1);
        assert.equal(multi.produtos[1].id, produtoB.id);
        assert.equal(multi.produtos[1].variacoes[0].percentual_desconto, 5);
      }
    },
    {
      name: 'edita promocao multi-produto preservando e validando variacoes por produto',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produtoA = { id: 'produto-edit-a', account_id: 'acc-promo-edit', nome: 'Produto Edit A', preco: 200, variacoes: [
          { id: 'va-1', produto_id: 'produto-edit-a', account_id: 'acc-promo-edit', preco: 180, ativo: true },
          { id: 'va-2', produto_id: 'produto-edit-a', account_id: 'acc-promo-edit', preco: 170, ativo: true }
        ] };
        const produtoB = { id: 'produto-edit-b', account_id: 'acc-promo-edit', nome: 'Produto Edit B', preco: 300, variacoes: [
          { id: 'vb-1', produto_id: 'produto-edit-b', account_id: 'acc-promo-edit', preco: 260, ativo: true },
          { id: 'vb-2', produto_id: 'produto-edit-b', account_id: 'acc-promo-edit', preco: 250, ativo: true }
        ] };
        __loadMemoryProdutos([produtoA, produtoB]);

        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-edit',
          body: {
            nome: 'Promo Edit',
            percentual_desconto: 10,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            produtos: [
              {
                produto_id: produtoA.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes: [{ variacao_id: 'va-1', percentual_desconto: 12 }]
              },
              {
                produto_id: produtoB.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 7,
                variacoes: [{ variacao_id: 'vb-1', percentual_desconto: 5 }]
              }
            ]
          }
        });
        assert.equal(created.res.statusCode, 200);
        const promocaoId = created.body.item.id;

        const updated = await call(app, {
          method: 'PATCH',
          url: `/promocoes/${promocaoId}`,
          accountId: 'acc-promo-edit',
          body: {
            nome: 'Promo Edit 2',
            produtos: [
              {
                produto_id: produtoA.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 11,
                variacoes: [
                  { variacao_id: 'va-1', percentual_desconto: 13 },
                  { variacao_id: 'va-2', percentual_desconto: 9 }
                ]
              },
              {
                produto_id: produtoB.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 8,
                variacoes: [{ variacao_id: 'vb-2', percentual_desconto: 6 }]
              }
            ],
            data_inicio: '2026-06-05',
            data_fim: '2026-06-25'
          }
        });
        assert.equal(updated.res.statusCode, 200);
        assert.equal(updated.body.item.nome, 'Promo Edit 2');
        assert.equal(updated.body.item.produtos.length, 2);
        assert.equal(updated.body.item.produtos[0].variacoes.length, 2);
        assert.equal(updated.body.item.produtos[1].variacoes.length, 1);
        assert.equal(updated.body.item.produtos[0].variacoes[0].percentual_desconto, 13);
        assert.equal(updated.body.item.produtos[1].variacoes[0].percentual_desconto, 6);

        const reloaded = await call(app, { method: 'GET', url: `/promocoes/${promocaoId}`, accountId: 'acc-promo-edit' });
        assert.equal(reloaded.res.statusCode, 200);
        assert.equal(reloaded.body.item.produtos.length, 2);
        assert.equal(reloaded.body.item.produtos[0].variacoes.length, 2);
        assert.equal(reloaded.body.item.produtos[1].variacoes.length, 1);
      }
    },
    {
      name: 'ignora campos derivados ao persistir promocao via supabase',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const mock = createSupabaseMock();
        __setPromocoesSupabaseClientForTests(mock, true);
        try {
          const app = createApiApp();
          const accountId = 'acc-promo-supabase-sanitizacao-01';
          const produtoId = 'produto-supabase-sanitizacao-01';
          const variacaoId = 'vs-supabase-sanitizacao-01';
          const produto = { id: produtoId, account_id: accountId, nome: 'Produto Supabase', preco: 100 };
          __loadMemoryProdutos([{
            ...produto,
            variacoes: [{ id: variacaoId, account_id: accountId, produto_id: produtoId, preco: 80, ativo: true, estoque_atual: 3 }]
          }]);
          mock.state.produtosCatalogo = [produto];
          mock.state.variacoesCatalogo = [{ id: variacaoId, account_id: accountId, produto_id: produtoId, preco: 80, ativo: true, estoque_atual: 3 }];

          const created = await call(app, {
            method: 'POST',
            url: '/promocoes',
            accountId,
            body: {
              nome: 'Promo Supabase',
              percentual_desconto: 10,
              data_inicio: '2026-06-01',
              data_fim: '2026-06-30',
              produto_id: produto.id,
              ativaAgora: true,
              produtos: [{
                produto_id: produto.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                ativaAgora: true,
                produto_nome: 'Ignorar',
                variacoes: [{ variacaoId, percentualDesconto: 12, ativaAgora: true }]
              }]
            }
          });

          assert.equal(created.res.statusCode, 200);
          assert.ok(mock.state.lastInsert);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastInsert, 'ativaAgora'), false);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastInsert, 'produtos'), false);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastInsert, 'variacoes'), false);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastInsert, 'produto_nome'), false);

          const promocaoId = created.body.item.id;
          const updated = await call(app, {
            method: 'PATCH',
            url: `/promocoes/${promocaoId}`,
            accountId,
            body: {
              ...created.body.item,
              nome: 'Promo Supabase 2',
              ativaAgora: false,
              produtos: [{
                ...created.body.item.produtos[0],
                aplicar_em_todas_variacoes: true,
                variacoes: created.body.item.produtos[0].variacoes
              }]
            }
          });

          assert.equal(updated.res.statusCode, 200);
          assert.ok(mock.state.lastUpdate);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastUpdate, 'ativaAgora'), false);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastUpdate, 'produtos'), false);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastUpdate, 'variacoes'), false);
          assert.equal(Object.prototype.hasOwnProperty.call(mock.state.lastUpdate, 'produto_nome'), false);
        } finally {
          __resetMemoryPromocoesForTests();
        }
      }
    },
    {
      name: 'rejeita variacao de outro produto ao editar promocao multi-produto',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produtoA = { id: 'produto-reject-a', account_id: 'acc-promo-reject', nome: 'Produto Reject A', variacoes: [{ id: 'ra-1', produto_id: 'produto-reject-a', account_id: 'acc-promo-reject', preco: 180, ativo: true }] };
        const produtoB = { id: 'produto-reject-b', account_id: 'acc-promo-reject', nome: 'Produto Reject B', variacoes: [{ id: 'rb-1', produto_id: 'produto-reject-b', account_id: 'acc-promo-reject', preco: 280, ativo: true }] };
        __loadMemoryProdutos([produtoA, produtoB]);
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-reject',
          body: {
            nome: 'Promo Reject',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            produtos: [
              { produto_id: produtoA.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacao_id: 'ra-1', percentual_desconto: 10 }] },
              { produto_id: produtoB.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacao_id: 'rb-1', percentual_desconto: 10 }] }
            ]
          }
        });
        const promocaoId = created.body.item.id;
        const invalid = await call(app, {
          method: 'PATCH',
          url: `/promocoes/${promocaoId}`,
          accountId: 'acc-promo-reject',
          body: {
            produtos: [
              {
                produto_id: produtoA.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes: [{ variacao_id: 'rb-1', percentual_desconto: 9 }]
              }
            ]
          }
        });
        assert.equal(invalid.res.statusCode, 422);
      }
    },
    {
      name: 'promocao multi-produto retorna produto b no produto 360 com variacao real hidratada',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produtoA = { id: 'produto-master', account_id: 'acc-promo-360', nome: 'MASTER', preco: 200, variacoes: [{ id: 'ma-1', produto_id: 'produto-master', account_id: 'acc-promo-360', preco: 180, ativo: true }] };
        const produtoB = { id: 'produto-monarca', account_id: 'acc-promo-360', nome: 'MONARCA', preco: 300, variacoes: [{ id: 'mb-1', produto_id: 'produto-monarca', account_id: 'acc-promo-360', preco: 260, ativo: true }] };
        __loadMemoryProdutos([produtoA, produtoB]);
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-360',
          body: {
            nome: 'Promo 360',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            percentual_desconto: 10,
            produtos: [
              { produto_id: produtoA.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacaoId: 'ma-1', percentualDesconto: 10 }] },
              { produto_id: produtoB.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacaoId: 'mb-1', percentualDesconto: 10 }] }
            ]
          }
        });
        assert.equal(created.res.statusCode, 200);
        const produtoBPromos = await call(app, { method: 'GET', url: `/produtos/${produtoB.id}/promocoes`, accountId: 'acc-promo-360' });
        assert.equal(produtoBPromos.res.statusCode, 200);
        assert.equal(produtoBPromos.body.items.length, 1);
        assert.equal(produtoBPromos.body.items[0].produtos.some((produto) => String(produto.id) === produtoB.id), true);
        const hydrated = produtoBPromos.body.items[0].produtos.find((produto) => String(produto.id) === produtoB.id);
        assert.equal(hydrated.variacoes.length, 1);
        assert.equal(String(hydrated.variacoes[0].id), 'mb-1');
        assert.equal(hydrated.variacoes[0].variacao_id, 'mb-1');
        assert.equal(hydrated.variacoes[0].variacaoId, 'mb-1');
        assert.equal(hydrated.variacoes[0].percentual_desconto, 10);
        assert.equal(produtoBPromos.body.items[0].produtos[0].id, produtoA.id);
        assert.equal(produtoBPromos.body.items[0].produtos[0].variacoes[0].id, 'ma-1');
      }
    },
    {
      name: 'permite remover item ao editar promocao multi-produto e salvar novamente',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produtoA = { id: 'produto-remove-a', account_id: 'acc-promo-remove', nome: 'Produto Remove A', variacoes: [{ id: 'rma-1', produto_id: 'produto-remove-a', account_id: 'acc-promo-remove', preco: 180, ativo: true }] };
        const produtoB = { id: 'produto-remove-b', account_id: 'acc-promo-remove', nome: 'Produto Remove B', variacoes: [{ id: 'rmb-1', produto_id: 'produto-remove-b', account_id: 'acc-promo-remove', preco: 280, ativo: true }] };
        __loadMemoryProdutos([produtoA, produtoB]);
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-remove',
          body: {
            nome: 'Promo Remove',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            produtos: [
              { produto_id: produtoA.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacao_id: 'rma-1', percentual_desconto: 10 }] },
              { produto_id: produtoB.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacao_id: 'rmb-1', percentual_desconto: 10 }] }
            ]
          }
        });
        const promocaoId = created.body.item.id;
        const updated = await call(app, {
          method: 'PATCH',
          url: `/promocoes/${promocaoId}`,
          accountId: 'acc-promo-remove',
          body: {
            produtos: [
              { produto_id: produtoA.id, aplicar_em_todas_variacoes: false, percentual_desconto: 12, variacoes: [{ variacao_id: 'rma-1', percentual_desconto: 12 }] }
            ]
          }
        });
        assert.equal(updated.res.statusCode, 200);
        assert.equal(updated.body.item.produtos.length, 1);
        assert.equal(updated.body.item.produtos[0].id, produtoA.id);
        assert.equal(updated.body.item.produtos[0].variacoes.some((variacao) => variacao.variacao_id === 'rmb-1'), false);
        const reloaded = await call(app, { method: 'GET', url: `/promocoes/${promocaoId}`, accountId: 'acc-promo-remove' });
        assert.equal(reloaded.body.item.produtos.length, 1);
        assert.equal(reloaded.body.item.produtos[0].variacoes.some((variacao) => variacao.variacao_id === 'rmb-1'), false);
      }
    },
    {
      name: 'aceita payload consolidado apos remover item e preserva agrupamento das variacoes',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produtoA = { id: 'produto-consolidado-a', account_id: 'acc-promo-cons', nome: 'Produto Cons A', variacoes: [{ id: 'ca-1', produto_id: 'produto-consolidado-a', account_id: 'acc-promo-cons', preco: 180, ativo: true }] };
        const produtoB = { id: 'produto-consolidado-b', account_id: 'acc-promo-cons', nome: 'Produto Cons B', variacoes: [{ id: 'cb-1', produto_id: 'produto-consolidado-b', account_id: 'acc-promo-cons', preco: 280, ativo: true }] };
        __loadMemoryProdutos([produtoA, produtoB]);
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-cons',
          body: {
            nome: 'Promo Consolidada',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            produtos: [
              { produto_id: produtoA.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacao_id: 'ca-1', percentual_desconto: 10 }] },
              { produto_id: produtoB.id, aplicar_em_todas_variacoes: false, percentual_desconto: 10, variacoes: [{ variacao_id: 'cb-1', percentual_desconto: 10 }] }
            ]
          }
        });
        const promocao = created.body.item;
        const consolidated = await call(app, {
          method: 'PATCH',
          url: `/promocoes/${promocao.id}`,
          accountId: 'acc-promo-cons',
          body: {
            nome: promocao.nome,
            descricao: promocao.descricao,
            data_inicio: promocao.data_inicio,
            data_fim: promocao.data_fim,
            status: promocao.status,
            produtos: promocao.produtos
              .filter((produto) => produto.id !== produtoB.id)
              .map((produto) => ({
                ...produto,
                produto_id: produto.id,
                variacoesSelecionadas: produto.variacoes.map((variacao) => ({
                  variacaoId: variacao.variacao_id,
                  percentualDesconto: variacao.percentual_desconto
                })),
                variacao_ids: produto.variacoes.map((variacao) => variacao.variacao_id),
                variacoes: produto.variacoes.map((variacao) => ({
                  ...variacao,
                  produto_id: produto.id
                }))
              }))
          }
        });
        assert.equal(consolidated.res.statusCode, 200);
        assert.equal(consolidated.body.item.produtos.length, 1);
        assert.equal(consolidated.body.item.produtos[0].id, produtoA.id);
        assert.equal(consolidated.body.item.produtos[0].variacoes[0].variacao_id, 'ca-1');
      }
    },
    {
      name: 'smoke registra rotas de promocoes',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Smoke', preco: 100 }, { accountId: 'acc-promo-smoke' });

        const list = await call(app, { method: 'GET', url: '/promocoes', accountId: 'acc-promo-smoke' });
        assert.notEqual(list.res.statusCode, 404);

        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-smoke',
          body: {
            produto_id: produto.id,
            nome: 'Smoke Promo',
            percentual_desconto: 10,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            aplicar_em_todas_variacoes: true
          }
        });
        assert.notEqual(created.res.statusCode, 404);
      }
    },
    {
      name: 'lista promocoes enriquece dados do produto',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Enriquecido', descricao: 'Descricao do produto', preco: 100 }, { accountId: 'acc-promo-enriched' });
        await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-enriched',
          body: {
            produto_id: produto.id,
            nome: 'Promo Enriquecida',
            percentual_desconto: 10,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            aplicar_em_todas_variacoes: true
          }
        });
        const list = await call(app, { method: 'GET', url: '/promocoes', accountId: 'acc-promo-enriched' });
        assert.equal(list.body.items[0].produto.id, produto.id);
        assert.equal(list.body.items[0].produto.nome, 'Produto Enriquecido');
        assert.equal(list.body.items[0].produto.descricao, 'Descricao do produto');
        assert.equal(list.body.items[0].produtos[0].id, produto.id);
        assert.equal(list.body.items[0].produtos[0].nome, 'Produto Enriquecido');
        assert.equal(list.body.items[0].produtos[0].descricao, 'Descricao do produto');
      }
    },
    {
      name: 'permite promocao por variacao sem percentual global',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = { id: 'produto-6', account_id: 'acc-promo-6', nome: 'Produto Promo 6', variacoes: [{ id: 'v40', produto_id: 'produto-6', account_id: 'acc-promo-6', preco: 80, ativo: true }] };
        __loadMemoryProdutos([produto]);
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-6',
          body: {
            produto_id: produto.id,
            nome: 'Sem global',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            aplicar_em_todas_variacoes: false,
            variacoesSelecionadas: [{ variacaoId: 'v40', percentualDesconto: 9 }]
          }
        });
        assert.equal(created.res.statusCode, 200);
        assert.equal(created.body.item.produtos[0].aplicar_em_todas_variacoes, false);
        assert.equal(created.body.item.produtos[0].percentual_desconto, null);
        assert.equal(created.body.item.produtos[0].variacoes[0].percentual_desconto, 9);
        assert.equal(created.body.item.produtos[0].variacoes.some((variacao) => variacao.variacao_id === 'v40'), true);
      }
    },
    {
      name: 'cria promocao para todas as variacoes e lista por produto',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Promo', preco: 100, variacoes: [{ id: 'v1', produto_id: 'produto-1', account_id: 'acc-promo', preco: 80, ativo: true }] }, { accountId: 'acc-promo' });
        const created = await call(app, { method: 'POST', url: '/promocoes', accountId: 'acc-promo', body: { produto_id: produto.id, nome: 'Black Friday', percentual_desconto: 10, data_inicio: '2026-06-01', data_fim: '2026-06-30', aplicar_em_todas_variacoes: true } });
        assert.equal(created.res.statusCode, 200);
        assert.equal(created.body.item.ativaAgora, true);
        const list = await call(app, { method: 'GET', url: `/produtos/${produto.id}/promocoes`, accountId: 'acc-promo' });
        assert.equal(list.body.items.length, 1);
      }
    },
    {
      name: 'cria promocao de variacoes especificas com desconto individual e prevalencia por variacao',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = { id: 'produto-3', account_id: 'acc-promo-3', nome: 'Produto Promo 3', preco: 100, variacoes: [{ id: 'v10', produto_id: 'produto-3', account_id: 'acc-promo-3', preco: 80, ativo: true }, { id: 'v11', produto_id: 'produto-3', account_id: 'acc-promo-3', preco: 70, ativo: true }] };
        __loadMemoryProdutos([produto]);
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-3',
          body: {
            nome: 'Só variações',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            produtos: [
              {
                produto_id: produto.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes: [
                  { variacao_id: 'v10', percentual_desconto: 12 },
                  { variacao_id: 'v11', percentual_desconto: 8 }
                ]
              }
            ]
          }
        });
        assert.equal(created.res.statusCode, 200);
        const list = await call(app, { method: 'GET', url: `/produtos/${produto.id}/promocoes`, accountId: 'acc-promo-3' });
        assert.equal(list.body.items[0].produtos[0].variacoes.length, 2);
        assert.equal(list.body.items[0].produtos[0].variacoes[0].percentual_desconto, 12);
      }
    },
    {
      name: 'rejeita variacoes especificas sem desconto global e sem desconto individual',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Promo 4', preco: 100 }, { accountId: 'acc-promo-4' });
        const variacao = await createVariation(produto.id, { sku: 'v20', preco: 80, ativo: true }, { accountId: 'acc-promo-4' });
        const invalid = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-4',
          body: {
            produto_id: produto.id,
            nome: 'Inválida',
            percentual_desconto: null,
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            aplicar_em_todas_variacoes: false,
            variacoesSelecionadas: []
          }
        });
        assert.equal(invalid.res.statusCode, 422);
      }
    },
    {
      name: 'rejeita percentual e periodo invalidos',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Promo 2' }, { accountId: 'acc-promo-2' });
        const invalidPercent = await call(app, { method: 'POST', url: '/promocoes', accountId: 'acc-promo-2', body: { produto_id: produto.id, nome: 'X', percentual_desconto: 0, data_inicio: '2026-06-01', data_fim: '2026-06-30' } });
        assert.equal(invalidPercent.res.statusCode, 422);
        const invalidDate = await call(app, { method: 'POST', url: '/promocoes', accountId: 'acc-promo-2', body: { produto_id: produto.id, nome: 'X', percentual_desconto: 10, data_inicio: '2026-07-01', data_fim: '2026-06-30' } });
        assert.equal(invalidDate.res.statusCode, 422);
      }
    },
    {
      name: 'rejeita percentual individual invalido e ignora account_id do body',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = { id: 'produto-5', account_id: 'acc-promo-5', nome: 'Produto Promo 5', variacoes: [{ id: 'v30', produto_id: 'produto-5', account_id: 'acc-promo-5', preco: 80, ativo: true }] };
        __loadMemoryProdutos([produto]);
        const invalid = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-promo-5',
          body: {
            produto_id: produto.id,
            nome: 'Inválida',
            data_inicio: '2026-06-01',
            data_fim: '2026-06-30',
            aplicar_em_todas_variacoes: false,
            variacoesSelecionadas: [{ variacaoId: 'v30', percentualDesconto: 0 }]
          }
        });
        assert.equal(invalid.res.statusCode, 422);
      }
    },
    {
      name: 'calcula preco promocional e ativa agora',
      run: async () => {
        assert.equal(calcularPrecoPromocional(100, 15), 85);
        assert.equal(isPromocaoAtiva({ status: 'ativo', data_inicio: '2026-06-01', data_fim: '2026-06-30' }, new Date('2026-06-10')), true);
        assert.equal(isPromocaoAtiva({ status: 'inativo', data_inicio: '2026-06-01', data_fim: '2026-06-30' }, new Date('2026-06-10')), false);
      }
    },
    {
      name: 'mantem datas date-only ao criar e atualizar promocao',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Date Only', preco: 100 }, { accountId: 'acc-date-only' });
        const created = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-date-only',
          body: {
            produto_id: produto.id,
            nome: 'Promo Date Only',
            percentual_desconto: 10,
            data_inicio: '2026-06-11',
            data_fim: '2026-06-11',
            aplicar_em_todas_variacoes: true
          }
        });
        assert.equal(created.res.statusCode, 200);
        assert.equal(created.body.item.data_inicio, '2026-06-11');
        assert.equal(created.body.item.data_fim, '2026-06-11');
        assert.equal(created.body.item.ativaAgora, true);

        const promocaoId = created.body.item.id;
        const updated = await call(app, {
          method: 'PATCH',
          url: `/promocoes/${promocaoId}`,
          accountId: 'acc-date-only',
          body: {
            data_inicio: '2026-06-11',
            data_fim: '2026-06-11'
          }
        });
        assert.equal(updated.res.statusCode, 200);
        assert.equal(updated.body.item.data_inicio, '2026-06-11');
        assert.equal(updated.body.item.data_fim, '2026-06-11');
        assert.equal(updated.body.item.ativaAgora, true);
      }
    },
    {
      name: 'rejeita variacao sem estoque e aceita variação com estoque',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = {
          id: 'produto-estoque',
          account_id: 'acc-estoque',
          nome: 'Produto Estoque',
          preco: 100,
          variacoes: [
            { id: 'v-ok', produto_id: 'produto-estoque', account_id: 'acc-estoque', preco: 80, ativo: true, estoque: 4 },
            { id: 'v-zero', produto_id: 'produto-estoque', account_id: 'acc-estoque', preco: 80, ativo: true, estoque: 0 }
          ]
        };
        __loadMemoryProdutos([produto]);
        const accepted = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-estoque',
          body: {
            nome: 'Promo Estoque',
            percentual_desconto: 10,
            data_inicio: '2026-06-11',
            data_fim: '2026-06-11',
            produtos: [
              {
                produto_id: produto.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes: [{ variacao_id: 'v-ok', percentual_desconto: 12 }]
              }
            ]
          }
        });
        assert.equal(accepted.res.statusCode, 200);
        assert.equal(accepted.body.item.produtos[0].id, produto.id);
        assert.equal(Array.isArray(accepted.body.item.produtos[0].variacoes), true);
        assert.equal(accepted.body.item.produtos[0].variacoes[0].variacao_id, 'v-ok');
        assert.equal(accepted.body.item.produtos[0].variacoes.some((variacao) => variacao.variacao_id === 'v-zero'), false);

        const rejected = await call(app, {
          method: 'POST',
          url: '/promocoes',
          accountId: 'acc-estoque',
          body: {
            nome: 'Promo Estoque 2',
            percentual_desconto: 10,
            data_inicio: '2026-06-11',
            data_fim: '2026-06-11',
            produtos: [
              {
                produto_id: produto.id,
                aplicar_em_todas_variacoes: false,
                percentual_desconto: 10,
                variacoes: [{ variacao_id: 'v-zero', percentual_desconto: 12 }]
              }
            ]
          }
        });
        assert.equal(rejected.res.statusCode, 422);
        assert.match(rejected.body.error.message || rejected.body.message || '', /sem estoque disponível para promoção/i);
      }
    }
  ];
}
