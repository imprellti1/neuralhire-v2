import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetSystemJobsForTests, __setSystemJobsSupabaseClientForTests } from '../../modules/jobs/jobs.repository.js';

function parse(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role = 'admin', accountId = 'acc-admin' } = {}) {
  const req = createTestRequest({ method, url, headers: { authorization: 'Bearer test-token', 'x-test-role': role, 'x-test-account-id': accountId, 'x-test-user-id': 'user-1' } });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

export function getJobsAdminTests() {
  return [
    { name: 'GET /jobs lista jobs', run: async () => { __resetSystemJobsForTests(); __setSystemJobsSupabaseClientForTests(null, false); const app = createApiApp(); const out = await call(app, { method: 'GET', url: '/jobs' }); assert.equal(out.res.statusCode, 200); assert.equal(out.body.ok, true); assert.ok(Array.isArray(out.body.items)); } },
    { name: 'GET /jobs/runs lista execucoes com filtros', run: async () => { __resetSystemJobsForTests(); __setSystemJobsSupabaseClientForTests(null, false); const app = createApiApp(); const out = await call(app, { method: 'GET', url: '/jobs/runs?nome=radar_comercial_diario&status=success&limit=5' }); assert.equal(out.res.statusCode, 200); assert.equal(out.body.ok, true); assert.ok(Array.isArray(out.body.items)); } },
    { name: 'GET /jobs/:id retorna detalhe', run: async () => { __resetSystemJobsForTests(); __setSystemJobsSupabaseClientForTests(null, false); const app = createApiApp(); const list = await call(app, { method: 'GET', url: '/jobs' }); const id = list.body.items?.[0]?.id; assert.ok(id); const out = await call(app, { method: 'GET', url: `/jobs/${id}` }); assert.equal(out.res.statusCode, 200); assert.equal(out.body.ok, true); assert.equal(out.body.item.id, id); assert.ok(Array.isArray(out.body.runs)); } },
    { name: 'GET /jobs/runs respeita filtro job_id', run: async () => { __resetSystemJobsForTests(); __setSystemJobsSupabaseClientForTests(null, false); const app = createApiApp(); const out = await call(app, { method: 'GET', url: '/jobs/runs?job_id=job-1' }); assert.equal(out.res.statusCode, 200); assert.equal(out.body.ok, true); } }
  ];
}
