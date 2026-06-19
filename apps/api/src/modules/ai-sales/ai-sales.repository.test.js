import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiSalesAlerts, getAiSalesOpportunities, getAiSalesOverview, getAiSalesPortfolioData, getAiSalesPerformance, getAiSalesTasks } from './ai-sales.repository.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests } from '../clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, __loadMemoryPedidos } from '../pedidos/pedidos.repository.js';
import { __resetMemoryAlertasForTests } from '../clientes/clientes.alerts.service.js';
import { __resetMemoryAiDirectorTasksForTests, listDirectorTasks, upsertDirectorTask, upsertSellerInsightTask } from '../ai-director/ai-director-tasks.repository.js';
import { __resetMemoryAiDirectorEventsForTests, listAiDirectorEvents } from '../ai-director/ai-director-events.repository.js';

test('ai sales repository computes overview and portfolio from existing data', async () => {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryAlertasForTests();
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorEventsForTests();

  __loadMemoryClientes([
    { id: 'c1', account_id: 'acc-test', nome: 'Cliente 1', documento: '123', cidade: 'São Paulo', estado: 'SP', vendedor_id: 'v1', cliente_score: 72, ativo: true },
    { id: 'c2', account_id: 'acc-test', nome: 'Cliente 2', documento: '456', cidade: 'Santos', estado: 'SP', cliente_score: 24, ativo: true }
  ]);
  __loadMemoryPedidos({
    pedidos: [
      { id: 'p1', account_id: 'acc-test', cliente_id: 'c1', total: 1000, data_emissao: '2026-06-10T00:00:00.000Z', status: 'faturado' },
      { id: 'p2', account_id: 'acc-test', cliente_id: 'c1', total: 500, data_emissao: '2026-05-01T00:00:00.000Z', status: 'faturado' }
    ]
  });

  await upsertDirectorTask({ account_id: 'acc-test', action_plan_id: 'plan-1', manager_id: 'v1', manager_name: 'Vendedor 1', category: 'comercial', title: 'Task 1', description: 'Desc', priority: 'medium', status: 'open', metadata: {} });
  await upsertDirectorTask({ account_id: 'acc-test', action_plan_id: 'plan-2', manager_id: 'gerente_comercial', manager_name: 'Gerente Comercial', cliente_id: 'c1', category: 'comercial', title: 'Task 2', description: 'Delegada', priority: 'high', status: 'open', metadata: {} });
  await upsertDirectorTask({ account_id: 'acc-test', action_plan_id: 'plan-3', manager_id: 'gerente_comercial', manager_name: 'Gerente Comercial', cliente_id: 'c2', category: 'comercial', title: 'Task 3', description: 'Sem vendedor', priority: 'high', status: 'open', metadata: {} });

  const overview = await getAiSalesOverview('acc-test', {});
  assert.equal(overview.total_clientes, 2);
  assert.equal(overview.faturamento_carteira > 0, true);
  assert.equal(typeof overview.ticket_medio, 'number');

  const portfolio = await getAiSalesPortfolioData('acc-test', {});
  assert.equal(portfolio.items.length, 2);
  assert.equal(portfolio.items[0].cliente_id, 'c1');
  assert.equal(typeof portfolio.items[0].status_risco, 'string');

  const alerts = await getAiSalesAlerts('acc-test', {});
  assert.ok(Array.isArray(alerts.items));

  const opportunities = await getAiSalesOpportunities('acc-test', {});
  assert.ok(Array.isArray(opportunities.items));

  const tasks = await getAiSalesTasks('acc-test', { vendedor_id: 'v1' });
  assert.ok(Array.isArray(tasks.items));
  assert.equal(tasks.items.length, 2);
  assert.equal(tasks.items.every((task) => String(task.vendedor_id || '') === 'v1'), true);
  assert.equal(tasks.items.some((task) => task.delegation_level === 'vendedor'), true);

  const performance = await getAiSalesPerformance('acc-test', {});
  assert.equal(typeof performance.clientes_ativos, 'number');
});

test('ai sales repository normalizes financial amount from legacy fields', async () => {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryAlertasForTests();
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorEventsForTests();

  __loadMemoryClientes([
    { id: 'c1', account_id: 'acc-test', nome: 'Cliente 1', vendedor_id: 'v1', cliente_score: 72, ativo: true }
  ]);

  await upsertDirectorTask({ account_id: 'acc-test', action_plan_id: 'plan-1', manager_id: 'v1', manager_name: 'Vendedor 1', category: 'comercial', title: 'Task 1', description: 'Desc', priority: 'medium', status: 'open', value: '1250.5', metadata: {} });
  await upsertDirectorTask({ account_id: 'acc-test', action_plan_id: 'plan-2', manager_id: 'v1', manager_name: 'Vendedor 1', category: 'comercial', title: 'Task 2', description: 'Desc', priority: 'medium', status: 'open', impacto_estimado: '900', metadata: {} });

  const tasks = await getAiSalesTasks('acc-test', { vendedor_id: 'v1' });
  assert.equal(tasks.items.some((task) => task.financial_amount === 1250.5), true);
  assert.equal(tasks.items.some((task) => task.financial_amount === 900), true);
});

test('ai sales repository generates seller insight task and event', async () => {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryAlertasForTests();
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorEventsForTests();

  __loadMemoryClientes([
    { id: 'c-risk', account_id: 'acc-test', nome: 'Cliente Risco', vendedor_id: 'v1', cliente_score: 20, ativo: true }
  ]);
  __loadMemoryPedidos({
    pedidos: [
      { id: 'p1', account_id: 'acc-test', cliente_id: 'c-risk', total: 1000, data_emissao: '2026-01-01T00:00:00.000Z', status: 'faturado' }
    ]
  });

  const result = await upsertSellerInsightTask({
    account_id: 'acc-test',
    cliente_id: 'c-risk',
    vendedor_id: 'v1',
    priority: 'high',
    title: 'Entrar em contato com cliente em risco',
    description: 'Tarefa automática do Vendedor IA',
    status: 'open',
    origin: 'vendedor_ia',
    reason: 'cliente_em_risco'
  });

  assert.equal(result.created, true);
  const tasks = await listDirectorTasks('acc-test', { vendedor_id: 'v1', cliente_id: 'c-risk', status: 'open' });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].delegation_level, 'vendedor');
  assert.equal(tasks[0].origin, 'vendedor_ia');
  const events = await listAiDirectorEvents('acc-test', { status: 'aberto', limit: 20 });
  assert.equal(events.items.some((event) => event.event_type === 'sales_task_generated'), true);
});

export function getAiSalesRepositoryTests() {
  return [];
}
