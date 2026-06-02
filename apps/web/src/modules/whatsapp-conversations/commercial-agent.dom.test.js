import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush, findButtonByText } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('commercial agent dom', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations');
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [{ id: 'conv-1', contact_name: 'Ana', phone: '5511999999999', cliente_id: 'cli-1', status: 'open', last_message_at: '2026-06-02T10:00:00.000Z' }], total: 1, page: 1, limit: 20, totalPages: 1 }),
    'GET /whatsapp/conversations/conv-1/context': () => ({
      conversation: { id: 'conv-1', status: 'open', phone: '5511999999999', contactName: 'Ana' },
      customer: { clienteId: 'cli-1', nome: 'Ana', empresa: 'Acme', cidade: 'Sao Paulo', uf: 'SP' },
      memory: { commercial: { diasSemCompra: 147, totalPedidos: 3, totalComprado: 600, ticketMedio: 200 }, behavior: { frequenciaCompra: 'baixa', risco: 'alto', potencial: 'medio' }, products: { recorrentes: [{ nome: 'Toalha Master' }] }, manufacturers: { favoritos: [{ nome: 'Appel Home' }] }, opportunities: [], alerts: [], summary: 'Resumo comercial' }
    }),
    'GET /commercial-agent/conversation/conv-1': () => ({ item: { action_type: 'reactivation', confidence_score: 91, reason: 'Cliente está há 147 dias sem comprar.', recommendation: { summary: 'Entrar em contato para validar estoque e necessidade de reposição.', recommendedProducts: ['Toalha Master', 'Manta Fluffy'], recommendedManufacturers: ['Appel Home'] } } }),
    'POST /commercial-agent/analyze': () => ({ item: { action_type: 'reactivation', confidence_score: 91, reason: 'Cliente está há 147 dias sem comprar.', recommendation: { summary: 'Entrar em contato para validar estoque e necessidade de reposição.', recommendedProducts: ['Toalha Master', 'Manta Fluffy'], recommendedManufacturers: ['Appel Home'] } } }),
    'POST /message-drafts/generate': () => ({ draftId: 'draft-1', draftType: 'reactivation', confidence: 92, reason: 'Oportunidade de reativacao', draft: 'Mensagem sugerida' })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Agente Comercial/i);
  assert.match(document.body.textContent, /Próxima Melhor Ação|reactivation/i);
  assert.match(document.body.textContent, /Toalha Master/i);
  findButtonByText('Analisar')?.click();
  await flush();
  await flush();
  findButtonByText('Reanalisar')?.click();
  await flush();
  await flush();
  teardownFrontendDom(dom);
});
