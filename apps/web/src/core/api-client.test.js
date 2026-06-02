import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from './api-client.js';
import { installFetchMock, getCapturedFetchCalls, assertNoSensitiveTransportFields, resetFetchCalls } from '../testing/mocks/api-client.mock.js';

function setRuntimeConfig(config) {
  global.window = global.window || {};
  window.__NEURALHIRE_CONFIG__ = config;
}

function clearRuntimeConfig() {
  if (typeof window !== 'undefined') delete window.__NEURALHIRE_CONFIG__;
}

test('api client only sends demo tenant headers with explicit homologation config', async () => {
  setRuntimeConfig({
    VITE_API_URL: 'https://api.test',
    VITE_APP_ENV: 'homologation',
    VITE_DEMO_ACCOUNT_ID: 'acc-analytics-001',
    VITE_DEMO_ROLE: 'manager',
    VITE_DEMO_USER_ID: 'user-demo-manager'
  });
  installFetchMock({
    'POST /demo': () => ({ ok: true })
  });

  const api = createApiClient();
  await api.post('/demo', { name: 'x', metadata: { source: 'demo' } });

  const call = getCapturedFetchCalls()[0];
  assert.equal(call.headers['x-test-account-id'], 'acc-analytics-001');
  assert.equal(call.headers['x-test-role'], 'manager');
  assert.equal(call.headers['x-test-user-id'], 'user-demo-manager');
  assertNoSensitiveTransportFields(getCapturedFetchCalls());
  assert.deepEqual(call.body, { name: 'x', metadata: { source: 'demo' } });

  clearRuntimeConfig();
  resetFetchCalls();
});

test('api client does not send demo tenant headers without explicit demo config', async () => {
  setRuntimeConfig({
    VITE_API_URL: 'https://api.test',
    VITE_APP_ENV: 'production'
  });
  installFetchMock({
    'GET /demo': () => ({ ok: true })
  });

  const api = createApiClient();
  await api.get('/demo');

  const call = getCapturedFetchCalls()[0];
  assert.equal(call.headers['x-test-account-id'], undefined);
  assert.equal(call.headers['x-test-role'], undefined);
  assert.equal(call.headers['x-test-user-id'], undefined);
  assertNoSensitiveTransportFields(getCapturedFetchCalls());

  clearRuntimeConfig();
  resetFetchCalls();
});
