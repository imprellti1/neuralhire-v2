import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __setClientesRadarSupabaseClientForTests } from '../../modules/clientes/clientes.radar.service.js';
import { __setClientesSupabaseClientForTests } from '../../modules/clientes/clientes.repository.js';
import { __setClientesAlertsSupabaseClientForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __setClientesSegmentacaoSupabaseClientForTests } from '../../modules/clientes/clientes.segmentacao.service.js';
import { __setPedidosSupabaseClientForTests } from '../../modules/pedidos/pedidos.repository.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

function createRadarSupabaseMock({ clientes = [], pedidos = [], alertas = [], failClienteId = null } = {}) {
  const state = { clientes, pedidos, alertas, failClienteId, lastQueries: {} };
  const query = (table) => ({
    _table: table,
    _filters: {},
    _select: null,
    _in: null,
    select(fields) { this._select = fields; return this; },
    eq(key, value) { this._filters[key] = value; return this; },
    neq(key, value) { this._filters[`neq:${key}`] = value; return this; },
    in(key, values) { this._in = { key, values }; return this; },
    or() { return this; },
    maybeSingle() {
      const result = this._resolve();
      return Promise.resolve(result);
    },
    single() {
      const result = this._resolve();
      return Promise.resolve(result);
    },
    _resolve() {
      const ids = Array.isArray(this._in?.values) ? this._in.values.map(String) : [];
      state.lastQueries[table] = { filters: { ...this._filters }, in: this._in ? { ...this._in, values: [...(this._in.values || [])] } : null, select: this._select };
      if (state.failClienteId && ids.includes(String(state.failClienteId))) return { data: null, error: new Error(`fail:${state.failClienteId}`) };
      if (table === 'clientes') {
        const rows = state.clientes.filter((item) => String(item.account_id) === String(this._filters.account_id) && (!this._filters.id || String(item.id) === String(this._filters.id)) && item.ativo !== false);
        return { data: rows[0] || null, error: null };
      }
      if (table === 'pedidos') return { data: state.pedidos.filter((item) => String(item.account_id) === String(this._filters.account_id)), error: null };
      if (table === 'cliente_alertas') return { data: state.alertas.filter((item) => String(item.account_id) === String(this._filters.account_id)), error: null };
      if (table === 'pedido_itens') return { data: [], error: null };
      return { data: [], error: null };
    },
    then(resolve) {
      return Promise.resolve(this._resolve()).then(resolve);
    }
  });
  return { from: (table) => query(table), __state: state };
}

export function getClientesRadarTests() {
  return [
    {
      name: 'endpoint agrupa e ordena clientes do radar',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        __loadMemoryClientes([
          { id: 'c-vip', account_id: 'acc-radar', nome: 'VIP', cidade: 'SP', estado: 'SP', cliente_score: 92, cliente_classificacao: 'A', segmento_comercial: 'VIP' },
          { id: 'c-pot', account_id: 'acc-radar', nome: 'Potencial', cidade: 'SP', estado: 'SP', cliente_score: 88, cliente_classificacao: 'B', segmento_comercial: 'POTENCIAL' },
          { id: 'c-ris', account_id: 'acc-radar', nome: 'Risco', cidade: 'RJ', estado: 'RJ', cliente_score: 40, cliente_classificacao: 'D', segmento_comercial: 'EM_RISCO', ultima_compra_em: '2026-01-01T00:00:00.000Z' },
          { id: 'c-inat', account_id: 'acc-radar', nome: 'Inativo', cidade: 'MG', estado: 'MG', cliente_score: 20, cliente_classificacao: 'D', segmento_comercial: 'INATIVO', ultima_compra_em: '2025-01-01T00:00:00.000Z' }
        ]);
        const app = createApiApp();
        const out = await call(app, { method: 'GET', url: '/clientes/radar', role: 'admin', accountId: 'acc-radar' });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.grupos.vip[0].nome, 'VIP');
        assertEqual(out.body.grupos.potenciais[0].nome, 'Potencial');
        assertEqual(out.body.resumo.total_clientes, 4);
        assertEqual(Array.isArray(out.body.grupos.risco), true);
      }
    },
    {
      name: 'GET /clientes/radar nao cai em getClienteById',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        __loadMemoryClientes([
          { id: 'radar', account_id: 'acc-radar', nome: 'Cliente Radar', cidade: 'SP', estado: 'SP', cliente_score: 55, cliente_classificacao: 'C', segmento_comercial: 'RECORRENTE' }
        ]);
        const app = createApiApp();
        const out = await call(app, { method: 'GET', url: '/clientes/radar', role: 'admin', accountId: 'acc-radar' });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.resumo.total_clientes, 1);
        assertEqual(out.body.grupos.recorrentes[0].id, 'radar');
        assertEqual(out.body.item === undefined, true);
      }
    },
    {
      name: 'endpoint respeita filtros e tenant',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        __loadMemoryClientes([
          { id: 'c-a', account_id: 'acc-a', nome: 'Cliente A', cidade: 'Curitiba', estado: 'PR', cliente_score: 70, segmento_comercial: 'RECORRENTE', vendedor_id: 'ven-1' },
          { id: 'c-b', account_id: 'acc-a', nome: 'Cliente B', cidade: 'Curitiba', estado: 'PR', cliente_score: 70, segmento_comercial: 'RECORRENTE', vendedor_id: 'ven-2' },
          { id: 'c-c', account_id: 'acc-b', nome: 'Cliente C', cidade: 'Curitiba', estado: 'PR', cliente_score: 70, segmento_comercial: 'RECORRENTE', vendedor_id: 'ven-1' }
        ]);
        const app = createApiApp();
        const out = await call(app, { method: 'GET', url: '/clientes/radar?vendedor_id=ven-1&cidade=Curitiba&estado=PR&segmento=RECORRENTE', role: 'admin', accountId: 'acc-a' });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.resumo.total_clientes, 1);
        assertEqual(out.body.grupos.recorrentes[0].id, 'c-a');
      }
    },
    {
      name: 'POST /clientes/radar/recalcular processa em lote e continua em falha',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const mock = createRadarSupabaseMock({
          clientes: [
            { id: 'c-1', account_id: 'acc-radar', nome: 'Cliente 1', ativo: true, segmento_comercial: 'VIP' },
            { id: 'c-2', account_id: 'acc-radar', nome: 'Cliente 2', ativo: true, segmento_comercial: 'RECORRENTE' },
            { id: 'c-3', account_id: 'acc-radar', nome: 'Cliente 3', ativo: true, segmento_comercial: 'POTENCIAL' }
          ],
          pedidos: [
            { id: 'p-1', account_id: 'acc-radar', cliente_id: 'c-1', status: 'faturado', total: 100, data_faturamento: '2026-06-01T00:00:00.000Z' },
            { id: 'p-2', account_id: 'acc-radar', cliente_id: 'c-2', status: 'faturado', total: 200, data_faturamento: '2026-06-02T00:00:00.000Z' }
          ],
          alertas: [],
          failClienteId: 'c-2'
        });
        __setClientesRadarSupabaseClientForTests(mock, true);
        __setClientesSupabaseClientForTests(mock, true);
        __setClientesAlertsSupabaseClientForTests(mock, true);
        __setClientesSegmentacaoSupabaseClientForTests(mock, true);
        __setPedidosSupabaseClientForTests(mock, true);
        try {
          const app = createApiApp();
          const out = await call(app, { method: 'POST', url: '/clientes/radar/recalcular', role: 'admin', accountId: 'acc-radar' });
          assertEqual(out.res.statusCode, 200);
          assertEqual(out.body.total_clientes, 3);
          assertEqual(out.body.processados, 3);
          assertEqual(out.body.sucessos >= 2, true);
          assertEqual(out.body.falhas >= 1, true);
          assertEqual(Array.isArray(out.body.detalhes_falhas), true);
          assertEqual(out.body.detalhes_falhas.some((item) => item.cliente_id === 'c-2'), true);
          assertEqual(mock.__state.lastQueries.clientes.filters.account_id, 'acc-radar');
          assertEqual(mock.__state.lastQueries.pedidos.filters.account_id, 'acc-radar');
          assertEqual(mock.__state.lastQueries['cliente_alertas'].filters.account_id, 'acc-radar');
        } finally {
          __setClientesRadarSupabaseClientForTests(null, false);
          __setClientesSupabaseClientForTests(null, false);
          __setClientesAlertsSupabaseClientForTests(null, false);
          __setClientesSegmentacaoSupabaseClientForTests(null, false);
          __setPedidosSupabaseClientForTests(null, false);
        }
      }
    }
  ];
}
