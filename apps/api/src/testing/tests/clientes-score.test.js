import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, __setClientesSupabaseClientForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __loadMemoryPedidos, __resetMemoryPedidosForTests } from '../../modules/pedidos/pedidos.repository.js';
import { __resetClientesAlertsForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetClientesTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { calcularScoreCliente } from '../../modules/clientes/clientes.score.service.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function createSupabaseClientesPedidosMock({ clientes = [], pedidos = [], onPedidosSelect = null } = {}) {
  const state = {
    clientes: clientes.map((row) => ({ ...row })),
    pedidos: pedidos.map((row) => ({ ...row })),
    queries: { clientes: null, pedidos: null }
  };

  function createQuery(table) {
    const query = {
      _filters: {},
      _select: null,
      _orders: [],
      _limit: null,
      select(fields) {
        this._select = fields;
        state.queries[table] = this;
        if (table === 'pedidos' && onPedidosSelect) onPedidosSelect(fields, this);
        return this;
      },
      eq(key, value) { this._filters[key] = value; state.queries[table] = this; return this; },
      in(key, values) { this._in = { key, values }; state.queries[table] = this; return this; },
      order(field, options) { this._orders.push({ field, options }); return this; },
      limit(value) { this._limit = value; return this; },
      update(payload) { this._update = payload; state.queries[table] = this; return this; },
      maybeSingle() {
        state.queries[table] = this;
        if (table === 'clientes') {
          const row = state.clientes.find((item) => String(item.account_id) === String(this._filters.account_id) && String(item.id) === String(this._filters.id)) || null;
          if (row && this._update) Object.assign(row, this._update);
          return Promise.resolve({ data: row, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        return this.maybeSingle();
      },
      then(resolve) {
        state.queries[table] = this;
        if (table === 'pedidos') {
          const rows = state.pedidos.filter((item) => String(item.account_id) === String(this._filters.account_id) && String(item.cliente_id) === String(this._filters.cliente_id));
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        if (table === 'clientes') {
          const rows = state.clientes.filter((item) => String(item.account_id) === String(this._filters.account_id));
          if (rows[0] && this._update) Object.assign(rows[0], this._update);
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        }
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }
    };
    return query;
  }

  return {
    state,
    from(table) {
      if (!['clientes', 'pedidos', 'pedido_itens'].includes(table)) throw new Error(`Tabela inesperada: ${table}`);
      return createQuery(table);
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
        assertEqual(result.fatores.total_pedidos, 1);
        assertEqual(result.fatores.faturamento_total, 1000);
        assertEqual(result.fatores.produtos_distintos, 1);
        assertEqual(result.score > 0, true);
      }
    },
    {
      name: 'endpoint de score ignora pedidos cancelados e retorna cliente atualizado',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetClientesAlertsForTests();
        __resetClientesTimelineForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Score' }, { accountId: 'acc-s1' });
        __loadMemoryPedidos({
          pedidos: [
            { id: 'p-cancel', account_id: 'acc-s1', cliente_id: cliente.id, status: 'cancelado', total: 500, data_faturamento: '2026-06-10T00:00:00.000Z', created_at: '2026-06-10T00:00:00.000Z' },
            { id: 'p-fat', account_id: 'acc-s1', cliente_id: cliente.id, status: 'faturado', total: 500, data_faturamento: '2026-06-11T00:00:00.000Z', created_at: '2026-06-11T00:00:00.000Z' }
          ]
        });
        const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-score`, role: 'admin', accountId: 'acc-s1' });
        assertEqual(out.res.statusCode, 200);
        assertEqual(typeof out.body.cliente.cliente_score, 'number');
        assertEqual(out.body.score.classificacao, out.body.cliente.cliente_classificacao);
        assertEqual(out.body.cliente.cliente_score_fatores.total_pedidos, 1);
      }
    },
    {
      name: 'endpoint de score usa query simples em pedidos com colunas reais',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetClientesAlertsForTests();
        __resetClientesTimelineForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Query' }, { accountId: 'acc-q1' });
        const mock = createSupabaseClientesPedidosMock({
          clientes: [{ id: cliente.id, account_id: 'acc-q1', nome: 'Cliente Query' }],
          pedidos: [
            { id: 'p-1', account_id: 'acc-q1', cliente_id: cliente.id, status: 'faturado_total', total: 1200, data_emissao: '2026-06-10', data_faturamento: null, metadata: {}, created_at: '2026-06-10T10:00:00.000Z' },
            { id: 'p-2', account_id: 'acc-q1', cliente_id: cliente.id, status: 'CANCÉLADO', total: 999, data_emissao: '2026-06-11', data_faturamento: null, metadata: {}, created_at: '2026-06-11T10:00:00.000Z' }
          ]
        });
        __setClientesSupabaseClientForTests(mock, true);
        try {
          const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-score`, role: 'admin', accountId: 'acc-q1' });
          assertEqual(out.res.statusCode, 200);
          const pedidosQuery = mock.state.queries.pedidos;
          assertEqual(Boolean(pedidosQuery), true);
          assertEqual(String(pedidosQuery._select).includes('total'), true);
          assertEqual(String(pedidosQuery._select).includes('data_emissao'), true);
          assertEqual(String(pedidosQuery._select).includes('data_faturamento'), true);
          assertEqual(pedidosQuery._filters.account_id, 'acc-q1');
          assertEqual(pedidosQuery._filters.cliente_id, cliente.id);
          assertEqual(pedidosQuery._limit, 250);
          assertEqual(pedidosQuery._orders[0].field, 'data_faturamento');
          assertEqual(out.body.cliente.cliente_score_fatores.total_pedidos, 1);
          assertEqual(out.body.cliente.cliente_score_fatores.faturamento_total, 1200);
        } finally {
          __setClientesSupabaseClientForTests(null, false);
          __resetClientesAlertsForTests();
          __resetClientesTimelineForTests();
        }
      }
    },
    {
      name: 'endpoint de score cross-tenant retorna 404 controlado',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetClientesAlertsForTests();
        __resetClientesTimelineForTests();
        __setClientesSupabaseClientForTests(null, false);
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Score' }, { accountId: 'acc-s2' });
        const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-score`, role: 'sales', accountId: 'acc-other', userId: 'sales-x' });
        assertEqual(out.res.statusCode, 404);
        assertEqual(out.body.error.code, 'CLIENTE_NOT_FOUND');
      }
    }
  ];
}
