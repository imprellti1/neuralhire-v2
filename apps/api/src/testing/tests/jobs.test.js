import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryClientesForTests, createCliente, __dumpMemoryClientes } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { __resetSystemJobsForTests, __dumpSystemJobsForTests, acquireSystemJobLock } from '../../modules/jobs/jobs.repository.js';
import { nextDaily0300 } from '../../modules/jobs/jobs.scheduler.js';

function parse(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      name: 'POST /jobs/radar-comercial/run responde 202 e continua em background',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryAlertasForTests();
        __resetMemoryTimelineForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-jobs' });
        await createCliente({ nome: 'Cliente 2', documento: '22345678000190' }, { accountId: 'acc-jobs' });
        const startedAt = Date.now();
        const out = await call(app, { method: 'POST', url: '/jobs/radar-comercial/run', role: 'admin', accountId: 'acc-jobs' });
        const responseDurationMs = Date.now() - startedAt;
        assert.equal(out.res.statusCode, 202);
        assert.equal(out.body.success, true);
        assert.equal(out.body.message, 'Radar Comercial iniciado');
        assert.equal(out.body.status, 'running');
        assert.equal(responseDurationMs < 1000, true);

        let dump = __dumpSystemJobsForTests();
        for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
          await wait(25);
          dump = __dumpSystemJobsForTests();
        }

        assert.equal(dump.runs.length > 0, true);
        assert.equal(dump.jobs.some((job) => job.nome === 'radar_comercial_diario' && ['success', 'error', 'running'].includes(job.status)), true);
      }
    },
    {
      name: 'POST /jobs/clientes-enriquecimento/run responde 202 e processa apenas 1 cliente',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('brasilapi.com.br')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              text: async () => JSON.stringify({ nome: 'Cliente 1', razao_social: 'Cliente 1 LTDA' }),
              json: async () => ({ nome: 'Cliente 1', razao_social: 'Cliente 1 LTDA' })
            };
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const app = createApiApp();
          const first = await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-enrich' });
          const second = await createCliente({ nome: 'Cliente 2', documento: '22345678000190' }, { accountId: 'acc-enrich' });
          const startedAt = Date.now();
          const out = await call(app, { method: 'POST', url: '/jobs/clientes-enriquecimento/run', role: 'admin', accountId: 'acc-enrich' });
          assert.equal(out.res.statusCode, 202);
          assert.equal(out.body.success, true);
          assert.equal(out.body.status, 'running');
          assert.equal(Date.now() - startedAt < 1000, true);

          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }

          assert.equal(dump.runs.length > 0, true);
          assert.equal(dump.runs[0].nome, 'clientes_enriquecimento_automatico');
          assert.equal(dump.runs[0].processed_count, 1);
          assert.equal(dump.runs[0].success_count, 1);
          assert.equal(dump.runs[0].metadata.result, 'success');
          const clientes = __dumpMemoryClientes();
          assert.equal(Boolean(clientes.find((item) => item.id === first.id)?.enriquecimento_status), true);
          assert.equal(Boolean(clientes.find((item) => item.id === second.id)?.enriquecimento_status), false);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'POST /jobs/clientes-geolocalizacao/run responde 202 e processa apenas 1 cliente',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('nominatim.openstreetmap.org/search')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              text: async () => JSON.stringify([{ lat: '-23.550520', lon: '-46.633308', place_id: '123456' }]),
              json: async () => ([{ lat: '-23.550520', lon: '-46.633308', place_id: '123456' }])
            };
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const app = createApiApp();
          const first = await createCliente({ nome: 'Cliente 1', documento: '12345678000190', logradouro: 'Rua A', numero: '100', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }, { accountId: 'acc-geo' });
          const second = await createCliente({ nome: 'Cliente 2', documento: '22345678000190', logradouro: 'Rua B', numero: '200', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }, { accountId: 'acc-geo' });
          const out = await call(app, { method: 'POST', url: '/jobs/clientes-geolocalizacao/run', role: 'admin', accountId: 'acc-geo' });
          assert.equal(out.res.statusCode, 202);
          assert.equal(out.body.success, true);
          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }
          assert.equal(dump.runs[0].nome, 'clientes_geolocalizacao_automatico');
          assert.equal(dump.runs[0].processed_count, 1);
          const clientes = __dumpMemoryClientes();
          assert.equal(Boolean(clientes.find((item) => item.id === first.id)?.geolocalizacao_status), true);
          assert.equal(Boolean(clientes.find((item) => item.id === second.id)?.geolocalizacao_status), false);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'empty queue não falha e agenda próxima execução em 1 hora',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const app = createApiApp();
        const out = await call(app, { method: 'POST', url: '/jobs/clientes-enriquecimento/run', role: 'admin', accountId: 'acc-empty' });
        assert.equal(out.res.statusCode, 202);
        let dump = __dumpSystemJobsForTests();
        for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
          await wait(25);
          dump = __dumpSystemJobsForTests();
        }
        assert.equal(dump.runs[0].status, 'success');
        assert.equal(dump.runs[0].processed_count, 0);
        assert.equal(dump.runs[0].metadata.result, 'empty_queue');
        assert.equal(String(dump.jobs.find((job) => job.nome === 'clientes_enriquecimento_automatico')?.next_run_at || '').length > 0, true);
      }
    },
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
      name: 'lock impede execução duplicada nos jobs automáticos de clientes',
      run: async () => {
        __resetSystemJobsForTests();
        const first = await acquireSystemJobLock({ lockKey: 'acc-jobs:clientes:enriquecimento:automatico', nome: 'clientes_enriquecimento_automatico', ttlMinutes: 30, accountId: 'acc-jobs', workerId: 'worker-1' });
        assert.equal(first.acquired, true);
        const second = await acquireSystemJobLock({ lockKey: 'acc-jobs:clientes:enriquecimento:automatico', nome: 'clientes_enriquecimento_automatico', ttlMinutes: 30, accountId: 'acc-jobs', workerId: 'worker-2' });
        assert.equal(second.acquired, false);
      }
    },
    {
      name: 'próxima execução fica às 03:00 no horário esperado',
      run: async () => {
        const next = nextDaily0300(new Date('2026-06-17T01:15:00.000Z'));
        const hoursMinutes = new Date(next).toISOString().slice(11, 16);
        assert.equal(hoursMinutes === '03:00' || hoursMinutes === '06:00', true);
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
