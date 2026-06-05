import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, findButtonByText, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('action aware drafts dom', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [{ id: 'conv-1', contact_name: 'Ana', phone: '5511999999999', cliente_id: 'cli-1', status: 'open', last_message_at: '2026-06-02T10:00:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 }),
    'GET /whatsapp/conversations/conv-1/context': () => ({
      conversation: { id: 'conv-1', status: 'open', phone: '5511999999999', contactName: 'Ana' },
      customer: { clienteId: 'cli-1', nome: 'Ana', empresa: 'Acme', cidade: 'Sao Paulo', uf: 'SP' },
      memory: { commercial: { diasSemCompra: 147, totalPedidos: 3, totalComprado: 600, ticketMedio: 200 }, behavior: { frequenciaCompra: 'baixa', risco: 'alto', potencial: 'medio' }, products: { recorrentes: [{ nome: 'Toalha Master' }] }, manufacturers: { favoritos: [{ nome: 'Appel Home' }] }, opportunities: [], alerts: [], summary: 'Resumo comercial' }
    }),
    'POST /message-drafts/generate': () => ({ draftId: 'draft-1', draftType: 'reactivation', confidence: 92, reason: 'Oportunidade de reativacao', action: { id: 'act-1', type: 'reactivation', confidence: 91, reason: 'Cliente está há 147 dias sem comprar.' }, draft: 'Secretária do Igor: Olá...' })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Baseado na Ação/i);
  assert.match(document.body.textContent, /Confiança da ação/i);
  findButtonByText('Gerar Sugestão')?.click();
  await flush();
  await flush();
  teardownFrontendDom(dom);
});
