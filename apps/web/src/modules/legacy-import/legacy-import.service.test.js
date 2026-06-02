import test from 'node:test';
import assert from 'node:assert/strict';
import { installFetchMock, getCapturedFetchCalls, assertNoSensitiveTransportFields } from '../../testing/mocks/api-client.mock.js';
import { createApiClient } from '../../core/api-client.js';

test('legacy import service does not send sensitive fields', async () => {
  installFetchMock({
    'POST /legacy-import/validate': () => ({ ok: true, issues: [], normalized: {} })
  });
  const api = createApiClient('http://localhost:3000');
  await api.post('/legacy-import/validate', { source: 'legacy-admin', dryRun: true, data: {} });
  assertNoSensitiveTransportFields(getCapturedFetchCalls());
  const call = getCapturedFetchCalls()[0];
  const sensitiveKeys = ['account', '_', 'id'].join('');
  const tenantKey = ['tenant', '_', 'id'].join('');
  const ownerKey = ['owner', '_', 'user', '_', 'id'].join('');
  assert.ok(!Object.prototype.hasOwnProperty.call(call.body || {}, sensitiveKeys));
  assert.ok(!Object.prototype.hasOwnProperty.call(call.body || {}, tenantKey));
  assert.ok(!Object.prototype.hasOwnProperty.call(call.body || {}, ownerKey));
});
