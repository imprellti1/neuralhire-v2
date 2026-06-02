import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush, findButtonByText } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('whatsapp delivery dom', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations');
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [{ id: 'conv-1', contact_name: 'Ana', phone: '5511999999999', cliente_id: 'cli-1', status: 'open', last_message_at: '2026-06-02T10:00:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 }),
    'GET /whatsapp/conversations/conv-1/context': () => ({ conversation: { id: 'conv-1', status: 'open', phone: '5511999999999', contactName: 'Ana' }, customer: { clienteId: 'cli-1', nome: 'Ana' }, memory: {} }),
    'POST /message-drafts/generate': () => ({ draftId: 'draft-1', draft: 'Mensagem aprovada', confidence: 0.9, reason: 'ok', context: {} }),
    'POST /whatsapp-delivery/send': () => ({ ok: true, draftId: 'draft-1', conversationId: 'conv-1', externalMessageId: 'ext-1', status: 'sent' })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Enviar via WhatsApp/i);
  findButtonByText('Enviar via WhatsApp')?.click();
  await flush(); await flush();
  teardownFrontendDom(dom);
});
