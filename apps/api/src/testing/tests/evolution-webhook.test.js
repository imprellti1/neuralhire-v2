import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { __dumpMemoryEvolution, __loadMemoryEvolutionForTests, __resetMemoryEvolutionForTests } from '../../modules/integrations/evolution/evolution.repository.js';

function parse(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, body, headers = {}) {
  const req = createTestRequest({ method: 'POST', url: '/integrations/evolution/webhook', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

function resetState() {
  __resetMemoryClientesForTests();
  __resetMemoryTimelineForTests();
  __resetMemoryEvolutionForTests();
}

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

export function getEvolutionWebhookTests() {
  return [
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
