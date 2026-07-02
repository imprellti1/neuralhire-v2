import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../app.js';
import { flush, mockAuthenticatedSession, setHash, setupFrontendDom, teardownFrontendDom } from '../testing/frontend-test-helpers.js';
import { installFetchMock } from '../testing/mocks/api-client.mock.js';

test('shell autenticado usa scroll independente na sidebar e no conteúdo', async () => {
  const dom = setupFrontendDom('#/promocoes', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /promocoes': () => ({ items: [], total: 0 })
  });

  bootstrapWebApp();
  await flush();
  await flush();

  const shell = document.querySelector('.nh-shell');
  const sidebar = document.querySelector('.nh-sidebar');
  const main = document.querySelector('.nh-main');
  const style = document.getElementById('nh-app-style');

  assert.ok(shell);
  assert.ok(sidebar);
  assert.ok(main);
  assert.ok(style);
  assert.equal(document.body.classList.contains('nh-shell-active'), true);
  assert.match(style.textContent, /\.nh-shell\{display:grid;grid-template-columns:280px minmax\(0,1fr\);height:100vh;overflow:hidden;position:relative\}/);
  assert.match(style.textContent, /\.nh-sidebar\{height:100vh;overflow-y:auto;overscroll-behavior:contain;padding:22px 16px;border-right:1px solid var\(--line\);background:linear-gradient\(180deg,rgba\(12,22,39,.96\),rgba\(9,17,31,.92\)\)/);
  assert.match(style.textContent, /\.nh-main\{height:100vh;overflow-y:auto;overscroll-behavior:contain/);
  assert.match(document.querySelector('.nh-menu-heading')?.textContent || '', /Principal/);
  assert.ok(document.querySelector('[data-route="#/clientes"]'));
  assert.ok(document.querySelector('[data-route="#/auditoria"]'));
  assert.ok(document.querySelector('[data-route="#/auditoria-pedidos"]'));
  assert.equal(document.body.style.overflow, '');

  teardownFrontendDom(dom);
});

test('shell aplica modo imersivo no Cliente 360 e remove ao sair da rota', async () => {
  const dom = setupFrontendDom('#/clientes/c1', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({
    'GET /clientes/c1': () => ({ item: { id: 'c1', empresa: 'Cliente A', cidade: 'São Paulo', estado: 'SP', created_at: '2026-05-01T00:00:00.000Z', status: 'ativo' } }),
    'GET /clientes/c1/timeline': () => ({ items: [] }),
    'GET /pedidos': () => ({ items: [], pagination: { page: 1, totalPages: 1, total: 0, limit: 100 } })
  });

  bootstrapWebApp();
  await flush();
  await flush();

  const layout = document.querySelector('.nh-shell');
  const toggle = document.querySelector('[data-shell-toggle]');
  assert.ok(layout);
  assert.ok(toggle);
  assert.equal(layout.classList.contains('nh-shell--immersive'), true);
  assert.equal(toggle.style.display, 'inline-flex');
  assert.equal(document.querySelector('.nh-sidebar') !== null, true);
  assert.equal(document.querySelector('.nh-shell-backdrop') !== null, true);

  setHash('#/clientes');
  await flush();
  await flush();

  assert.equal(layout.classList.contains('nh-shell--immersive'), false);
  assert.equal(toggle.style.display, 'none');
  assert.equal(layout.classList.contains('is-sidebar-open'), false);

  teardownFrontendDom(dom);
});
