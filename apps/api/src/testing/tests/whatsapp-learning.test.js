import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryEvolutionForTests, __resetMemoryEvolutionForTests } from '../../modules/integrations/evolution/evolution.repository.js';
import { __dumpMemoryWhatsappLearningForTests, __resetMemoryWhatsappLearningForTests, createLearningEvent } from '../../modules/whatsapp-learning/whatsapp-learning.repository.js';
import { runWhatsappLearningWorker } from '../../modules/whatsapp-learning/whatsapp-learning.service.js';

function parse(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }

async function call(app, body, headers = {}) {
  const webhookHeaders = process.env.NEURALHIRE_WEBHOOK_TOKEN
    ? { 'x-neuralhire-webhook-token': process.env.NEURALHIRE_WEBHOOK_TOKEN }
    : {};
  const req = createTestRequest({ method: 'POST', url: '/integrations/evolution/webhook', headers: { 'content-type': 'application/json', ...webhookHeaders, ...headers }, body: JSON.stringify(body) });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

function reset() {
  __resetMemoryEvolutionForTests();
  __resetMemoryWhatsappLearningForTests();
}

process.env.NEURALHIRE_WEBHOOK_TOKEN = process.env.NEURALHIRE_WEBHOOK_TOKEN || 'secret-token';

export function getWhatsappLearningTests() {
  return [
    {
      name: 'webhook cria evento pendente de aprendizagem',
      run: async () => {
        reset();
        __loadMemoryEvolutionForTests({ instances: [{ id: 'inst-1', account_id: 'acc-1', provider: 'evolution', instance_name: 'main', instance_type: 'operational', name: 'main', metadata: {} }] });
        const app = createApiApp();
        const out = await call(app, { provider: 'evolution', instance: 'main', event: 'messages.upsert', messageId: 'msg-1', remoteJid: '5511999999999@s.whatsapp.net', phone: '5511999999999', text: 'oi' }, { 'x-account-id': 'acc-1' });
        assert.equal(out.res.statusCode, 200);
        const events = __dumpMemoryWhatsappLearningForTests();
        assert.equal(events.length, 1);
        assert.equal(events[0].status, 'pending');
        assert.equal(events[0].whatsapp_message_id, 'msg-1');
      }
    },
    {
      name: 'evento nao duplica para a mesma mensagem',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'oi' }, { accountId: 'acc-1' });
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'oi' }, { accountId: 'acc-1' });
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
      }
    },
    {
      name: 'worker processa evento pendente e muda status para processed',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'preciso de orçamento de tapete 40x60 cinza' }, { accountId: 'acc-1' });
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 1);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'processed');
        assert.equal(updated.intent, 'quotation');
        assert.equal(updated.needs_followup, true);
      }
    },
    {
      name: 'worker registra erro e muda status para failed quando ocorrer falha',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: '__force_error__' }, { accountId: 'acc-1' });
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.failed, 1);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'failed');
        assert.ok(String(updated.error || '').includes('forced_learning_analysis_failure'));
      }
    },
    {
      name: 'classificacoes textuais básicas retornam intents esperados',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'oi' }, { accountId: 'acc-1' });
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-2', messageId: 'm2', body: 'não gostei do atraso' }, { accountId: 'acc-1' });
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const events = __dumpMemoryWhatsappLearningForTests();
        const greeting = events.find((item) => item.whatsapp_message_id === 'msg-1');
        const complaint = events.find((item) => item.whatsapp_message_id === 'msg-2');
        assert.equal(greeting.intent, 'greeting');
        assert.equal(greeting.sentiment, 'neutral');
        assert.equal(complaint.intent, 'complaint');
        assert.equal(complaint.sentiment, 'negative');
      }
    }
  ];
}
