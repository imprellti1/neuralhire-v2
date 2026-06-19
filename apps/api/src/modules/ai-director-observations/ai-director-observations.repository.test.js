import assert from 'node:assert/strict';
import test from 'node:test';
import { createObservationIfNotOpen, listObservations, updateObservationStatus, __resetMemoryAiDirectorObservationsForTests } from './ai-director-observations.repository.js';
import { __resetMemoryAiDirectorActionPlansForTests, listActionPlans, upsertActionPlan } from '../ai-director/ai-director-action-plans.repository.js';
import { __resetMemoryAiDirectorTasksForTests, generateDirectorTasksFromOpenActionPlans, listDirectorTasks, upsertDirectorTask } from '../ai-director/ai-director-tasks.repository.js';

function basePayload(overrides = {}) {
  return {
    manager_id: 'comercial',
    manager_name: 'Gerente Comercial',
    category: 'comercial',
    title: 'Cliente sem compra',
    description: 'Observacao recorrente',
    severity: 'high',
    status: 'open',
    source_type: 'cliente',
    source_id: 'cliente-1',
    metadata: { dedupe_key: 'cliente-1:sem_compra' },
    ...overrides
  };
}

test('observacao aberta equivalente nao duplica', async () => {
  __resetMemoryAiDirectorObservationsForTests();
  const accountId = 'acc-test';
  await createObservationIfNotOpen({ accountId }, basePayload());

  const result = await createObservationIfNotOpen({ accountId }, basePayload());
  const observations = await listObservations({ accountId }, { limit: 20 });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'duplicate');
  assert.equal(observations.items.length, 1);
  assert.equal(observations.items[0].status, 'open');
});

test('observacao resolved equivalente reabre com metadata de recorrencia', async () => {
  __resetMemoryAiDirectorObservationsForTests();
  const accountId = 'acc-test';
  const created = await createObservationIfNotOpen({ accountId }, basePayload());
  await updateObservationStatus({ accountId }, created.observation.id, {
    status: 'resolved',
    metadata: { resolved_at: '2026-06-18T10:00:00.000Z', history: [{ event: 'resolved', resolved_at: '2026-06-18T10:00:00.000Z' }] }
  });

  const result = await createObservationIfNotOpen({ accountId }, basePayload());
  const observations = await listObservations({ accountId }, { limit: 20 });

  assert.equal(result.created, false);
  assert.equal(result.reason, 'reopened');
  assert.equal(result.observation.status, 'open');
  assert.equal(result.observation.metadata.recurrence_count, 1);
  assert.equal(result.observation.metadata.previous_resolved_at, '2026-06-18T10:00:00.000Z');
  assert.ok(Array.isArray(result.observation.metadata.recurrence_history));
  assert.equal(result.observation.metadata.recurrence_history.some((item) => item.event === 'resolved_cycle_reopened'), true);
  assert.equal(observations.items[0].status, 'open');
});

test('planos e tarefas concluidos antigos permanecem e novo ciclo pode gerar plano e tarefa', async () => {
  __resetMemoryAiDirectorObservationsForTests();
  __resetMemoryAiDirectorActionPlansForTests();
  __resetMemoryAiDirectorTasksForTests();
  const accountId = 'acc-test';

  const resolved = await createObservationIfNotOpen({ accountId }, basePayload({ source_id: 'cliente-2', metadata: { dedupe_key: 'cliente-2:sem_compra' } }));
  await updateObservationStatus({ accountId }, resolved.observation.id, { status: 'resolved', metadata: { resolved_at: '2026-06-18T10:00:00.000Z' } });

  const oldPlan = await upsertActionPlan({
    executive_memory_id: 'mem-1',
    titulo: 'Executar plano de ação: Cliente sem compra',
    descricao: 'Plano antigo concluído',
    gerente_responsavel: 'comercial',
    impacto: 'alto',
    esforco: 'baixo',
    prioridade_score: 90,
    prazo_dias: 5,
    status: 'concluido',
    metadata: { normalized_title_key: 'executar_plano_de_acao_cliente_sem_compra', executive_memory_id: 'mem-1' }
  }, { accountId });
  await upsertDirectorTask({
    account_id: accountId,
    action_plan_id: oldPlan.id,
    manager_id: 'comercial',
    manager_name: 'Gerente Comercial',
    category: 'comercial',
    title: 'Tarefa antiga',
    description: 'Tarefa concluida antiga',
    priority: 'high',
    status: 'done',
    metadata: { executive_memory_id: 'mem-1' }
  });

  const reopened = await createObservationIfNotOpen({ accountId }, basePayload({ source_id: 'cliente-2', metadata: { dedupe_key: 'cliente-2:sem_compra' } }));
  const newPlan = await upsertActionPlan({
    executive_memory_id: 'mem-1',
    titulo: 'Executar plano de ação: Cliente sem compra',
    descricao: 'Novo plano após reabertura',
    gerente_responsavel: 'comercial',
    impacto: 'alto',
    esforco: 'baixo',
    prioridade_score: 90,
    prazo_dias: 5,
    status: 'aberto',
    metadata: { normalized_title_key: 'executar_plano_de_acao_cliente_sem_compra', executive_memory_id: 'mem-1' }
  }, { accountId });
  const taskResult = await generateDirectorTasksFromOpenActionPlans(accountId);
  const plans = await listActionPlans(accountId, {}, { limit: 20 });
  const tasks = await listDirectorTasks(accountId, { limit: 20 });

  assert.equal(reopened.reason, 'reopened');
  assert.equal(oldPlan.status, 'concluido');
  assert.equal(newPlan.status, 'aberto');
  assert.equal(taskResult.created, 1);
  assert.equal(plans.items.some((plan) => plan.status === 'concluido'), true);
  assert.equal(tasks.some((task) => task.status === 'done'), true);
  assert.equal(tasks.some((task) => task.status === 'open'), true);
});
