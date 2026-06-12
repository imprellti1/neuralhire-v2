import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAiDirectorPage } from './ai-director.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('ai director page dom', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  await renderAiDirectorPage(document.body, {
    apiClient: {
      get: async (url) => {
        if (url === '/ai-director/dashboard') {
          return {
            health: {
              receita_mes: 124550,
              pedidos_mes: 358,
              clientes_ativos: 78,
              clientes_risco: 15
            },
            alerts: [{ severity: 'high', title: 'Faturamento caiu 18% nos últimos 15 dias' }],
            opportunities: [{ title: '12 clientes demonstraram intenção de compra' }]
          };
        }
        return {};
      }
    }
  });
  await flush();
  assert.match(document.body.textContent, /Diretor IA/);
  assert.match(document.body.textContent, /Saúde do Negócio/);
  assert.match(document.body.textContent, /Alertas Estratégicos/);
  assert.match(document.body.textContent, /Oportunidades/);
  assert.match(document.body.textContent, /Pergunte ao Diretor/);
  teardownFrontendDom(dom);
});
