import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush, findButtonByText } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('message drafts panel dom', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations');
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [{ id: 'conv-1', contact_name: 'Ana', phone: '5511999999999', cliente_id: 'cli-1', status: 'open', last_message_at: '2026-06-02T10:00:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 }),
    'GET /whatsapp/conversations/conv-1/context': () => ({
      conversation: { id: 'conv-1', status: 'open', phone: '5511999999999', contactName: 'Ana' },
      customer: { clienteId: 'cli-1', nome: 'Ana', empresa: 'Acme', cidade: 'Sao Paulo', uf: 'SP' },
      memory: { commercial: { totalPedidos: 1, totalComprado: 100, ticketMedio: 100, ultimaCompra: '2026-06-01T00:00:00.000Z', diasSemCompra: 130 }, behavior: { frequenciaCompra: 'alta', risco: 'baixo', potencial: 'alto' }, products: { recorrentes: ['Produto A'] }, opportunities: [{ title: 'Upsell' }], alerts: [], summary: 'Resumo comercial' }
    }),
    'POST /message-drafts/generate': () => ({ draftId: 'draft-1', draftType: 'reactivation', confidence: 92, reason: 'Oportunidade de reativacao', draft: 'Secretária do Igor: Olá...' })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Sugestão Comercial/i);
  assert.match(document.body.textContent, /Reativação|reactivation/i);
  assert.match(document.body.textContent, /Confiança/i);
  findButtonByText('Gerar Sugestão')?.click();
  await flush();
  await flush();
  findButtonByText('Copiar')?.click();
  teardownFrontendDom(dom);
});
