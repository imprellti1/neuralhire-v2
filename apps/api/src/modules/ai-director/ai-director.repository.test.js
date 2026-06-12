import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboard } from './ai-director.repository.js';

test('ai director repository returns executive dashboard mock', async () => {
  const dashboard = await getAiDirectorDashboard();
  assert.ok(dashboard.health && typeof dashboard.health === 'object');
  assert.ok(Array.isArray(dashboard.alerts));
  assert.ok(Array.isArray(dashboard.opportunities));
  assert.ok(dashboard.radar);
  assert.equal(Object.keys(dashboard.health).length, 0);
  assert.equal(dashboard.alerts.length, 0);
  assert.equal(dashboard.opportunities.length, 0);
  assert.ok(Array.isArray(dashboard.radar.observacoesPorModulo));
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
});

export function getAiDirectorRepositoryTests() {
  return [];
}
