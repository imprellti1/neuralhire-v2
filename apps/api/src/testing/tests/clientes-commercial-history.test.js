import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import {
  __dumpMemoryClientes,
  __loadMemoryClientes,
  __resetMemoryClientesForTests,
  recalculateClientCommercialHistory
} from '../../modules/clientes/clientes.repository.js';
import { __loadMemoryPedidos, __resetMemoryPedidosForTests } from '../../modules/pedidos/pedidos.repository.js';
import { __resetPedidosImportSessionsForTests } from '../../modules/pedidos-import/pedidos-import.repository.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  return app(req, res).then(() => ({ res, body: parseBody(res) }));
}

function daysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function makeWorkbook(rows) {
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Pedidos');
  return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
}

export function getClientesCommercialHistoryTests() {
  return [
    {
      name: 'cliente sem pedidos validos permanece sem_pedido',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        const cliente = { id: 'c1', account_id: 'acc-hist', nome: 'Cliente 1', status_comercial: 'ativo', ultima_compra_em: '2026-01-01T00:00:00.000Z' };
        __loadMemoryClientes([cliente]);
        await recalculateClientCommercialHistory('c1', { accountId: 'acc-hist', now: new Date('2026-06-12T00:00:00.000Z') });
        const updated = __dumpMemoryClientes()[0];
        assert.equal(updated.status_comercial, 'sem_pedido');
        assert.equal(updated.ultima_compra_em, null);
      }
    },
    {
      name: 'status comercial recalcula por janela de dias',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __loadMemoryClientes([
          { id: 'c2', account_id: 'acc-hist', nome: 'A', status_comercial: 'inativo' },
          { id: 'c3', account_id: 'acc-hist', nome: 'B', status_comercial: 'ativo' },
          { id: 'c4', account_id: 'acc-hist', nome: 'C', status_comercial: 'ativo' }
        ]);
        __loadMemoryPedidos({ pedidos: [
          { id: 'p2', account_id: 'acc-hist', cliente_id: 'c2', status: 'faturado', data_emissao: daysAgo(10) },
          { id: 'p3', account_id: 'acc-hist', cliente_id: 'c3', status: 'confirmado', data_emissao: daysAgo(90) },
          { id: 'p4', account_id: 'acc-hist', cliente_id: 'c4', status: 'aprovado', data_emissao: daysAgo(150) }
        ] });
        await recalculateClientCommercialHistory('c2', { accountId: 'acc-hist', now: new Date('2026-06-12T00:00:00.000Z') });
        await recalculateClientCommercialHistory('c3', { accountId: 'acc-hist', now: new Date('2026-06-12T00:00:00.000Z') });
        await recalculateClientCommercialHistory('c4', { accountId: 'acc-hist', now: new Date('2026-06-12T00:00:00.000Z') });
        const [a, b, c] = __dumpMemoryClientes();
        assert.equal(a.status_comercial, 'ativo');
        assert.equal(b.status_comercial, 'em_risco');
        assert.equal(c.status_comercial, 'inativo');
      }
    },
    {
      name: 'ultima compra usa data faturamento e fallback para data emissao',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __loadMemoryClientes([
          { id: 'c5', account_id: 'acc-hist', nome: 'D' },
          { id: 'c6', account_id: 'acc-hist', nome: 'E' }
        ]);
        __loadMemoryPedidos({ pedidos: [
          { id: 'p5', account_id: 'acc-hist', cliente_id: 'c5', status: 'confirmado', data_emissao: '2026-01-01T00:00:00.000Z', data_faturamento: '2026-05-10T00:00:00.000Z' },
          { id: 'p6', account_id: 'acc-hist', cliente_id: 'c6', status: 'confirmado', data_emissao: '2026-05-09T00:00:00.000Z' }
        ] });
        await recalculateClientCommercialHistory('c5', { accountId: 'acc-hist', now: new Date('2026-06-12T00:00:00.000Z') });
        await recalculateClientCommercialHistory('c6', { accountId: 'acc-hist', now: new Date('2026-06-12T00:00:00.000Z') });
        const clients = __dumpMemoryClientes();
        assert.equal(clients.find((i) => i.id === 'c5').ultima_compra_em, '2026-05-10T00:00:00.000Z');
        assert.equal(clients.find((i) => i.id === 'c6').ultima_compra_em, '2026-05-09T00:00:00.000Z');
      }
    },
    {
      name: 'importacao atualiza somente clientes impactados e consolida mais recente',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetPedidosImportSessionsForTests();
        const app = createApiApp();
        __loadMemoryClientes([
          { id: 'c7', account_id: 'acc-hist-import', nome: 'Cliente A', metadata: { codigo_cliente_fabricante: 'CLI-001' }, status_comercial: 'inativo' },
          { id: 'c8', account_id: 'acc-hist-import', nome: 'Cliente B', metadata: { codigo_cliente_fabricante: 'CLI-002' }, status_comercial: 'inativo' }
        ]);
        __loadMemoryPedidos({ pedidos: [
          { id: 'p7', account_id: 'acc-hist-import', cliente_id: 'c7', numero: 'PED-OLD', status: 'confirmado', data_emissao: '2026-01-01T00:00:00.000Z' },
          { id: 'p8', account_id: 'acc-hist-import', cliente_id: 'c8', numero: 'PED-OLD-B', status: 'confirmado', data_emissao: '2025-01-01T00:00:00.000Z' }
        ] });
        const base64 = makeWorkbook([
          { Cliente: 'CLI-001', Número: 'PED-001', Status: 'confirmado' },
          { Cliente: 'CLI-001', Número: 'PED-002', Status: 'faturado' }
        ]);
        const preview = await call(app, { method: 'POST', url: '/pedidos/importacao/preview', role: 'admin', accountId: 'acc-hist-import', body: { arquivo: { fileName: 'Pedidos.xlsx', base64 } } });
        const execute = await call(app, { method: 'POST', url: '/pedidos/importacao', role: 'admin', accountId: 'acc-hist-import', body: { importToken: preview.body.importToken } });
        assert.equal(execute.body.summary.pedidos_criados, 2);
        const clients = __dumpMemoryClientes();
        assert.equal(clients.find((i) => i.id === 'c7').status_comercial, 'ativo');
        assert.ok(clients.find((i) => i.id === 'c7').ultima_compra_em);
        assert.equal(clients.find((i) => i.id === 'c8').status_comercial, 'inativo');
      }
    }
  ];
}

test('clientes commercial history suite', async () => {
  const tests = getClientesCommercialHistoryTests();
  for (const item of tests) {
    await item.run();
  }
});
