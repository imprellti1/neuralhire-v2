import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryProdutos, __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPromocoesForTests, calcularPrecoPromocional, isPromocaoAtiva } from '../../modules/promocoes/promocoes.repository.js';

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
        assert.equal(created.body.item.percentual_desconto, null);
        assert.equal(created.body.item.variacoesSelecionadas[0].percentual_desconto, 9);
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
        __resetMemoryPromocoesForTests();
        const app = createApiApp();
        const produto = { id: 'produto-4', account_id: 'acc-promo-4', nome: 'Produto Promo 4', variacoes: [{ id: 'v20', produto_id: 'produto-4', account_id: 'acc-promo-4', preco: 80, ativo: true }] };
        __loadMemoryProdutos([produto]);
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
            variacoesSelecionadas: [{ variacaoId: 'v20', percentualDesconto: null }]
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
    }
  ];
}
