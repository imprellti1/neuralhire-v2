import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock, assertNoSensitiveTransportFields } from '../../testing/mocks/api-client.mock.js';

test('whatsapp conversations route smoke', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations');
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [], total: 0, page: 1, limit: 20, totalPages: 1 })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /WhatsApp Inbox/i);
  assertNoSensitiveTransportFields();
  teardownFrontendDom(dom);
});
