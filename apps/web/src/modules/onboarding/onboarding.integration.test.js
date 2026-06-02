import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOnboardingPage } from './onboarding.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('onboarding integration full progression', async () => {
  const dom = setupFrontendDom('#/onboarding');
  const apiClient = {
    get: async () => ({ ok: true, item: { current_step: 'welcome', completed_steps: [] } }),
    patch: async () => ({ ok: true }),
    post: async () => ({ ok: true })
  };
  await renderOnboardingPage(document.body, { apiClient });
  await flush();
  document.querySelector('#onb-next').click();
  await flush();
  document.querySelector('#onb-complete').click();
  await flush();
  assert.match(document.body.textContent, /Conta pronta para comecar/i);
  teardownFrontendDom(dom);
});
