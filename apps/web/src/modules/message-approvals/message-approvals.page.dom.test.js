import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, findButtonByText, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('message approvals dom', async () => {
  const dom = setupFrontendDom('#/message-approvals', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /message-approvals/pending': () => ({ items: [{ id: 'ap-1', draft_id: 'draft-1', cliente_id: 'cli-1', conversation_id: 'conv-1', status: 'pending', created_at: '2026-06-02T10:00:00.000Z' }], total: 1 }),
    'GET /message-approvals/ap-1': () => ({ item: { id: 'ap-1', draft_id: 'draft-1', cliente_id: 'cli-1', conversation_id: 'conv-1', status: 'pending', comment: 'resumo' } }),
    'POST /message-approvals/draft-1/approve': () => ({ item: { id: 'ap-1', status: 'approved' } }),
    'POST /message-approvals/draft-1/reject': () => ({ item: { id: 'ap-1', status: 'rejected' } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Aprovação Humana/i);
  findButtonByText('Aprovar')?.click();
  await flush(); await flush();
  teardownFrontendDom(dom);
});
