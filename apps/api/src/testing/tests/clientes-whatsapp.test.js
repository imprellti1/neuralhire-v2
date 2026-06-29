import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryWhatsappConversationsForTests, createConversation, addMessage } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';

export function getClientesWhatsappTests() {
  return [{
    name: 'endpoints whatsapp do cliente respeitam tenant, vínculo e ordenação',
    run: async () => {
      __resetMemoryWhatsappConversationsForTests();
      const app = createApiApp();
      const accountId = 'acc-whatsapp';
      const otherAccountId = 'acc-other';
      const conversation = await createConversation({ phone: '11999999999', clienteId: 'cli-1', contactName: 'Ana', instanceType: 'operational', instanceName: 'evo-1' }, { accountId });
      await addMessage(conversation.id, { direction: 'inbound', body: 'olá', senderType: 'customer', status: 'received' }, { accountId });
      await addMessage(conversation.id, { direction: 'outbound', body: 'oi', senderType: 'agent', status: 'sent' }, { accountId });
      conversation.last_message_at = '2026-06-12T10:00:00.000Z';
      conversation.last_message_preview = 'oi';
      conversation.message_count = 2;
      conversation.direction_last_message = 'outbound';

      let req = createTestRequest({ method: 'GET', url: '/clientes/cli-1/whatsapp/conversations', headers: { 'x-test-role': 'admin', 'x-test-account-id': accountId } });
      let res = createTestResponse();
      await app(req, res);
      assert.equal(res.statusCode, 200);
      let payload = JSON.parse(res.body);
      let items = (payload.data || payload.item || payload).items;
      assert.equal(items.length, 1);
      assert.equal(items[0].id, conversation.id);
      assert.equal(items[0].instance_type, 'operational');

      req = createTestRequest({ method: 'GET', url: `/clientes/cli-1/whatsapp/conversations/${conversation.id}/messages`, headers: { 'x-test-role': 'admin', 'x-test-account-id': accountId } });
      res = createTestResponse();
      await app(req, res);
      assert.equal(res.statusCode, 200);
      payload = JSON.parse(res.body);
      items = (payload.data || payload.item || payload).items;
      assert.equal(items.length, 2);
      assert.equal(items[0].text, 'olá');
      assert.equal(items[1].direction, 'outbound');

      req = createTestRequest({ method: 'GET', url: '/clientes/cli-1/whatsapp/conversations', headers: { 'x-test-role': 'admin', 'x-test-account-id': otherAccountId } });
      res = createTestResponse();
      await app(req, res);
      assert.equal(res.statusCode, 200);
      payload = JSON.parse(res.body);
      items = (payload.data || payload.item || payload).items;
      assert.equal(items.length, 0);
    }
  }];
}
