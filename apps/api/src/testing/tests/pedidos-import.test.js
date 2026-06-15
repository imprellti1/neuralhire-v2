import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createCliente, __resetMemoryClientesForTests, __dumpMemoryClientes, __setClientesSupabaseClientForTests } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, __dumpMemoryPedidos } from '../../modules/pedidos/pedidos.repository.js';
import { __resetPedidosImportSessionsForTests } from '../../modules/pedidos-import/pedidos-import.repository.js';

function parseBody(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  return app(req, res).then(() => ({ res, body: parseBody(res) }));
}
function makeWorkbook(rows) {
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Pedidos');
  return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
}

function createSupabaseMock({ clientes = [], pedidos = [], failPedidosQuery = false } = {}) {
  const state = { clientes: clientes.map((item) => ({ ...item })), pedidos: pedidos.map((item) => ({ ...item })) };
  const matches = (row, filter = {}) => Object.entries(filter).every(([key, value]) => {
    if (value === undefined) return true;
    if (Array.isArray(value)) return value.map(String).includes(String(row[key]));
    return String(row[key]) === String(value);
  });
  const buildQuery = (table) => {
    const q = {
      _filter: {},
      _table: table,
      select() { return this; },
      eq(key, value) { this._filter[key] = value; return this; },
      order() { return this; },
      limit() { return this; },
      range() { return this; },
      not(key, op, value) { this._not = { key, op, value }; return this; },
      in(key, values) { this._filter[key] = values; return this; },
      then(resolve) {
        if (table === 'pedidos' && failPedidosQuery) {
          return Promise.resolve({ data: null, error: { message: 'boom pedidos query' } }).then(resolve);
        }
        const rows = state[table].filter((row) => matches(row, this._filter));
        return Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve);
      },
      single() {
        const rows = state[table].filter((row) => matches(row, this._filter));
        return Promise.resolve({ data: rows[0] || null, error: null });
      },
      maybeSingle() { return this.single(); },
      update(payload) {
        return {
          eq() { return this; },
          select() {
            return {
              single() {
                const idx = state[table].findIndex((row) => matches(row, q._filter));
                if (idx >= 0) state[table][idx] = { ...state[table][idx], ...payload };
                return Promise.resolve({ data: state[table][idx] || null, error: null });
              }
            };
          }
        };
      },
      insert(payload) {
        const rows = Array.isArray(payload) ? payload : [payload];
        state[table].push(...rows.map((row) => ({ ...row })));
        return {
          select() {
            return {
              single() { return Promise.resolve({ data: rows[0] || null, error: null }); }
            };
          }
        };
      }
    };
    return q;
  };
  return { state, from: (table) => buildQuery(table) };
}

export function getPedidosImportTests() {
  return [
    {
      name: 'vincula pedido por codigo de cliente e ignora Razao Social',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import' });
        const base64 = makeWorkbook([
          { Cliente: 'CLI-001', 'Razão Social': 'Nao usar', 'Número ERP': 'PED-001', Situação: 'Faturado Total', Observacoes: 'ok', 'Lote Gravação': 'L1', 'Data Prev.Fatur.': '2026-01-01', 'Qt. Peças': '99', 'Valor Total': 'R$2.237,28', 'Valor do pedido': '9999', 'Valor cancelado': '123', Origem: 'ERP', Duplicar: 'N', Imprimir: 'S' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.res.statusCode, 200);
        assert.equal(preview.body.rows[0].pedido, 'PED-001');
        assert.equal(preview.body.rows[0].data_emissao_preview, null);
        assert.equal(preview.body.rows[0].cliente, 'CLI-001');
        assert.equal(preview.body.rows[0].clienteId, cliente.id);
        assert.equal(preview.body.rows[0].status, 'faturado_total');
        assert.equal(preview.body.rows[0].metadata.situacao_original, 'Faturado Total');
        assert.equal(preview.body.rows[0].statusImportacao, 'ok');
        assert.equal(preview.body.rows[0].total, 2237.28);
        assert.equal(preview.body.rows[0].ignored['Razão Social'], 'Nao usar');
        assert.equal(preview.body.summary.pedidos_sem_cliente, 0);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import', body: { importToken: preview.body.importToken } });
        assert.equal(execute.res.statusCode, 200);
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(execute.body.summary.pedidos_sem_cliente, 0);
        assert.equal(__dumpMemoryPedidos().pedidos.length, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].cliente_id, cliente.id);
        assert.equal(__dumpMemoryPedidos().pedidos[0].numero, 'PED-001');
        assert.equal(__dumpMemoryPedidos().pedidos[0].status, 'faturado_total');
        assert.equal(__dumpMemoryPedidos().pedidos[0].total, 2237.28);
        assert.equal(__dumpMemoryPedidos().pedidos[0].metadata.situacao_original, 'Faturado Total');
        assert.equal(__dumpMemoryClientes().length > 0, true);
      }
    },
    {
      name: 'lê cabeçalhos acentuados reais e mantém status e metadata',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente B', codigo: 'CLI-010' }, { accountId: 'acc-pedidos-import-real' });
        const base64 = makeWorkbook([
          {
            Cliente: 'CLI-010',
            'Número ERP': 'PED-010',
            Situação: 'Faturado Total',
            Observações: 'pedido com acento',
            'Lote Gravação': 'LG-1',
            'Qt. Peças': '42',
            'Valor Cancelado': '0',
            'Razão Social': 'Cliente que deve ser ignorado'
          }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-real', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.res.statusCode, 200);
        assert.equal(preview.body.rows[0].clienteId, cliente.id);
        assert.equal(preview.body.rows[0].pedido, 'PED-010');
        assert.equal(preview.body.rows[0].data_emissao_preview, null);
        assert.equal(preview.body.rows[0].status, 'faturado_total');
        assert.equal(preview.body.rows[0].metadata.situacao_original, 'Faturado Total');
        assert.equal(preview.body.rows[0].metadata.lote_gravacao, 'LG-1');
        assert.equal(preview.body.rows[0].metadata.qt_pecas, '42');
        assert.equal(preview.body.rows[0].metadata.valor_total_original, 'R$2.237,28');
        assert.equal(preview.body.rows[0].observacoes, 'pedido com acento');
        assert.equal(preview.body.rows[0].ignored['Razão Social'], 'Cliente que deve ser ignorado');
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-real', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(execute.body.pedidos_criados[0].status, 'faturado_total');
      }
    },
    {
      name: 'situação vazia cai para rascunho e preserva original nulo',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import-status' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-001', 'Número ERP': 'PED-001', Situação: '', Status: '', Observacoes: 'ok', 'Valor Total': '10,50' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-status', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].status, 'rascunho');
        assert.equal(preview.body.rows[0].metadata.situacao_original, null);
        assert.equal(preview.body.rows[0].data_emissao_preview, null);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-status', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].status, 'rascunho');
        assert.equal(__dumpMemoryPedidos().pedidos[0].total, 10.5);
      }
    },
    {
      name: 'cliente inexistente gera inconsistência e não cria pedido',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([{ Cliente: 'CLI-404', 'Número ERP': 'PED-404', Situação: 'Rejeitado', 'Valor Total': '10' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-2', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.summary.pedidos_sem_cliente, 1);
        assert.equal(preview.body.rows[0].statusImportacao, 'CLIENTE_NAO_ENCONTRADO');
        assert.equal(preview.body.summary.inconsistencias[0].pedido, 'PED-404');
        assert.equal(preview.body.summary.inconsistencias[0].cliente, 'CLI-404');
        assert.match(preview.body.summary.inconsistencias[0].motivo, /Cliente com código CLI-404 não encontrado no cadastro/);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-2', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 0);
        assert.equal(execute.body.summary.pedidos_sem_cliente, 1);
        assert.equal(execute.body.inconsistencias[0].codigo, 'CLIENTE_NAO_ENCONTRADO');
        assert.equal(execute.body.inconsistencias[0].pedido, 'PED-404');
        assert.equal(execute.body.inconsistencias[0].cliente, 'CLI-404');
        assert.equal(__dumpMemoryPedidos().pedidos.length, 0);
      }
    },
    {
      name: 'resumo final da importacao contabiliza criados e sem cliente',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import-3' });
        const base64 = makeWorkbook([
          { Cliente: 'CLI-001', 'Número ERP': 'PED-001', Situação: 'Cancelado', 'Lote Gravação': 'x', 'Valor Total': '50', 'Data Prev.Fatur.': '07/01/2026' },
          { Cliente: 'CLI-002', 'Número ERP': 'PED-002', Situação: 'Faturado Parcial', 'Origem': 'erp', 'Valor Total': '100', 'Data Prev.Fatur.': '2026-01-08' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-3', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.summary.pedidos_sem_cliente, 1);
        assert.equal(preview.body.rows[0].status, 'cancelado');
        assert.equal(preview.body.rows[1].status, 'faturado_parcial');
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-3', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(execute.body.summary.pedidos_sem_cliente, 1);
        assert.equal(execute.body.summary.pedidos_ignorados, 0);
        assert.equal(execute.body.summary.pedidos_duplicados, 0);
        assert.equal(execute.body.summary.pedidos_com_erro, 0);
      }
    },
    {
      name: 'prevenção de pedido sem cliente',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([{ Cliente: 'SEM-CLIENTE', 'Número ERP': 'PED-SEM', Situação: 'Estornado', 'Valor Total': '11' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-4', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-4', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.pedidos_criados.length, 0);
        assert.equal(execute.body.pedidos_sem_cliente.length, 1);
        assert.equal(__dumpMemoryPedidos().pedidos.length, 0);
      }
    },
    {
      name: 'importacao conclui mesmo se recálculo comercial falhar para um cliente',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const mock = createSupabaseMock({
          clientes: [{ id: 'c1', account_id: 'acc-pedidos-import-recalc', nome: 'Cliente A', codigo: 'CLI-001' }],
          failPedidosQuery: true
        });
        __setClientesSupabaseClientForTests(mock, true);
        try {
          const base64 = makeWorkbook([{ Cliente: 'CLI-001', 'Número ERP': 'PED-REC', Situação: 'Faturado Total' }]);
          const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-recalc', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
          assert.equal(preview.res.statusCode, 200);
          const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-recalc', body: { importToken: preview.body.importToken } });
          assert.equal(execute.res.statusCode, 200);
          assert.equal(execute.body.summary.pedidos_criados, 1);
          assert.equal(execute.body.inconsistencias.some((item) => item.codigo === 'HISTORICO_COMERCIAL_NAO_RECALCULADO'), true);
        } finally {
          __setClientesSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'atualiza total de pedido existente no tenant por account_id e numero',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import-5' });
        await createCliente({ nome: 'Cliente B', codigo: 'CLI-002' }, { accountId: 'acc-pedidos-import-outra' });
        await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: cliente.id, numero: '44541', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-pedidos-import-5' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-001', 'Número ERP': '44541', Situação: 'Estornado', 'Valor Total': 'R$2.237,28' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-5', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].total, 2237.28);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-5', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 0);
        assert.equal(execute.body.summary.pedidos_atualizados, 1);
        assert.equal(execute.body.summary.pedidos_duplicados, 0);
        assert.equal(__dumpMemoryPedidos().pedidos[0].numero, '44541');
        assert.equal(__dumpMemoryPedidos().pedidos[0].total, 2237.28);
        assert.equal(__dumpMemoryPedidos().pedidos.length, 1);
      }
    },
    {
      name: 'permite mesmo numero em outro account_id',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const clienteTenantA = await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import-6' });
        await createCliente({ nome: 'Cliente B', codigo: 'CLI-002' }, { accountId: 'acc-pedidos-import-7' });
        await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: clienteTenantA.id, numero: 'PED-MESMO', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-pedidos-import-6' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-002', 'Número ERP': 'PED-MESMO', Situação: 'Faturado Total', 'Valor Total': '20' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-7', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-7', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(execute.body.summary.pedidos_duplicados, 0);
        assert.equal(__dumpMemoryPedidos().pedidos.filter((p) => p.numero === 'PED-MESMO').length, 2);
      }
    },
    {
      name: 'mantem duplicidade interna da propria importacao',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import-8' });
        const base64 = makeWorkbook([
          { Cliente: 'CLI-001', 'Número ERP': 'PED-DUP', Situação: 'Faturado Total', 'Valor Total': '20' },
          { Cliente: 'CLI-001', 'Número ERP': 'PED-DUP', Situação: 'Faturado Total', 'Valor Total': '20' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-8', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-8', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(execute.body.summary.pedidos_duplicados, 1);
        assert.equal(execute.body.inconsistencias.some((item) => item.codigo === 'PEDIDO_DUPLICADO_EXISTENTE'), true);
        assert.equal(__dumpMemoryPedidos().pedidos.filter((p) => p.numero === 'PED-DUP').length, 1);
      }
    },
    {
      name: 'preserva codigo com zero a esquerda e ignora metadata no vinculo',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Z', codigo: '00123', metadata: { codigo: '99999' } }, { accountId: 'acc-pedidos-import-9' });
        const base64 = makeWorkbook([{ Cliente: '00123', 'Número ERP': 'PED-ZERO', Situação: 'Faturado Total', 'Razão Social': 'ignorar', 'Valor Total': '1.234,56', 'Data Prev.Fatur.': '07/01/2026', 'Valor do pedido': '999', 'Valor cancelado': '444' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-9', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].clienteId, cliente.id);
        assert.equal(preview.body.rows[0].cliente, '00123');
        assert.equal(preview.body.rows[0].pedido, 'PED-ZERO');
        assert.equal(preview.body.rows[0].data_emissao_preview, null);
        assert.equal(preview.body.rows[0].status, 'faturado_total');
        assert.equal(preview.body.rows[0].total, 1234.56);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-9', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].numero, 'PED-ZERO');
        assert.equal(__dumpMemoryPedidos().pedidos[0].status, 'faturado_total');
        assert.equal(__dumpMemoryPedidos().pedidos[0].total, 1234.56);
        assert.equal(__dumpMemoryPedidos().pedidos[0].data_faturamento, null);
      }
    },
    {
      name: 'importacao mapeia Data Emissao e aceita data Excel',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente Data', codigo: 'CLI-DATA' }, { accountId: 'acc-pedidos-import-data' });
        const workbook = xlsx.utils.book_new();
        const sheet = xlsx.utils.aoa_to_sheet([
          ['Cliente', 'Número ERP', 'Situação', 'Data Emissão', 'Valor Total'],
          ['CLI-DATA', 'PED-DATA', 'Faturado Total', 45366, '12,34']
        ]);
        xlsx.utils.book_append_sheet(workbook, sheet, 'Pedidos');
        const base64 = xlsx.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-data', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].dataEmissao, '2024-04-01');
        assert.equal(preview.body.rows[0].data_emissao_preview, '2024-04-01');
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-data', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.pedidos_criados[0].data_emissao, '2024-04-01');
        assert.equal(__dumpMemoryPedidos().pedidos[0].data_emissao, '2024-04-01');
      }
    },
    {
      name: 'importacao interpreta datas BR textuais sem inverter dia e mes',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente BR', codigo: 'CLI-BR' }, { accountId: 'acc-pedidos-import-br' });
        const base64 = makeWorkbook([
          { Cliente: 'CLI-BR', 'Número ERP': 'PED-BR-1', Situação: 'Faturado Total', 'Data Emissão': '11/06/2024', 'Valor Total': '10' },
          { Cliente: 'CLI-BR', 'Número ERP': 'PED-BR-2', Situação: 'Faturado Total', 'Data Emissão': '05/11/2024', 'Valor Total': '10' },
          { Cliente: 'CLI-BR', 'Número ERP': 'PED-BR-3', Situação: 'Faturado Total', 'Data Emissão': '11-06-2024', 'Valor Total': '10' },
          { Cliente: 'CLI-BR', 'Número ERP': 'PED-BR-4', Situação: 'Faturado Total', 'Data Emissão': '2024-06-11', 'Valor Total': '10' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-br', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].data_emissao_preview, '2024-06-11');
        assert.equal(preview.body.rows[1].data_emissao_preview, '2024-11-05');
        assert.equal(preview.body.rows[2].data_emissao_preview, '2024-06-11');
        assert.equal(preview.body.rows[3].data_emissao_preview, '2024-06-11');
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-br', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 4);
        assert.equal(__dumpMemoryPedidos().pedidos[0].data_emissao, '2024-06-11');
        assert.equal(__dumpMemoryPedidos().pedidos[1].data_emissao, '2024-11-05');
      }
    },
    {
      name: 'importacao conta data invalida em pedidos_data_emissao_invalidas',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente Inv', codigo: 'CLI-INV' }, { accountId: 'acc-pedidos-import-inv' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-INV', 'Número ERP': 'PED-INV', Situação: 'Faturado Total', 'Data Emissão': '31/02/2024', 'Valor Total': '10' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-inv', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].data_emissao_preview, null);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-inv', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_data_emissao_invalidas, 1);
        assert.equal(execute.body.pedidos_criados[0].data_emissao, null);
      }
    },
    {
      name: 'importacao sem Data Emissao persiste null',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente Sem Data', codigo: 'CLI-SD' }, { accountId: 'acc-pedidos-import-null' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-SD', 'Número ERP': 'PED-SD', Situação: 'Faturado Total', 'Valor Total': '10' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-null', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].dataEmissao, null);
        assert.equal(preview.body.rows[0].data_emissao_preview, null);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-null', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.pedidos_criados[0].data_emissao, null);
      }
    },
    {
      name: 'pedido existente com data_emissao null recebe data_emissao da planilha',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Update', codigo: 'CLI-UPD' }, { accountId: 'acc-pedidos-import-update' });
        await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: cliente.id, numero: 'PED-UPD', status: 'rascunho', origem: 'manual', total: 0, metadata: {}, data_emissao: null }, { accountId: 'acc-pedidos-import-update' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-UPD', 'Número ERP': 'PED-UPD', Situação: 'Faturado Total', 'Data Emissão': '15/03/2026', 'Valor Total': '10' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-update', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].data_emissao_preview, '2026-03-15');
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-update', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_atualizados, 1);
        assert.equal(execute.body.summary.pedidos_data_emissao_atualizada, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].data_emissao, '2026-03-15');
      }
    },
    {
      name: 'pedido existente com data_emissao preenchida nao sobrescreve',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Preserve', codigo: 'CLI-PR' }, { accountId: 'acc-pedidos-import-preserve' });
        await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: cliente.id, numero: 'PED-PR', status: 'rascunho', origem: 'manual', total: 0, metadata: {}, data_emissao: '2026-01-01' }, { accountId: 'acc-pedidos-import-preserve' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-PR', 'Número ERP': 'PED-PR', Situação: 'Faturado Total', 'Data Emissão': '2026-03-15', 'Valor Total': '10' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-preserve', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-preserve', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_atualizados, 1);
        assert.equal(execute.body.summary.pedidos_data_emissao_ignoradas_existentes, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].data_emissao, '2026-01-01');
      }
    },
    {
      name: 'serial Excel converte corretamente',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente Serial', codigo: 'CLI-SER' }, { accountId: 'acc-pedidos-import-serial' });
        const workbook = xlsx.utils.book_new();
        const sheet = xlsx.utils.aoa_to_sheet([
          ['Cliente', 'Número ERP', 'Situação', 'Data Emissão', 'Valor Total'],
          ['CLI-SER', 'PED-SER', 'Faturado Total', 45366, '10']
        ]);
        xlsx.utils.book_append_sheet(workbook, sheet, 'Pedidos');
        const base64 = xlsx.write(workbook, { type: 'base64', bookType: 'xlsx' });
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-serial', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].data_emissao_preview, '2024-04-01');
      }
    }
  ];
}
