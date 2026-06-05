import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom, setHash } from './frontend-test-helpers.js';
import { installFetchMock } from './mocks/api-client.mock.js';

test('jornada comercial routes smoke', async () => {
  const dom = setupFrontendDom('#/', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'POST /interest-leads': () => ({ ok: true, item: { id: 'l1' } }),
    'GET /interest-leads': () => ({ ok: true, items: [{ id: 'l1', nome: 'Ana', empresa: 'Acme', status: 'novo' }] }),
    'GET /interest-leads/l1': () => ({ ok: true, item: { id: 'l1', nome: 'Ana', empresa: 'Acme', status: 'novo' } }),
    'GET /interest-leads/l1/events': () => ({ ok: true, items: [] }),
    'GET /interest-leads/launch-dashboard': () => ({ ok: true, totalInteressados: 1, totalElegiveis: 1, totalAgendados: 0, totalConvertidos: 0 }),
    'GET /launch/templates': () => ({ ok: true, items: [] }),
    'GET /billing/plans': () => ({ ok: true, items: [{ code: 'starter', name: 'Starter' }] }),
    'GET /accounts/acc-demo/onboarding': () => ({ ok: true, item: { current_step: 'welcome', completed_steps: [] } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Lista de Interesse/i);
  setHash('#/interest-leads'); await flush(); await flush(); assert.match(document.body.textContent, /Lista de Interesse/i);
  setHash('#/interest-leads/l1'); await flush(); await flush(); assert.match(document.body.textContent, /Ana|Acme/i);
  setHash('#/interest-leads/launch'); await flush(); await flush(); assert.match(document.body.textContent, /Lançamento|Lancamento/i);
  setHash('#/billing'); await flush(); await flush(); assert.match(document.body.textContent, /Billing|Starter/i);
  setHash('#/onboarding'); await flush(); await flush(); assert.match(document.body.textContent, /Onboarding/i);
  teardownFrontendDom(dom);
});
