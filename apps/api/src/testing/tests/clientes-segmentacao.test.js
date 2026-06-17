import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryAlertasForTests, gerarAlertasCliente } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetMemoryClientesForTests, createCliente, updateCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { calcularSegmentacaoCliente } from '../../modules/clientes/clientes.segmentacao.service.js';

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

export function getClientesSegmentacaoTests() {
  return [
    {
      name: 'servico classifica VIP',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_classificacao: 'A', cliente_score_fatores: { total_pedidos: 10, faturamento_total: 50000 } },
          { classificacao: 'A', fatores: { total_pedidos: 10, faturamento_total: 50000 } }
        );
        assertEqual(result.segmento, 'VIP');
      }
    },
    {
      name: 'servico classifica EM_RISCO',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_score_fatores: { dias_sem_compra: 91 } },
          { fatores: { dias_sem_compra: 91 } }
        );
        assertEqual(result.segmento, 'EM_RISCO');
      }
    },
    {
      name: 'servico classifica RECUPERACAO',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_score_fatores: { dias_sem_compra: 10 }, alertas: [{ status: 'resolvido', tipo: 'risco_perda' }] },
          { fatores: { dias_sem_compra: 10, ultima_compra: new Date().toISOString() }, alertas: [{ status: 'resolvido', tipo: 'risco_perda' }] }
        );
        assertEqual(result.segmento, 'RECUPERACAO');
      }
    },
    {
      name: 'servico classifica POTENCIAL',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_potencial: 'Alto', cliente_score_fatores: { total_pedidos: 4 } },
          { potencial: 'Alto', fatores: { total_pedidos: 4 } }
        );
        assertEqual(result.segmento, 'POTENCIAL');
      }
    },
    {
      name: 'servico classifica RECORRENTE',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_score_fatores: { total_pedidos: 5, dias_sem_compra: 60 } },
          { fatores: { total_pedidos: 5, dias_sem_compra: 60 } }
        );
        assertEqual(result.segmento, 'RECORRENTE');
      }
    },
    {
      name: 'servico classifica NOVO',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_score_fatores: { total_pedidos: 2 } },
          { fatores: { total_pedidos: 2 } }
        );
        assertEqual(result.segmento, 'NOVO');
      }
    },
    {
      name: 'servico classifica INATIVO',
      run: async () => {
        const result = await calcularSegmentacaoCliente(
          { id: 'c1', cliente_score_fatores: { total_pedidos: 3 } },
          { fatores: { total_pedidos: 3 } }
        );
        assertEqual(result.segmento, 'INATIVO');
      }
    },
    {
      name: 'endpoint calcula segmentacao, persiste e registra timeline',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const app = createApiApp();
        const accountId = 'acc-seg';
        const cliente = await createCliente({
          nome: 'Cliente Seg',
          cliente_classificacao: 'A',
          cliente_potencial: 'Alto',
          cliente_score_fatores: { total_pedidos: 10, faturamento_total: 50000, dias_sem_compra: 1, ultima_compra: new Date().toISOString() }
        }, { accountId });
        await createPedido({ cliente_id: cliente.id, status: 'faturado', total: 50000, data_faturamento: new Date().toISOString() }, { accountId });
        const out = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-segmentacao`, role: 'admin', accountId });
        assertEqual(out.res.statusCode, 200);
        assertEqual(out.body.item.segmento_comercial, 'VIP');
        assertEqual(Array.isArray(out.body.item.segmento_motivos), true);
        const timeline = await call(app, { method: 'GET', url: `/clientes/${cliente.id}/timeline`, role: 'admin', accountId });
        assertEqual(timeline.body.items.some((item) => item.categoria === 'segmentacao' && item.tipo === 'segmentacao_atualizada'), true);
      }
    },
    {
      name: 'segmentacao respeita tenant via account_id',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Tenant', cliente_score_fatores: { total_pedidos: 1 } }, { accountId: 'acc-a' });
        const blocked = await call(app, { method: 'POST', url: `/clientes/${cliente.id}/calcular-segmentacao`, role: 'admin', accountId: 'acc-b' });
        assertEqual(blocked.res.statusCode, 404);
      }
    }
  ];
}
