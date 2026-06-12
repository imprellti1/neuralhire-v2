import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiDirectorDashboardHandler } from './ai-director.controller.js';

test('ai director controller returns dashboard payload', async () => {
  const result = await getAiDirectorDashboardHandler();
  assert.equal(result.ok, true);
  assert.ok(result.health);
  assert.ok(result.alerts);
  assert.ok(result.opportunities);
});

export function getAiDirectorControllerTests() {
  return [];
}
