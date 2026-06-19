import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboard } from './ai-director.repository.js';
import { __resetMemoryAiDirectorForTests, __setAiDirectorSupabaseClientForTests, createExecutiveMemory, listAiDirectorMemories, listExecutiveMemories } from './ai-director.repository.js';
import { __resetMemoryAiDirectorEventsForTests, createAiDirectorEvent, listAiDirectorEvents } from './ai-director-events.repository.js';

test('ai director repository returns executive dashboard mock', async () => {
  __resetMemoryAiDirectorForTests();
  const dashboard = await getAiDirectorDashboard({ accountId: 'acc-test' });
  assert.ok(dashboard.health && typeof dashboard.health === 'object');
  assert.ok(Array.isArray(dashboard.alerts));
  assert.ok(Array.isArray(dashboard.opportunities));
  assert.ok(dashboard.radar);
  assert.equal(Object.keys(dashboard.health).length, 0);
  assert.equal(dashboard.alerts.length, 0);
  assert.equal(dashboard.opportunities.length, 0);
  assert.ok(dashboard.radar.auditoria);
  assert.equal(typeof dashboard.radar.auditoria.versao, 'string');
  assert.equal(typeof dashboard.radar.auditoria.geradoEm, 'string');
  assert.equal(dashboard.radar.auditoria.tempoGeracaoMs >= 0, true);
  assert.equal(Array.isArray(dashboard.radar.auditoria.fontesUtilizadas), true);
  assert.equal(dashboard.radar.auditoria.consistencia && typeof dashboard.radar.auditoria.consistencia === 'object', true);
  assert.equal(dashboard.radar.auditoria.qualidade && typeof dashboard.radar.auditoria.qualidade === 'object', true);
  assert.equal(typeof dashboard.radar.auditoria.consistencia.scoreValido, 'boolean');
  assert.ok(Array.isArray(dashboard.radar.observacoesPorModulo));
  assert.ok(Array.isArray(dashboard.radar.alteracoesRelevantes));
  assert.equal(typeof dashboard.radar.orquestracaoGerentes, 'object');
  assert.ok(Array.isArray(dashboard.radar.orquestracaoGerentes.orquestracoes));
  assert.equal(typeof dashboard.radar.orquestracaoGerentes.resumo, 'string');
  assert.equal(typeof dashboard.radar.resumoAlteracoes, 'string');
  assert.ok(dashboard.radar.monitoramento && typeof dashboard.radar.monitoramento === 'object');
  assert.equal(typeof dashboard.radar.monitoramento.janelaHoras, 'number');
  assert.equal(typeof dashboard.radar.monitoramento.geradoEm, 'string');
  assert.equal(typeof dashboard.radar.monitoramento.totalAlteracoes, 'number');
  assert.equal(dashboard.radar.observacoesPorModulo.length, 4);
  assert.deepEqual(dashboard.radar.observacoesPorModulo.map((item) => item.modulo), ['Comercial', 'Produtos', 'Follow-up', 'Inteligência']);
  for (const item of dashboard.radar.observacoesPorModulo) {
    assert.equal(typeof item.modulo, 'string');
    assert.equal(['saudavel', 'atencao', 'critico'].includes(item.status), true);
    assert.equal(typeof item.score, 'number');
    assert.equal(item.score >= 0 && item.score <= 100, true);
    assert.equal(typeof item.resumo, 'string');
    assert.equal(Array.isArray(item.observacoes), true);
    assert.equal(item.gerenteResponsavel === null || typeof item.gerenteResponsavel === 'string', true);
  }
  assert.equal(typeof dashboard.radar.resumoModular, 'string');
  assert.ok(typeof dashboard.radar.scoreExecutivo.valor === 'number');
  assert.ok(dashboard.radar.scoreExecutivo.pilares);
  assert.ok(Array.isArray(dashboard.radar.acoesSugeridas));
  assert.ok(dashboard.radar.persistenciaInsights);
  assert.equal(typeof dashboard.radar.persistenciaInsights.candidatos, 'number');
  assert.equal(typeof dashboard.radar.persistenciaInsights.persistidos, 'number');
  assert.equal(typeof dashboard.radar.persistenciaInsights.ignorados, 'number');
  assert.ok(dashboard.radar.persistenciaInsights.persistidos <= 5);

  const firstMemories = await listExecutiveMemories({ limit: 50 }, { accountId: 'acc-test' });
  const firstCount = firstMemories.items.length;
  const repeatDashboard = await getAiDirectorDashboard({ accountId: 'acc-test' });
  assert.ok(repeatDashboard.radar.persistenciaInsights);
  assert.ok(repeatDashboard.radar.persistenciaInsights.persistidos <= 5);
  const secondMemories = await listExecutiveMemories({ limit: 50 }, { accountId: 'acc-test' });
  assert.equal(secondMemories.items.length, firstCount);
});

test('ai director strategic memories use created_at and never query criado_em', async () => {
  __resetMemoryAiDirectorForTests();
  const calls = [];
  const rows = [{ id: 'm-1', account_id: 'acc-test', titulo: 'T', conteudo: 'C', created_at: '2026-06-19T10:00:00.000Z', updated_at: '2026-06-19T10:00:00.000Z' }];
  const supabase = {
    from(table) {
      calls.push({ type: 'from', table });
      const chain = {
        select(columns) {
          calls.push({ type: 'select', table, columns });
          return chain;
        },
        eq(column, value) {
          calls.push({ type: 'eq', table, column, value });
          return chain;
        },
        order(column, options) {
          calls.push({ type: 'order', table, column, options });
          return chain;
        },
        limit(value) {
          calls.push({ type: 'limit', table, value });
          return Promise.resolve({ data: rows, error: null });
        }
      };
      return chain;
    }
  };
  __setAiDirectorSupabaseClientForTests(supabase, true);
  try {
    const result = await listAiDirectorMemories({ limit: 5 }, { accountId: 'acc-test' });
    assert.equal(result.items[0].created_at, rows[0].created_at);
    assert.equal(result.items[0].criado_em, rows[0].created_at);
    assert.deepEqual(calls.find((call) => call.type === 'order' && call.table === 'ai_director_memories'), {
      type: 'order',
      table: 'ai_director_memories',
      column: 'created_at',
      options: { ascending: false }
    });
    assert.equal(calls.some((call) => call.type === 'order' && call.column === 'criado_em'), false);
  } finally {
    __setAiDirectorSupabaseClientForTests(null, false);
  }
});

test('ai director executive memories keep criado_em contract and expose created_at alias', async () => {
  __resetMemoryAiDirectorForTests();
  await createExecutiveMemory({ tipo: 'trend', titulo: 'T', descricao: 'D', categoria: 'geral', severidade: 'media', metadata: {} }, { accountId: 'acc-test' });
  const result = await listExecutiveMemories({ limit: 5 }, { accountId: 'acc-test' });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].criado_em, result.items[0].created_at);
  assert.ok(result.items[0].criado_em);
});

test('ai director events repository stores and filters timeline entries', async () => {
  __resetMemoryAiDirectorEventsForTests();
  await createAiDirectorEvent({ event_type: 'observation_created', entity_type: 'observacao', entity_id: 'o-1', status: 'aberto', title: 'Obs', description: 'Desc', recurrence_count: 2 }, { accountId: 'acc-test' });
  const result = await listAiDirectorEvents('acc-test', { status: 'aberto', limit: 10 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].recurrence_count, 2);
  assert.equal(result.items[0].event_type, 'observation_created');
});

export function getAiDirectorRepositoryTests() {
  return [];
}
