import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('executive portfolio analytics route smoke', async () => {
  const dom = setupFrontendDom('#/executive-portfolio-analytics');
  const previousHash = window.location.hash;
  document.body.innerHTML = '';
  window.location.hash = '#/executive-portfolio-analytics';
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Executive Portfolio Analytics/i);
  window.location.hash = previousHash;
  teardownFrontendDom(dom);
});
