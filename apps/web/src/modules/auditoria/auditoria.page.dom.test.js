import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('auditoria: render, filtros, vazio, erro e detalhe', async () => {
  const dom = setupFrontendDom('#/auditoria', 'app.neuralhire.com.br');
  mockAuthenticatedSession({ user: { id: 'u1', email: 'auditor@x.com' } });
  installFetchMock({
    'GET /audit-logs': () => ({ ok: true, items: [{ id: 'log-1', created_at: '2026-06-08T10:00:00Z', user_nome: 'Auditor', modulo: 'produtos', acao: 'criar', entidade: 'produto', status: 'success', descricao: 'Produto criado', request_id: 'req-1' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
    'GET /audit-logs/log-1': () => ({ ok: true, item: { id: 'log-1', descricao: 'Produto criado', request_id: 'req-1', metadata: { ok: true }, erro_codigo: null, erro_mensagem: null, ip: '127.0.0.1', user_agent: 'UA' } })
  });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Auditoria/);
  document.querySelector('[data-id="log-1"]')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /RequestId/);
  teardownFrontendDom(dom);
});

test('auditoria: estado vazio e erro', async () => {
  const dom = setupFrontendDom('#/auditoria', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /audit-logs': () => ({ ok: true, items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Nenhum log encontrado/);
  teardownFrontendDom(dom);

  const domErr = setupFrontendDom('#/auditoria', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  installFetchMock({ 'GET /audit-logs': () => ({ __mockError: true, status: 500, body: { error: { message: 'erro' } } }) });
  bootstrapWebApp();
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar os logs/);
  teardownFrontendDom(domErr);
});
