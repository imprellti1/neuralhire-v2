import assert from 'node:assert/strict';
import test from 'node:test';
import { completeDirectorTask, __resetMemoryAiDirectorTasksForTests, upsertDirectorTask } from './ai-director-tasks.repository.js';
import { __resetMemoryAiDirectorActionPlansForTests, __seedMemoryAiDirectorActionPlansForTests, upsertActionPlan, listActionPlans } from './ai-director-action-plans.repository.js';
import { __resetMemoryAiDirectorObservationsForTests, createObservation, listObservations } from '../ai-director-observations/ai-director-observations.repository.js';

async function createPlanAndTask(accountId, { executiveMemoryId = 'mem-1', planStatus = 'aberto', title = 'Plano X' } = {}) {
  const actionPlan = await upsertActionPlan({
    executive_memory_id: executiveMemoryId,
    titulo: title,
    descricao: 'Descricao do plano',
    gerente_responsavel: 'comercial',
    impacto: 'alto',
    esforco: 'baixo',
    prioridade_score: 90,
    prazo_dias: 5,
    status: planStatus,
    metadata: { normalized_title_key: title.toLowerCase().replace(/\s+/g, '_'), executive_memory_id: executiveMemoryId }
  }, { accountId });
  const task = await upsertDirectorTask({
    account_id: accountId,
    action_plan_id: actionPlan.id,
    manager_id: 'comercial',
    manager_name: 'Gerente Comercial',
    category: 'comercial',
    title: `Tarefa ${title}`,
    description: 'Fechar ciclo',
    priority: 'high',
    status: 'open',
    metadata: { executive_memory_id: executiveMemoryId }
  });
  return { actionPlan, task: task.task };
}

test('concluir uma tarefa fecha plano mas nao resolve observacao sem vinculo', async () => {
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorActionPlansForTests();
  __resetMemoryAiDirectorObservationsForTests();
  const accountId = 'acc-test';
  const { actionPlan, task } = await createPlanAndTask(accountId, { executiveMemoryId: 'mem-a', title: 'Plano A' });

  const result = await completeDirectorTask(accountId, task.id, { conclusion_notes: 'ok', result: 'parcial' });
  assert.equal(result.task.status, 'done');
  assert.equal(result.actionPlan.status, 'concluido');
  assert.equal(result.observation, null);
  assert.equal(result.cycleClosed, false);
});

test('concluir ultima tarefa e fechar plano', async () => {
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorActionPlansForTests();
  __resetMemoryAiDirectorObservationsForTests();
  const accountId = 'acc-test';
  const { actionPlan, task } = await createPlanAndTask(accountId, { executiveMemoryId: 'mem-b', title: 'Plano B' });
  await createObservation({ accountId }, {
    manager_id: 'comercial',
    manager_name: 'Gerente Comercial',
    category: 'comercial',
    title: 'Observacao B',
    description: 'Ligada ao plano B',
    severity: 'medium',
    status: 'open',
    metadata: { executive_memory_id: 'mem-b' }
  });

  const result = await completeDirectorTask(accountId, task.id, {});
  const plans = await listActionPlans(accountId, {}, { limit: 20 });
  assert.equal(result.task.status, 'done');
  assert.equal(result.actionPlan.status, 'concluido');
  assert.equal(plans.items[0].status, 'concluido');
  assert.equal(result.observation.status, 'resolved');
  assert.equal(result.cycleClosed, true);
});

test('fechar ultimo plano e resolver observacao', async () => {
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorActionPlansForTests();
  __resetMemoryAiDirectorObservationsForTests();
  const accountId = 'acc-test';
  const { task } = await createPlanAndTask(accountId, { executiveMemoryId: 'mem-c', title: 'Plano C' });
  const observation = await createObservation({ accountId }, {
    manager_id: 'comercial',
    manager_name: 'Gerente Comercial',
    category: 'comercial',
    title: 'Observacao C',
    description: 'Ligada ao plano C',
    severity: 'medium',
    status: 'open',
    metadata: { executive_memory_id: 'mem-c' }
  });

  const result = await completeDirectorTask(accountId, task.id, {});
  const observations = await listObservations({ accountId }, { status: 'resolved', limit: 20 });
  assert.equal(result.actionPlan.status, 'concluido');
  assert.equal(result.observation.id, observation.id);
  assert.equal(observations.items[0].status, 'resolved');
  assert.equal(result.cycleClosed, true);
});

test('nao fechar observacao quando ainda houver plano pendente', async () => {
  __resetMemoryAiDirectorTasksForTests();
  __resetMemoryAiDirectorActionPlansForTests();
  __resetMemoryAiDirectorObservationsForTests();
  const accountId = 'acc-test';
  const { task } = await createPlanAndTask(accountId, { executiveMemoryId: 'mem-d', title: 'Plano D' });
  __seedMemoryAiDirectorActionPlansForTests([{
    id: 'plan-pending',
    account_id: accountId,
    executive_memory_id: 'mem-d',
    titulo: 'Plano D2',
    descricao: 'Outro plano',
    gerente_responsavel: 'comercial',
    impacto: 'alto',
    esforco: 'baixo',
    prioridade_score: 80,
    prazo_dias: 5,
    status: 'aberto',
    metadata: { normalized_title_key: 'plano_d2', executive_memory_id: 'mem-d' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    criado_em: new Date().toISOString()
  }]);
  await createObservation({ accountId }, {
    manager_id: 'comercial',
    manager_name: 'Gerente Comercial',
    category: 'comercial',
    title: 'Observacao D',
    description: 'Tem plano pendente',
    severity: 'medium',
    status: 'open',
    metadata: { executive_memory_id: 'mem-d' }
  });

  const result = await completeDirectorTask(accountId, task.id, {});
  assert.equal(result.actionPlan.status, 'concluido');
  assert.equal(result.observation.status, 'open');
  assert.equal(result.cycleClosed, false);
});

export function getAiDirectorTaskCompletionTests() {
  return [];
}
