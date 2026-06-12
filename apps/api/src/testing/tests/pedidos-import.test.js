import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createCliente, __resetMemoryClientesForTests, __dumpMemoryClientes } from '../../modules/clientes/clientes.repository.js';
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
          { Cliente: 'CLI-001', 'Razão Social': 'Nao usar', 'Número ERP': 'PED-001', Status: 'rascunho', Observacoes: 'ok', 'Lote Gravação': 'L1', 'Data Prev.Fatur.': '2026-01-01', 'Qt. Peças': '99', 'Valor Total': '500', 'Valor cancelado': '0', Origem: 'ERP', Duplicar: 'N', Imprimir: 'S' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.res.statusCode, 200);
        assert.equal(preview.body.rows[0].pedido, 'PED-001');
        assert.equal(preview.body.rows[0].cliente, 'CLI-001');
        assert.equal(preview.body.rows[0].clienteId, cliente.id);
        assert.equal(preview.body.rows[0].statusImportacao, 'ok');
        assert.equal(preview.body.rows[0].ignored['Razão Social'], 'Nao usar');
        assert.equal(preview.body.summary.pedidos_sem_cliente, 0);
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import', body: { importToken: preview.body.importToken } });
        assert.equal(execute.res.statusCode, 200);
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(execute.body.summary.pedidos_sem_cliente, 0);
        assert.equal(__dumpMemoryPedidos().pedidos.length, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].cliente_id, cliente.id);
        assert.equal(__dumpMemoryClientes().length > 0, true);
      }
    },
    {
      name: 'cliente inexistente gera inconsistência e não cria pedido',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const base64 = makeWorkbook([{ Cliente: 'CLI-404', 'Número ERP': 'PED-404', Status: 'rascunho' }]);
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
          { Cliente: 'CLI-001', 'Número ERP': 'PED-001', Status: 'rascunho', 'Lote Gravação': 'x' },
          { Cliente: 'CLI-002', 'Número ERP': 'PED-002', Status: 'rascunho', 'Origem': 'erp' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-3', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.summary.pedidos_sem_cliente, 1);
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
        const base64 = makeWorkbook([{ Cliente: 'SEM-CLIENTE', 'Número ERP': 'PED-SEM', Status: 'rascunho' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-4', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-4', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.pedidos_criados.length, 0);
        assert.equal(execute.body.pedidos_sem_cliente.length, 1);
        assert.equal(__dumpMemoryPedidos().pedidos.length, 0);
      }
    },
    {
      name: 'detecta duplicado existente no tenant por account_id e numero',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-001' }, { accountId: 'acc-pedidos-import-5' });
        await createCliente({ nome: 'Cliente B', codigo: 'CLI-002' }, { accountId: 'acc-pedidos-import-outra' });
        await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: cliente.id, numero: 'PED-EXISTE', status: 'rascunho', origem: 'manual', subtotal: 0, desconto: 0, total: 0, metadata: {} }, { accountId: 'acc-pedidos-import-5' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-001', 'Número ERP': 'PED-EXISTE', Status: 'rascunho' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-5', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-5', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 0);
        assert.equal(execute.body.summary.pedidos_duplicados, 1);
        assert.equal(execute.body.inconsistencias[0].codigo, 'PEDIDO_DUPLICADO_EXISTENTE');
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
        await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: clienteTenantA.id, numero: 'PED-MESMO', status: 'rascunho', origem: 'manual', subtotal: 0, desconto: 0, total: 0, metadata: {} }, { accountId: 'acc-pedidos-import-6' });
        const base64 = makeWorkbook([{ Cliente: 'CLI-002', 'Número ERP': 'PED-MESMO', Status: 'rascunho' }]);
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
          { Cliente: 'CLI-001', 'Número ERP': 'PED-DUP', Status: 'rascunho' },
          { Cliente: 'CLI-001', 'Número ERP': 'PED-DUP', Status: 'rascunho' }
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
        const base64 = makeWorkbook([{ Cliente: '00123', 'Número ERP': 'PED-ZERO', Status: 'rascunho', 'Razão Social': 'ignorar' }]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-pedidos-import-9', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        assert.equal(preview.body.rows[0].clienteId, cliente.id);
        assert.equal(preview.body.rows[0].cliente, '00123');
        assert.equal(preview.body.rows[0].pedido, 'PED-ZERO');
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-pedidos-import-9', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 1);
        assert.equal(__dumpMemoryPedidos().pedidos[0].numero, 'PED-ZERO');
      }
    }
  ];
}
