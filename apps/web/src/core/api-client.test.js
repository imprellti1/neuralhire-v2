import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from './api-client.js';
import { installFetchMock, getCapturedFetchCalls, assertNoSensitiveTransportFields, resetFetchCalls } from '../testing/mocks/api-client.mock.js';

function setRuntimeConfig(config) {
  global.window = global.window || {};
  window.__NEURALHIRE_CONFIG__ = config;
  window.localStorage = window.localStorage || new Map();
  window.localStorage.getItem = window.localStorage.getItem || ((key) => window.localStorage.map?.get(key) || null);
  window.localStorage.setItem = window.localStorage.setItem || ((key, value) => {
    window.localStorage.map = window.localStorage.map || new Map();
    window.localStorage.map.set(key, String(value));
  });
  window.localStorage.removeItem = window.localStorage.removeItem || ((key) => window.localStorage.map?.delete(key));
  window.localStorage.setItem('neuralhire.supabase.session', JSON.stringify({ access_token: 'token-abc' }));
}

function clearRuntimeConfig() {
  if (typeof window !== 'undefined') delete window.__NEURALHIRE_CONFIG__;
}

test('api client sends Authorization when Supabase session exists', async () => {
  setRuntimeConfig({
    VITE_API_URL: 'https://api.test',
    VITE_APP_ENV: 'homologation'
  });
  installFetchMock({
    'POST /demo': () => ({ ok: true })
  });

  const api = createApiClient();
  await api.post('/demo', { name: 'x', metadata: { source: 'demo' } });

  const call = getCapturedFetchCalls()[0];
  assert.equal(call.headers.Authorization, 'Bearer token-abc');
  assert.equal(call.headers['x-test-account-id'], undefined);
  assertNoSensitiveTransportFields(getCapturedFetchCalls());
  assert.deepEqual(call.body, { name: 'x', metadata: { source: 'demo' } });

  clearRuntimeConfig();
  resetFetchCalls();
});

test('api client does not inject demo headers in homologation', async () => {
  setRuntimeConfig({
    VITE_API_URL: 'https://api.test',
    VITE_APP_ENV: 'homologation'
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

test('api client preserves explicit Authorization header', async () => {
  setRuntimeConfig({
    VITE_API_URL: 'https://api.test',
    VITE_APP_ENV: 'production'
  });
  installFetchMock({
    'GET /product-editor/products': () => ({ items: [], total: 0 })
  });

  const api = createApiClient();
  await api.get('/product-editor/products', {}, { Authorization: 'Bearer jwt-real' });

  const call = getCapturedFetchCalls()[0];
  assert.equal(call.headers.Authorization, 'Bearer jwt-real');
  assert.equal(call.headers['x-test-account-id'], undefined);
  assertNoSensitiveTransportFields(getCapturedFetchCalls());

  clearRuntimeConfig();
  resetFetchCalls();
});

test('api client clears stale session on invalid token response', async () => {
  setRuntimeConfig({
    VITE_API_URL: 'https://api.test',
    VITE_APP_ENV: 'production'
  });
  installFetchMock({
    'GET /promocoes': () => ({ __mockError: true, status: 401, body: { error: { code: 'INVALID_TOKEN', message: 'Token expirado' } } })
  });

  const api = createApiClient();
  await assert.rejects(() => api.get('/promocoes'), /Token expirado/);

  const storedSession = window.localStorage.getItem('neuralhire.supabase.session');
  const storedToken = window.localStorage.getItem('neuralhire.supabase.access_token');
  assert.equal(storedSession, null);
  assert.equal(storedToken, null);

  clearRuntimeConfig();
  resetFetchCalls();
});
