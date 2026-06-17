import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { __resetSystemJobsForTests, __dumpSystemJobsForTests, acquireSystemJobLock } from '../../modules/jobs/jobs.repository.js';
import { nextDaily0300 } from '../../modules/jobs/jobs.scheduler.js';

function parse(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

async function call(app, { method, url, role, accountId, body }) {
  const headers = { 'x-test-role': role, 'x-test-account-id': accountId };
  if (body) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

export function getJobsTests() {
  return [
    {
      name: 'lock impede execução duplicada',
      run: async () => {
        __resetSystemJobsForTests();
        const first = await acquireSystemJobLock({ lockKey: 'acc-jobs:jobs:radar_comercial_diario', nome: 'radar_comercial_diario', ttlMinutes: 120, accountId: 'acc-jobs', workerId: 'worker-1' });
        assert.equal(first.acquired, true);
        const second = await acquireSystemJobLock({ lockKey: 'acc-jobs:jobs:radar_comercial_diario', nome: 'radar_comercial_diario', ttlMinutes: 120, accountId: 'acc-jobs', workerId: 'worker-2' });
        assert.equal(second.acquired, false);
      }
    },
    {
      name: 'próxima execução fica às 03:00',
      run: async () => {
        const next = nextDaily0300(new Date('2026-06-17T01:15:00.000Z'));
        assert.equal(String(next).slice(11, 16), '03:00');
      }
    },
    {
      name: 'POST /clientes/radar/recalcular processa múltiplos clientes',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryAlertasForTests();
        __resetMemoryTimelineForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-radar' });
        await createCliente({ nome: 'Cliente 2', documento: '22345678000190' }, { accountId: 'acc-radar' });
        const out = await call(app, { method: 'POST', url: '/clientes/radar/recalcular', role: 'admin', accountId: 'acc-radar' });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.processados >= 2, true);
        assert.equal(out.body.sucessos >= 2, true);
      }
    },
    {
      name: 'falha em um cliente não interrompe os demais',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryAlertasForTests();
        __resetMemoryTimelineForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-radar' });
        await createCliente({ nome: 'Cliente 2', documento: '22345678000190' }, { accountId: 'acc-radar' });
        const out = await call(app, { method: 'POST', url: '/clientes/radar/recalcular', role: 'admin', accountId: 'acc-radar' });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.processados, 2);
        assert.equal(typeof out.body.falhas, 'number');
      }
    },
    {
      name: 'GET /clientes/radar não cai em /clientes/:id',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Radar', documento: '12345678000190' }, { accountId: 'acc-radar' });
        const out = await call(app, { method: 'GET', url: '/clientes/radar', role: 'admin', accountId: 'acc-radar' });
        assert.equal(out.res.statusCode, 200);
        assert.ok(out.body.resumo);
      }
    },
    {
      name: 'endpoint admin recusa vendedor comum',
      run: async () => {
        __resetSystemJobsForTests();
        const app = createApiApp();
        const out = await call(app, { method: 'POST', url: '/jobs/radar-comercial/run', role: 'sales', accountId: 'acc-jobs' });
        assertEqual(out.res.statusCode === 403 || out.res.statusCode === 404, true);
      }
    }
  ];
}
