import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboard } from './ai-director.repository.js';

test('ai director repository returns executive dashboard mock', () => {
  const dashboard = getAiDirectorDashboard();
  assert.equal(dashboard.health.receita_mes, 124550);
  assert.equal(dashboard.health.pedidos_mes, 358);
  assert.ok(Array.isArray(dashboard.alerts));
  assert.ok(Array.isArray(dashboard.opportunities));
});

export function getAiDirectorRepositoryTests() {
  return [];
}
