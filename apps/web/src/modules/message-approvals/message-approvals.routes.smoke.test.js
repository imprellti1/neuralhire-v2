import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('message approvals route smoke', async () => {
  const dom = setupFrontendDom('#/message-approvals');
  installFetchMock({ 'GET /message-approvals/pending': () => ({ items: [], total: 0 }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Aprovação Humana/i);
  teardownFrontendDom(dom);
});
