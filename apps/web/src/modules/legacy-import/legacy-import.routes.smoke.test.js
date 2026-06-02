import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('legacy import route smoke', async () => {
  const dom = setupFrontendDom('#/legacy-import');
  installFetchMock({
    'GET /legacy-import/status': () => ({ enabled: true, environment: 'development', supportedEntities: ['clientes'], mode: 'preview', warnings: [] })
  });
  bootstrapWebApp();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Importacao Legado/);
  teardownFrontendDom(dom);
});
