import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createProdutoCategoria, __resetMemoryProdutoCategorias } from '../../modules/produto-categorias/produto-categorias.repository.js';

function parseBody(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }

async function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getProdutoCategoriasTests() {
  return [
    { name: 'lista categorias por tenant', run: async () => { __resetMemoryProdutoCategorias(); await createProdutoCategoria({ nome: 'Cat A' }, { accountId: 'acc-a' }); await createProdutoCategoria({ nome: 'Cat B' }, { accountId: 'acc-b' }); const app = createApiApp(); const out = await call(app, { method: 'GET', url: '/produto-categorias', role: 'admin', accountId: 'acc-a' }); assert.equal(out.body.items.length, 1); assert.equal(out.body.items[0].account_id, 'acc-a'); } },
    { name: 'cria categoria com slug automatico', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const out = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Mesa Posta' } }); assert.equal(out.body.item.slug, 'mesa-posta'); } },
    { name: 'rejeita nome vazio', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const out = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: ' ' } }); assert.equal(out.res.statusCode, 400); assert.equal(out.body.error.code, 'BAD_REQUEST'); } },
    { name: 'rejeita duplicidade no mesmo tenant', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Mesa Posta' } }); const out = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Mesa Posta' } }); assert.equal(out.res.statusCode, 409); assert.equal(out.body.error.code, 'PRODUTO_CATEGORIA_DUPLICADA'); } },
    { name: 'permite mesmo slug em outro tenant', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Mesa Posta' } }); const out = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-b', body: { nome: 'Mesa Posta' } }); assert.equal(out.res.statusCode, 200); } },
    { name: 'atualiza nome descricao status', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const created = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Cat A' } }); const out = await call(app, { method: 'PATCH', url: `/produto-categorias/${created.body.item.id}`, role: 'admin', accountId: 'acc-a', body: { nome: 'Cat B', descricao: 'Nova', status: 'inativo' } }); assert.equal(out.body.item.nome, 'Cat B'); assert.equal(out.body.item.status, 'inativo'); } },
    { name: 'valida parent no mesmo tenant', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const parent = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Pai' } }); const child = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Filho', parent_id: parent.body.item.id } }); assert.equal(child.body.item.parent_id, parent.body.item.id); } },
    { name: 'rejeita parent cross tenant', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const parent = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Pai' } }); const out = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-b', body: { nome: 'Filho', parent_id: parent.body.item.id } }); assert.equal(out.res.statusCode, 404); assert.equal(out.body.error.code, 'NOT_FOUND'); } },
    { name: 'rejeita auto parent', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const created = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Auto' } }); const out = await call(app, { method: 'PATCH', url: `/produto-categorias/${created.body.item.id}`, role: 'admin', accountId: 'acc-a', body: { parent_id: created.body.item.id } }); assert.equal(out.res.statusCode, 400); } },
    { name: 'delete inativa categoria', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const created = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-a', body: { nome: 'Cat' } }); const out = await call(app, { method: 'DELETE', url: `/produto-categorias/${created.body.item.id}`, role: 'admin', accountId: 'acc-a' }); assert.equal(out.body.item.status, 'inativo'); } },
    { name: 'nao aceita account_id no body', run: async () => { __resetMemoryProdutoCategorias(); const app = createApiApp(); const out = await call(app, { method: 'POST', url: '/produto-categorias', role: 'admin', accountId: 'acc-safe', body: { nome: 'Cat', account_id: 'evil', tenant_id: 'evil', owner_user_id: 'evil' } }); assert.equal(out.body.item.account_id, 'acc-safe'); } }
  ];
}
