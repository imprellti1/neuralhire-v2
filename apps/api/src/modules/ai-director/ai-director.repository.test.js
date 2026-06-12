import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboard } from './ai-director.repository.js';
import { __resetMemoryAiDirectorForTests, listExecutiveMemories } from './ai-director.repository.js';

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

export function getAiDirectorRepositoryTests() {
  return [];
}
