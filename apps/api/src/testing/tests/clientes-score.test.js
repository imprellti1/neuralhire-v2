import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, __setClientesSupabaseClientForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { calcularScoreCliente } from '../../modules/clientes/clientes.score.service.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function createSupabasePedidosMock({ rows = [], onSelect = null } = {}) {
  const state = { rows: rows.map((row) => ({ ...row })) };
  const query = {
    _filters: {},
    _select: null,
    _orders: [],
    _limit: null,
    select(fields) {
      this._select = fields;
      if (onSelect) onSelect(fields, this);
      return this;
    },
    eq(key, value) { this._filters[key] = value; return this; },
    order(field, options) { this._orders.push({ field, options }); return this; },
    limit(value) { this._limit = value; return this; },
    then(resolve) { return Promise.resolve({ data: state.rows, error: null }).then(resolve); }
  };
  return {
    query,
    from(table) {
      if (table !== 'pedidos') throw new Error(`Tabela inesperada: ${table}`);
      return query;
    }
  };
}

async function call(app, { method, url, role, accountId, userId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (userId) headers['x-test-user-id'] = userId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getClientesScoreTests() {
  return [
    {
      name: 'servico de score retorna zero sem pedidos',
      run: async () => {
        const result = calcularScoreCliente({ cliente: { id: 'c1' }, pedidos: [], itens: [] });
        assertEqual(result.score, 0);
        assertEqual(result.classificacao, 'D');
        assertEqual(result.potencial, 'Baixo');
      }
    },
    {
      name: 'servico de score considera pedidos e itens validos',
      run: async () => {
        const result = calcularScoreCliente({
          cliente: { id: 'c1' },
          pedidos: [
            { id: 'p1', status: 'faturado', valor_total: 1000, data_faturamento: '2026-06-15T00:00:00.000Z', itens: [{ produto_id: 'a', quantidade: 1, total: 1000 }] },
            { id: 'p2', status: 'aprovado', valor_total: 2000, data_faturamento: '2026-06-10T00:00:00.000Z', itens: [{ produto_id: 'b', quantidade: 2, total: 2000 }] }
          ],
          itens: [
            { pedido_id: 'p1', produto_id: 'a' },
            { pedido_id: 'p2', produto_id: 'b' }
          ]
        });
        assertEqual(result.fatores.total_pedidos, 2);
        assertEqual(result.fatores.faturamento_total, 3000);
        assertEqual(result.fatores.produtos_distintos, 2);
        assertEqual(result.score > 0, true);
      }
    },
    {
      name: 'endpoint de score ignora pedidos cancelados e retorna cliente atualizado',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Score' }, { accountId: 'acc-s1' });
        await createPedido({ cliente_id: cliente.id, status: 'cancelado', itens: [{ produto_id: 'p1', produto_nome: 'Produto A', quantidade: 1, preco_unitario: 500 }] }, { accountId: 'acc-s1' }).catch(() => null);
        await createPedido({ cliente_id: cliente.id, status: 'faturado', itens: [{ produto_id: 'p2', produto_nome: 'Produto B', quantidade: 2, preco_unitario: 250 }] }, { accountId: 'acc-s1' });
        const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-score`, role: 'admin', accountId: 'acc-s1' });
        assertEqual(out.res.statusCode, 200);
        assertEqual(typeof out.body.item.cliente_score, 'number');
        assertEqual(out.body.score.classificacao, out.body.item.cliente_classificacao);
        assertEqual(out.body.item.cliente_score_fatores.total_pedidos, 1);
      }
    },
    {
      name: 'endpoint de score usa query simples em pedidos com colunas reais',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Query' }, { accountId: 'acc-q1' });
        const mock = createSupabasePedidosMock({
          rows: [
            { id: 'p-1', account_id: 'acc-q1', cliente_id: cliente.id, status: 'faturado_total', total: 1200, data_emissao: '2026-06-10', data_faturamento: null, metadata: {}, created_at: '2026-06-10T10:00:00.000Z' },
            { id: 'p-2', account_id: 'acc-q1', cliente_id: cliente.id, status: 'CANCÉLADO', total: 999, data_emissao: '2026-06-11', data_faturamento: null, metadata: {}, created_at: '2026-06-11T10:00:00.000Z' }
          ]
        });
        __setClientesSupabaseClientForTests(mock, true);
        try {
          const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-score`, role: 'admin', accountId: 'acc-q1' });
          assertEqual(out.res.statusCode, 200);
          assertEqual(mock.query._select.includes('total'), true);
          assertEqual(mock.query._select.includes('data_emissao'), true);
          assertEqual(mock.query._select.includes('data_faturamento'), true);
          assertEqual(mock.query._filters.account_id, 'acc-q1');
          assertEqual(mock.query._filters.cliente_id, cliente.id);
          assertEqual(mock.query._limit, 250);
          assertEqual(mock.query._orders[0].field, 'data_faturamento');
          assertEqual(out.body.item.cliente_score_fatores.total_pedidos, 1);
          assertEqual(out.body.item.cliente_score_fatores.faturamento_total, 1200);
        } finally {
          __setClientesSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'endpoint de score cross-tenant retorna 404 controlado',
      run: async () => {
        __resetMemoryClientesForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Score' }, { accountId: 'acc-s2' });
        const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-score`, role: 'sales', accountId: 'acc-other', userId: 'sales-x' });
        assertEqual(out.res.statusCode, 404);
        assertEqual(out.body.error.code, 'CLIENTE_NOT_FOUND');
      }
    }
  ];
}
