import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('ai director route smoke', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /ai-director/overview': () => ({ gerentes: [], eventosRecentes: [], recomendacoesPendentes: [], contadoresPorCriticidade: { baixa: 0, media: 0, alta: 0, critica: 0 }, contadoresPorStatus: { novo: 0, lido: 0, arquivado: 0 } }),
    'GET /ai-director/agents': () => ({ items: [] }),
    'GET /ai-director/events': () => ({ items: [] }),
    'GET /ai-director/recommendations': () => ({ items: [] })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Diretor IA/);
  teardownFrontendDom(dom);
});
