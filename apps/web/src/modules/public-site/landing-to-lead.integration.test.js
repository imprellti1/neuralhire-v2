import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('landing para lead integration', async () => {
  const dom = setupFrontendDom('#/', 'neuralhire.com.br');
  installFetchMock({ 'POST /interest-leads': () => ({ ok: true, item: { id: 'lead-1' } }) });
  bootstrapWebApp();
  await flush(); await flush();
  document.querySelector('input[name="nome"]').value = 'Ana';
  document.querySelector('input[name="empresa"]').value = 'Acme';
  document.querySelector('input[name="email"]').value = 'ana@acme.com';
  document.querySelector('#interest-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush(); await flush();
  assert.match(document.body.textContent, /Interesse registrado com sucesso/i);
  teardownFrontendDom(dom);
});
