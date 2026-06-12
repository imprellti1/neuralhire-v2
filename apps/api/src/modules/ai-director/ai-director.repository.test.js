import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboard } from './ai-director.repository.js';

test('ai director repository returns executive dashboard mock', () => {
  const dashboard = getAiDirectorDashboard();
  assert.ok(dashboard.health && typeof dashboard.health === 'object');
  assert.ok(Array.isArray(dashboard.alerts));
  assert.ok(Array.isArray(dashboard.opportunities));
  assert.equal(Object.keys(dashboard.health).length, 0);
  assert.equal(dashboard.alerts.length, 0);
  assert.equal(dashboard.opportunities.length, 0);
});

export function getAiDirectorRepositoryTests() {
  return [];
}
