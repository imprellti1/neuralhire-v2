import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCustomerMemoryPage } from './customer-memory.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('customer-memory page dom render cards resumo oportunidades alertas loading error empty', async () => {
  const dom = setupFrontendDom('#/x');
  let calls = 0;
  const apiClient = {
    get: async () => {
      calls += 1;
      if (calls === 1) throw new Error('fail');
      return { item: { commercial: { totalComprado: 52700, ticketMedio: 2380, diasSemCompra: 134 }, behavior: { risco: 'medio', potencial: 'alto' }, products: { recorrentes: ['Toalha Master'] }, manufacturers: { favoritos: [{ nome: 'Appel Home' }] }, opportunities: [{ title: 'Reposicao inverno', description: 'Cliente sem compra recente.' }], alerts: [{ title: 'Risco medio', description: 'Sem compras recentes.' }], summary: 'Cliente historicamente ativo.' } };
    },
    post: async () => ({ item: { commercial: { totalComprado: 52700, ticketMedio: 2380, diasSemCompra: 134 }, behavior: { risco: 'medio', potencial: 'alto' }, products: { recorrentes: ['Toalha Master'] }, manufacturers: { favoritos: [{ nome: 'Appel Home' }] }, opportunities: [], alerts: [], summary: 'Cliente historicamente ativo.' } })
  };
  await renderCustomerMemoryPage(document.body, { apiClient, clienteId: '1' });
  await flush();
  assert.match(document.body.textContent, /Erro ao carregar/i);
  document.querySelector('#cm-retry').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Customer Memory/i);
  assert.match(document.body.textContent, /Total Comprado: 52700/i);
  assert.match(document.body.textContent, /Reposicao inverno/i);
  teardownFrontendDom(dom);
});
