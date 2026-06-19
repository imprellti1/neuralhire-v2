import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiSalesAlertsHandler, getAiSalesOpportunitiesHandler, getAiSalesOverviewHandler, getAiSalesPerformanceHandler, getAiSalesPortfolioHandler, getAiSalesTasksHandler } from './ai-sales.controller.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests } from '../clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, __loadMemoryPedidos } from '../pedidos/pedidos.repository.js';
import { __resetMemoryAlertasForTests } from '../clientes/clientes.alerts.service.js';

test('ai sales controller returns overview and portfolio contracts', async () => {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryAlertasForTests();
  __loadMemoryClientes([{ id: 'c1', account_id: 'acc-test', nome: 'Cliente 1', documento: '123', cidade: 'São Paulo', estado: 'SP', vendedor_id: 'v1', cliente_score: 72, ativo: true }]);
  __loadMemoryPedidos({ pedidos: [{ id: 'p1', account_id: 'acc-test', cliente_id: 'c1', total: 1000, data_emissao: '2026-06-10T00:00:00.000Z', status: 'faturado' }] });

  const context = { auth: { accountId: 'acc-test' }, query: { vendedor_id: 'v1' } };
  const overview = await getAiSalesOverviewHandler(context);
  assert.equal(overview.ok, true);
  assert.equal(typeof overview.total_clientes, 'number');
  const portfolio = await getAiSalesPortfolioHandler(context);
  assert.equal(portfolio.ok, true);
  assert.ok(Array.isArray(portfolio.items));
  const alerts = await getAiSalesAlertsHandler(context);
  assert.equal(alerts.ok, true);
  const opportunities = await getAiSalesOpportunitiesHandler(context);
  assert.equal(opportunities.ok, true);
  const tasks = await getAiSalesTasksHandler(context);
  assert.equal(tasks.ok, true);
  const performance = await getAiSalesPerformanceHandler(context);
  assert.equal(performance.ok, true);
});

export function getAiSalesControllerTests() {
  return [];
}

