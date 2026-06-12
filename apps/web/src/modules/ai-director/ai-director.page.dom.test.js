import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAiDirectorPage } from './ai-director.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('ai director page dom', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  const calls = [];
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
        if (url === '/ai-director/memories') {
          return {
            items: [
              { id: '1', tipo: 'observacao', prioridade: 'alta', titulo: 'Clientes em risco aumentando', conteudo: 'O número de clientes em risco cresceu.', origem: 'diretor_ia', created_at: '2026-06-12T10:00:00.000Z' }
            ]
          };
        }
        return {};
      },
      post: async (url, payload) => {
        calls.push({ url, payload });
        return { item: { id: '2', ...payload } };
      }
    }
  });
  await flush();
  assert.match(document.body.textContent, /Diretor IA/);
  assert.match(document.body.textContent, /Saúde do Negócio/);
  assert.match(document.body.textContent, /Alertas Estratégicos/);
  assert.match(document.body.textContent, /Oportunidades/);
  assert.match(document.body.textContent, /Memória Estratégica/);
  assert.match(document.body.textContent, /Clientes em risco aumentando/);
  assert.match(document.body.textContent, /Pergunte ao Diretor/);
  document.querySelector('#ai-director-memory-titulo').value = 'Nova observacao';
  document.querySelector('#ai-director-memory-conteudo').value = 'Conteudo novo';
  document.querySelector('#ai-director-memory-submit').click();
  await flush();
  await flush();
  assert.equal(calls[0].url, '/ai-director/memories');
  teardownFrontendDom(dom);
});
