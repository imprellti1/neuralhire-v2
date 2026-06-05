import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('app host root redirects to login without session', async () => {
  const dom = setupFrontendDom('#/', 'app.neuralhire.com.br');

  bootstrapWebApp();
  await flush();
  await flush();

  assert.equal(window.location.hash, '#/login');
  assert.match(document.body.textContent, /Entrar/i);

  teardownFrontendDom(dom);
});
