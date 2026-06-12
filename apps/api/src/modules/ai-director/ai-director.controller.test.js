import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboardHandler } from './ai-director.controller.js';

test('ai director controller returns dashboard payload', async () => {
  const result = await getAiDirectorDashboardHandler();
  assert.equal(result.ok, true);
  assert.ok(result.health);
  assert.ok(result.alerts);
  assert.ok(result.opportunities);
  assert.ok(result.radar);
  assert.equal(typeof result.radar.resumoExecutivo, 'string');
  assert.equal(typeof result.radar.scoreExecutivo.classificacao, 'string');
  assert.ok(result.radar.scoreExecutivo.pilares);
  assert.ok(Array.isArray(result.radar.acoesSugeridas));
});

export function getAiDirectorControllerTests() {
  return [];
}
