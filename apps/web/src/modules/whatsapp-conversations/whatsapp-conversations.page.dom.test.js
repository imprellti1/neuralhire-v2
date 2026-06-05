import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, findButtonByText, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('whatsapp conversations dom', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [{ id: 'conv-1', contact_name: 'Ana', phone: '5511999999999', cliente_id: 'cli-1', status: 'open', last_message_at: '2026-06-02T10:00:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 }),
    'GET /whatsapp/conversations/conv-1/context': () => ({
      conversation: { id: 'conv-1', status: 'open', phone: '5511999999999', contactName: 'Ana' },
      customer: { clienteId: 'cli-1', nome: 'Ana', empresa: 'Acme', cidade: 'Sao Paulo', uf: 'SP' },
      memory: { commercial: { totalPedidos: 1, totalComprado: 100, ticketMedio: 100, ultimaCompra: '2026-06-01T00:00:00.000Z', diasSemCompra: 1 }, behavior: { frequenciaCompra: 'alta', risco: 'baixo', potencial: 'alto' }, products: { recorrentes: ['Produto A'], maisComprados: [{ nome: 'Produto A', quantidade: 1 }] }, manufacturers: { favoritos: [{ nome: 'Marca A', quantidade: 1 }] }, opportunities: [{ title: 'Upsell', description: 'Oportunidade' }], alerts: [{ title: 'Alerta', description: 'Atenção' }], summary: 'Resumo comercial' }
    }),
    'POST /customer-memory/cli-1/rebuild': () => ({ ok: true }),
    'GET /whatsapp/conversations/conv-1/draft-state': () => ({ conversation: { id: 'conv-1' }, draft: { id: 'draft-1', status: 'generated', draft: 'Mensagem sugerida' }, approval: { status: 'pending', reviewer: null, comment: null }, delivery: { status: 'not_sent' } }),
    'POST /message-approvals/draft-1/approve': () => ({ item: { id: 'ap-1', status: 'approved' } }),
    'POST /message-approvals/draft-1/reject': () => ({ item: { id: 'ap-1', status: 'rejected' } })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /WhatsApp Inbox/i);
  assert.match(document.body.textContent, /Customer Memory/i);
  assert.match(document.body.textContent, /Resumo Comercial/i);
  assert.match(document.body.textContent, /Workflow Comercial/i);
  findButtonByText('Recalcular Memória')?.click();
  await flush();
  await flush();
  teardownFrontendDom(dom);
});
