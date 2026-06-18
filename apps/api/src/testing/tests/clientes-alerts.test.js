import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __dumpMemoryAlertas, __resetMemoryAlertasForTests, __setClientesAlertsSupabaseClientForTests, gerarAlertasCliente } from '../../modules/clientes/clientes.alerts.service.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests, __setClientesSupabaseClientForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
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

function daysAgo(days) {
  const date = new Date(Date.now() - days * 86400000);
  return date.toISOString();
}

async function createPedidoComProduto(accountId, clienteId, overrides = {}) {
  const produto = await createProduto({ nome: `Produto ${clienteId}`, preco: overrides.total || 1000 }, { accountId });
  return createPedido({
    cliente_id: clienteId,
    status: 'faturado',
    data_faturamento: daysAgo(overrides.daysAgo || 10),
    total: overrides.total || 1000,
    itens: [{ produto_id: produto.id, quantidade: 1, total: overrides.total || 1000 }],
    ...overrides
  }, { accountId });
}

async function seedClienteComScoreAlto(accountId, clienteId, { pedidos = 4, total = 20000 } = {}) {
  const totalPedido = total;
  for (let index = 0; index < pedidos; index += 1) {
    await createPedidoComProduto(accountId, clienteId, {
      daysAgo: 10 + index,
      total: totalPedido,
      data_faturamento: daysAgo(10 + index)
    });
  }
}

function loadClienteWithScore(cliente, extra = {}) {
  __loadMemoryClientes([{
    ...cliente,
    ...extra
  }]);
}

function createSupabaseMock({ clientes = [], pedidos = [], alertas = [] } = {}) {
  const state = {
    clientes: clientes.map((row) => ({ ...row })),
    pedidos: pedidos.map((row) => ({ ...row })),
    alertas: alertas.map((row) => ({ ...row })),
    capturedSelects: []
  };

  function tableResponse(table) {
    const query = {
      _select: null,
      _filters: {},
      _order: [],
      _limit: null,
      _range: null,
      _insert: null,
      select(fields) { this._select = fields; state.capturedSelects.push({ table, fields }); return this; },
      eq(key, value) { this._filters[key] = value; return this; },
      order(field, options) { this._order.push({ field, options }); return this; },
      limit(value) { this._limit = value; return this; },
      insert(payload) { this._insert = payload; return this; },
      update(payload) { this._update = payload; return this; },
      maybeSingle() { return Promise.resolve(this._singleResult()); },
      single() { return Promise.resolve(this._singleResult()); },
      then(resolve) { return Promise.resolve(this._result()).then(resolve); },
      _result() {
        if (table === 'clientes') {
          const rows = state.clientes.filter((row) => (!this._filters.account_id || row.account_id === this._filters.account_id) && (!this._filters.id || row.id === this._filters.id));
          return { data: rows, error: null, count: rows.length };
        }
        if (table === 'pedidos') {
          const rows = state.pedidos.filter((row) => (!this._filters.account_id || row.account_id === this._filters.account_id) && (!this._filters.cliente_id || row.cliente_id === this._filters.cliente_id));
          return { data: rows, error: null };
        }
        if (table === 'cliente_alertas') {
          const rows = state.alertas.filter((row) => (!this._filters.account_id || row.account_id === this._filters.account_id) && (!this._filters.cliente_id || row.cliente_id === this._filters.cliente_id));
          return { data: rows, error: null };
        }
        return { data: [], error: null };
      },
      _singleResult() {
        if (table === 'clientes') {
          const row = state.clientes.find((item) => item.id === this._filters.id && item.account_id === this._filters.account_id) || null;
          return { data: row, error: null };
        }
        if (table === 'cliente_alertas') {
          if (this._insert) {
            const row = { id: `alert-${state.alertas.length + 1}`, created_at: new Date().toISOString(), ...this._insert };
            state.alertas.push(row);
            return { data: row, error: null };
          }
          const row = state.alertas.find((item) => item.id === this._filters.id && item.account_id === this._filters.account_id) || null;
          if (this._update && row) Object.assign(row, this._update);
          return { data: row, error: null };
        }
        return { data: null, error: null };
      }
    };
    return query;
  }

  return {
    state,
    from(table) {
      return tableResponse(table);
    }
  };
}

export function getClientesAlertsTests() {
  return [
    {
      name: 'cliente A com dias_sem_compra > 60 gera alerta alta',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente A', cliente_score_fatores: { ultima_compra: daysAgo(61), total_pedidos: 6, faturamento_total: 1000 }, cliente_potencial: 'Médio' }, { accountId: 'acc-alert-a' });
        loadClienteWithScore(cliente, { cliente_score_fatores: { ultima_compra: daysAgo(61), total_pedidos: 6, faturamento_total: 1000 }, cliente_potencial: 'Médio' });
        await createPedidoComProduto('acc-alert-a', cliente.id, { daysAgo: 61, total: 1000 });
        const result = await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-a', context: { auth: { role: 'admin' } } });
        assertEqual(result.alertas.some((a) => a.severidade === 'alta' && /60 dias/.test(a.titulo)), true);
      }
    },
    {
      name: 'cliente B com dias_sem_compra > 90 gera alerta media',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente B', cliente_score_fatores: { ultima_compra: daysAgo(91), total_pedidos: 6, faturamento_total: 1000 }, cliente_potencial: 'Médio' }, { accountId: 'acc-alert-b' });
        loadClienteWithScore(cliente, { cliente_score_fatores: { ultima_compra: daysAgo(91), total_pedidos: 6, faturamento_total: 1000 }, cliente_potencial: 'Médio' });
        await createPedidoComProduto('acc-alert-b', cliente.id, { daysAgo: 91, total: 1000 });
        const result = await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-b', context: { auth: { role: 'admin' } } });
        assertEqual(result.alertas.some((a) => a.severidade === 'media' && /90 dias/.test(a.titulo)), true);
      }
    },
    {
      name: 'queda de faturamento usa pedidos reais dos ultimos 90 dias vs 90 dias anteriores',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente Receita', cliente_potencial: 'Médio' }, { accountId: 'acc-alert-c' });
        await createPedidoComProduto('acc-alert-c', cliente.id, { daysAgo: 120, total: 1000 });
        await createPedidoComProduto('acc-alert-c', cliente.id, { daysAgo: 110, total: 1000 });
        await createPedidoComProduto('acc-alert-c', cliente.id, { daysAgo: 30, total: 500 });
        const result = await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-c', context: { auth: { role: 'admin' } } });
        assertEqual(result.alertas.some((a) => a.tipo === 'queda_faturamento' && a.severidade === 'alta'), true);
      }
    },
    {
      name: 'potencial Alto com total_pedidos menor que 5 gera alerta media',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente Potencial', cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4, ultima_compra: daysAgo(10), faturamento_total: 2000 } }, { accountId: 'acc-alert-d' });
        loadClienteWithScore(cliente, { cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4, ultima_compra: daysAgo(10), faturamento_total: 2000 } });
        await seedClienteComScoreAlto('acc-alert-d', cliente.id, { pedidos: 4, total: 20000 });
        const result = await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-d', context: { auth: { role: 'admin' } } });
        assertEqual(result.alertas.some((a) => a.tipo === 'potencial_alto_baixa_base' && a.severidade === 'media'), true);
      }
    },
    {
      name: 'gerar duas vezes nao duplica alerta ativo',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente Dedupe', cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4, ultima_compra: daysAgo(10), faturamento_total: 2000 } }, { accountId: 'acc-alert-e' });
        loadClienteWithScore(cliente, { cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4, ultima_compra: daysAgo(10), faturamento_total: 2000 } });
        await seedClienteComScoreAlto('acc-alert-e', cliente.id, { pedidos: 4, total: 20000 });
        await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-e', context: { auth: { role: 'admin' } } });
        await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-e', context: { auth: { role: 'admin' } } });
        assertEqual(__dumpMemoryAlertas().filter((item) => item.status === 'ativo').length, 1);
      }
    },
    {
      name: 'resolve alerta valida account_id',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Resolve', cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4, ultima_compra: daysAgo(10), faturamento_total: 2000 } }, { accountId: 'acc-alert-f' });
        loadClienteWithScore(cliente, { cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4, ultima_compra: daysAgo(10), faturamento_total: 2000 } });
        await seedClienteComScoreAlto('acc-alert-f', cliente.id, { pedidos: 4, total: 20000 });
        await call(app, { method: 'POST', url: `/clientes/${cliente.id}/gerar-alertas`, role: 'admin', accountId: 'acc-alert-f' });
        const lista = await call(app, { method: 'GET', url: `/clientes/${cliente.id}/alertas`, role: 'admin', accountId: 'acc-alert-f' });
        const alertaId = lista.body.items[0].id;
        const ok = await call(app, { method: 'PATCH', url: `/clientes/alertas/${alertaId}/resolver`, role: 'admin', accountId: 'acc-alert-f', body: { status: 'resolvido' } });
        assertEqual(ok.res.statusCode, 200);
        assertEqual(ok.body.item.status, 'resolvido');
        const blocked = await call(app, { method: 'PATCH', url: `/clientes/alertas/${alertaId}/resolver`, role: 'admin', accountId: 'acc-other', body: { status: 'resolvido' } });
        assertEqual(blocked.res.statusCode, 404);
      }
    },
    {
      name: 'pedidos cancelados rejeitados e estornados sao ignorados',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente Status', cliente_potencial: 'Alto' }, { accountId: 'acc-alert-g' });
        await createPedidoComProduto('acc-alert-g', cliente.id, { daysAgo: 10, total: 1000, status: 'cancelado' });
        await createPedidoComProduto('acc-alert-g', cliente.id, { daysAgo: 20, total: 1000, status: 'REJEITADO' });
        await createPedidoComProduto('acc-alert-g', cliente.id, { daysAgo: 30, total: 1000, status: 'estornado' });
        const result = await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-g', context: { auth: { role: 'admin' } } });
        assertEqual(result.alertas.some((a) => a.tipo === 'queda_faturamento'), false);
      }
    },
    {
      name: 'sem pedidos nao quebra',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = await createCliente({ nome: 'Cliente Sem Pedidos', cliente_potencial: 'Médio' }, { accountId: 'acc-alert-h' });
        const result = await gerarAlertasCliente(cliente.id, { accountId: 'acc-alert-h', context: { auth: { role: 'admin' } } });
        assertEqual(Array.isArray(result.alertas), true);
      }
    },
    {
      name: 'mock supabase usa colunas reais de pedidos e cliente_alertas',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const cliente = { id: 'c-supa', account_id: 'acc-supa', nome: 'Cliente Supa', cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 2, faturamento_total: 500, ultima_compra: daysAgo(70) } };
        const mock = createSupabaseMock({
          clientes: [cliente],
          pedidos: [
            { id: 'p-1', account_id: 'acc-supa', cliente_id: 'c-supa', status: 'faturado', total: 1000, data_emissao: daysAgo(120), data_faturamento: null, metadata: {}, created_at: daysAgo(120) },
            { id: 'p-2', account_id: 'acc-supa', cliente_id: 'c-supa', status: 'faturado', total: 400, data_emissao: daysAgo(20), data_faturamento: null, metadata: {}, created_at: daysAgo(20) }
          ],
          alertas: []
        });
        __setClientesSupabaseClientForTests(mock, true);
        __setClientesAlertsSupabaseClientForTests(mock, true);
        try {
          const result = await gerarAlertasCliente('c-supa', { accountId: 'acc-supa', context: { auth: { role: 'admin' } } });
          assertEqual(result.alertas.length >= 1, true);
          assertEqual(mock.state.capturedSelects.some((entry) => entry.table === 'pedidos' && String(entry.fields || '').includes('id, account_id, cliente_id, status, total, data_emissao, data_faturamento, metadata, created_at')), true);
          assertEqual(mock.state.capturedSelects.some((entry) => entry.table === 'cliente_alertas'), true);
        } finally {
          __setClientesSupabaseClientForTests(null, false);
          __setClientesAlertsSupabaseClientForTests(null, false);
        }
      }
    }
  ];
}
