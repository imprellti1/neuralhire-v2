import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';

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
    }
  ];
}
