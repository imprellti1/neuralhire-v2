import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush, findButtonByText } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('whatsapp conversations customer memory dom', async () => {
  const dom = setupFrontendDom('#/whatsapp-conversations');
  installFetchMock({
    'GET /whatsapp/conversations': () => ({ items: [{ id: 'conv-1', contact_name: 'Ana', phone: '5511999999999', status: 'open' }], total: 1, page: 1, limit: 20, totalPages: 1 }),
    'GET /whatsapp/conversations/conv-1/context': () => ({
      conversation: { id: 'conv-1', status: 'open', phone: '5511999999999', contactName: 'Ana' },
      customer: { clienteId: 'cli-1', nome: 'Ana', empresa: 'Acme', cidade: 'Sao Paulo', uf: 'SP' },
      memory: {
        commercial: { totalPedidos: 4, totalComprado: 1200, ticketMedio: 300, ultimaCompra: '2026-06-01T00:00:00.000Z', diasSemCompra: 1 },
        behavior: { frequenciaCompra: 'alta', risco: 'medio', potencial: 'alto' },
        products: { recorrentes: ['Toalha'], maisComprados: [{ nome: 'Toalha', quantidade: 5 }] },
        manufacturers: { favoritos: [{ nome: 'Marca A', quantidade: 5 }] },
        opportunities: [{ title: 'Cliente recorrente', description: 'Aproveitar recorrencia.' }],
        alerts: [{ title: 'Sem pedidos recentes', description: 'Em acompanhamento.' }],
        summary: 'Cliente recorrente com potencial alto.'
      }
    }),
    'POST /customer-memory/cli-1/rebuild': () => ({ ok: true })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Customer Memory/i);
  assert.match(document.body.textContent, /Cliente recorrente/i);
  findButtonByText('Recalcular Memória')?.click();
  await flush();
  await flush();
  teardownFrontendDom(dom);
});
