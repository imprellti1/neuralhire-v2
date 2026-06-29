import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { __dumpMemoryEvolution, __loadMemoryEvolutionForTests, __resetMemoryEvolutionForTests } from '../../modules/integrations/evolution/evolution.repository.js';
import { __dumpMemoryWhatsappLearningForTests, __resetMemoryWhatsappLearningForTests } from '../../modules/whatsapp-learning/whatsapp-learning.repository.js';

function parse(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, body, headers = {}) {
  const webhookHeaders = process.env.NEURALHIRE_WEBHOOK_TOKEN
    ? { 'x-neuralhire-webhook-token': process.env.NEURALHIRE_WEBHOOK_TOKEN }
    : {};
  const req = createTestRequest({ method: 'POST', url: '/integrations/evolution/webhook', headers: { 'content-type': 'application/json', ...webhookHeaders, ...headers }, body: JSON.stringify(body) });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

function resetState() {
  __resetMemoryClientesForTests();
  __resetMemoryTimelineForTests();
  __resetMemoryEvolutionForTests();
  __resetMemoryWhatsappLearningForTests();
}

function withWebhookToken(token, fn) {
  const previous = process.env.NEURALHIRE_WEBHOOK_TOKEN;
  if (token === undefined) {
    delete process.env.NEURALHIRE_WEBHOOK_TOKEN;
  } else {
    process.env.NEURALHIRE_WEBHOOK_TOKEN = token;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (previous === undefined) {
        delete process.env.NEURALHIRE_WEBHOOK_TOKEN;
      } else {
        process.env.NEURALHIRE_WEBHOOK_TOKEN = previous;
      }
    });
}

process.env.NEURALHIRE_WEBHOOK_TOKEN = process.env.NEURALHIRE_WEBHOOK_TOKEN || 'secret-token';

function seedClientes(items) {
  __loadMemoryClientes(items.map((item, idx) => ({
    id: item.id || `cli-${idx + 1}`,
    account_id: item.account_id,
    nome: item.nome,
    telefone: item.telefone || null,
    celular: item.celular || null,
    whatsapp: item.whatsapp || null,
    documento: item.documento || null,
    ativo: true,
    metadata: {}
  })));
}

function seedInstances(items) {
  const snapshot = __dumpMemoryEvolution();
  __loadMemoryEvolutionForTests({
    messages: snapshot.messages,
    conversations: snapshot.conversations,
    leads: snapshot.leads,
    instances: items.map((item, idx) => ({
      id: item.id || `inst-${idx + 1}`,
      account_id: item.account_id,
      provider: item.provider || 'evolution',
      instance_name: item.instance_name,
      instance_type: item.instance_type || 'operational',
      name: item.name || item.instance_name,
      metadata: item.metadata || {}
    }))
  });
}

export function getEvolutionWebhookTests() {
  return [
    {
      name: 'webhook normalizado do n8n resolve account_id via whatsapp_instances',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        seedInstances([{ account_id: 'acc-evo-1', instance_name: 'main', instance_type: 'operational' }]);
        const app = createApiApp();
        const out = await call(app, {
          provider: 'evolution',
          instance: 'main',
          instanceType: 'operational',
          event: 'messages.upsert',
          direction: 'inbound',
          messageId: 'm-n8n-1',
          remoteJid: '5511999999999@s.whatsapp.net',
          phone: '5511999999999',
          text: 'Olá do n8n',
          timestamp: '2026-06-29T12:00:00.000Z',
          raw: {
            event: 'messages.upsert',
            data: {
              message: {
                key: { id: 'm-n8n-1', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' },
                message: { conversation: 'Olá do n8n' }
              }
            }
          }
        });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(out.body.status, 'created');
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages.length, 1);
        assert.equal(state.messages[0].account_id, 'acc-evo-1');
        assert.equal(state.messages[0].instance_id, 'inst-1');
        assert.equal(state.messages[0].message_id, 'm-n8n-1');
        assert.equal(state.messages[0].phone, '5511999999999');
        assert.equal(state.messages[0].conversation_id, state.conversations[0].id);
        assert.equal(state.messages[0].event_type, 'messages.upsert');
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
        assert.equal(__dumpMemoryWhatsappLearningForTests()[0].status, 'pending');
        assert.equal(state.conversations[0].phone, '5511999999999');
        assert.equal(state.conversations[0].instance_id, 'inst-1');
        assert.equal(state.conversations[0].cliente_id, 'cli-1');
      }
    },
    {
      name: 'payload normalizado corrige eventType e messageId quando faltam campos do Evolution original',
      run: async () => {
        resetState();
        seedInstances([{ account_id: 'acc-evo-1', instance_name: 'main', instance_type: 'learning' }]);
        const app = createApiApp();
        const out = await call(app, {
          provider: 'evolution',
          instance: 'main',
          instanceType: 'learning',
          direction: 'outbound',
          messageId: 'm-n8n-2',
          remoteJid: '5511777777777@s.whatsapp.net',
          phone: '5511777777777',
          text: 'Mensagem normalizada',
          timestamp: '2026-06-29T12:01:00.000Z',
          raw: { foo: 'bar' }
        });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(out.body.eventType, 'messages.upsert');
        assert.equal(out.body.messageId, 'm-n8n-2');
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].metadata.instance_type, 'learning');
        assert.equal(state.messages[0].phone, '5511777777777');
        assert.equal(state.conversations[0].phone, '5511777777777');
        assert.equal(state.leads.length, 1);
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
      }
    },
    {
      name: 'fallback de phone usa remoteJid quando phone estiver vazio',
      run: async () => {
        resetState();
        seedInstances([{ account_id: 'acc-evo-1', instance_name: 'main', instance_type: 'operational' }]);
        const app = createApiApp();
        const out = await call(app, {
          provider: 'evolution',
          instance: 'main',
          instanceType: 'operational',
          event: 'messages.upsert',
          direction: 'inbound',
          messageId: 'm-n8n-remotejid-1',
          remoteJid: '555199640252@s.whatsapp.net',
          phone: '',
          text: 'Olá do remoteJid',
          timestamp: '2026-06-29T12:02:00.000Z',
          raw: {
            event: 'messages.upsert',
            data: {
              message: {
                key: { id: 'm-n8n-remotejid-1', fromMe: false, remoteJid: '555199640252@s.whatsapp.net' },
                message: { conversation: 'Olá do remoteJid' }
              }
            }
          }
        });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].phone, '555199640252');
        assert.equal(state.conversations[0].phone, '555199640252');
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
      }
    },
    {
      name: 'webhook idempotente reaproveita conversation_id da conversa persistida',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        seedInstances([{ account_id: 'acc-evo-1', instance_name: 'main', instance_type: 'operational' }]);
        const app = createApiApp();
        await call(app, {
          provider: 'evolution',
          instance: 'main',
          instanceType: 'operational',
          event: 'messages.upsert',
          direction: 'inbound',
          messageId: 'm-n8n-idem-1',
          remoteJid: '5511999999999@s.whatsapp.net',
          phone: '5511999999999',
          text: 'Mensagem 1',
          timestamp: '2026-06-29T12:03:00.000Z'
        });
        await call(app, {
          provider: 'evolution',
          instance: 'main',
          instanceType: 'operational',
          event: 'messages.upsert',
          direction: 'inbound',
          messageId: 'm-n8n-idem-1',
          remoteJid: '5511999999999@s.whatsapp.net',
          phone: '5511999999999',
          text: 'Mensagem 1',
          timestamp: '2026-06-29T12:03:00.000Z'
        });
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages.length, 1);
        assert.equal(state.messages[0].conversation_id, state.conversations[0].id);
        assert.equal(state.conversations[0].phone, '5511999999999');
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
      }
    },
    {
      name: 'payload envelopado do n8n é normalizado pelo body',
      run: async () => {
        resetState();
        seedInstances([{ account_id: 'acc-evo-1', instance_name: 'projeto-representantes', instance_type: 'operational' }]);
        const app = createApiApp();
        const out = await call(app, {
          body: {
            provider: 'evolution',
            instance: 'projeto-representantes',
            instanceType: 'operational',
            event: 'messages.upsert',
            messageId: 'm-envelope-1',
            remoteJid: '5511999999999@s.whatsapp.net',
            phone: '5511999999999',
            text: 'Olá'
          }
        });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(out.body.eventType, 'messages.upsert');
        assert.equal(out.body.messageId, 'm-envelope-1');
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages.length, 1);
        assert.equal(state.messages[0].message_id, 'm-envelope-1');
        assert.equal(state.messages[0].instance_id, 'inst-1');
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
      }
    },
    {
      name: 'webhook aceita token valido',
      run: async () => {
        resetState();
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm-valid', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
      }
    },
    {
      name: 'webhook rejeita token invalido',
      run: async () => {
        await withWebhookToken('secret-token', async () => {
          resetState();
          const app = createApiApp();
          const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm-invalid', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1', 'x-neuralhire-webhook-token': 'wrong-token' });
          assert.equal(out.res.statusCode, 401);
          assert.deepStrictEqual(out.body, {
            ok: false,
            error: {
              code: 'INVALID_WEBHOOK_TOKEN',
              message: 'Token inválido.'
            }
          });
        });
      }
    },
    {
      name: 'webhook retorna erro quando token nao configurado',
      run: async () => {
        await withWebhookToken(undefined, async () => {
          resetState();
          const app = createApiApp();
          const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm-missing', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
          assert.equal(out.res.statusCode, 500);
          assert.deepStrictEqual(out.body, {
            ok: false,
            error: {
              code: 'WEBHOOK_TOKEN_NOT_CONFIGURED',
              message: 'Webhook token não configurado.'
            }
          });
        });
      }
    },
    {
      name: 'cliente encontrado por numero completo',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { instance_name: 'main', message: { key: { id: 'm1', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.body.status, 'created');
        const state = __dumpMemoryEvolution();
        assert.equal(state.conversations.length, 1);
        assert.equal(state.conversations[0].cliente_id, 'cli-1');
        assert.equal(state.messages[0].cliente_id, 'cli-1');
      }
    },
    {
      name: 'cliente encontrado sem DDI 55',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '11999999999' }]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm2', fromMe: false, remoteJid: '5511999999999@c.us' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.body.status, 'created');
        const state = __dumpMemoryEvolution();
        assert.equal(state.conversations[0].cliente_id, 'cli-1');
      }
    },
    {
      name: 'cliente encontrado por ultimos digitos',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511987654321' }]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm3', fromMe: false, remoteJid: '987654321@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.body.status, 'created');
        const state = __dumpMemoryEvolution();
        assert.equal(state.conversations[0].cliente_id, 'cli-1');
      }
    },
    {
      name: 'match ambíguo cria lead',
      run: async () => {
        resetState();
        seedClientes([
          { account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' },
          { account_id: 'acc-evo-1', id: 'cli-2', nome: 'Bia', telefone: '5511999999999' }
        ]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm4', fromMe: false, remoteJid: '11999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.body.status, 'created');
        const state = __dumpMemoryEvolution();
        assert.equal(state.leads.length, 1);
        assert.equal(state.conversations[0].lead_id, state.leads[0].id);
      }
    },
    {
      name: 'cliente nao encontrado cria lead',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511888888888' }]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm5', fromMe: false, remoteJid: '5511777777777@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.body.status, 'created');
        const state = __dumpMemoryEvolution();
        assert.equal(state.leads.length, 1);
        assert.equal(state.conversations[0].lead_id, state.leads[0].id);
      }
    },
    {
      name: 'conversa existente e reutilizada',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm6', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm7', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi2' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        const state = __dumpMemoryEvolution();
        assert.equal(state.conversations.length, 1);
        assert.equal(state.messages.length, 2);
      }
    },
    {
      name: 'mensagem ja existente mas sem vínculo é anexada',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm8', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        const stateBefore = __dumpMemoryEvolution();
        __loadMemoryEvolutionForTests({
          messages: [{ ...stateBefore.messages[0], conversation_id: null, cliente_id: null, lead_id: null }],
          conversations: stateBefore.conversations,
          leads: stateBefore.leads
        });
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm8', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.body.status, 'already_exists');
        const after = __dumpMemoryEvolution();
        assert.equal(after.messages[0].conversation_id, after.conversations[0].id);
      }
    },
    {
      name: 'inbound gera timeline quando cliente existe',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm9', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].direction, 'inbound');
      }
    },
    {
      name: 'outbound gera timeline quando cliente existe',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm10', fromMe: true, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].direction, 'outbound');
      }
    },
    {
      name: 'falha na timeline nao derruba webhook',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm11', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
      }
    },
    {
      name: 'webhook operational preserva instance_type',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm12', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1', 'x-instance-type': 'operational' });
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].metadata.instance_type, 'operational');
        assert.equal(state.messages[0].metadata.learning_only, false);
        assert.equal(state.conversations[0].metadata.instance_type, 'operational');
        assert.equal(state.leads.length, 0);
      }
    },
    {
      name: 'webhook learning preserva metadata de aprendizado',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511888888888' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm13', fromMe: false, remoteJid: '5511777777777@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1', 'x-instance-type': 'learning' });
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].metadata.instance_type, 'learning');
        assert.equal(state.messages[0].metadata.learning_only, true);
        assert.equal(state.conversations[0].metadata.instance_type, 'learning');
        assert.equal(state.leads[0].metadata.instance_type, 'learning');
      }
    },
    {
      name: 'ausencia de header assume operational',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm14', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1' });
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].metadata.instance_type, 'operational');
      }
    },
    {
      name: 'header invalido cai para operational',
      run: async () => {
        resetState();
        seedClientes([{ account_id: 'acc-evo-1', id: 'cli-1', nome: 'Ana', telefone: '5511999999999' }]);
        const app = createApiApp();
        const out = await call(app, { event: 'messages.upsert', data: { message: { key: { id: 'm15', fromMe: false, remoteJid: '5511999999999@s.whatsapp.net' }, message: { conversation: 'oi' } } } }, { 'x-test-role': 'admin', 'x-test-account-id': 'acc-evo-1', 'x-instance-type': 'qualquer-coisa' });
        assert.equal(out.body.ok, true);
        const state = __dumpMemoryEvolution();
        assert.equal(state.messages[0].metadata.instance_type, 'operational');
      }
    }
  ];
}
