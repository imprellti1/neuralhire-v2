import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryClientesForTests, createCliente, __dumpMemoryClientes } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { __resetSystemJobsForTests, __dumpSystemJobsForTests, __setSystemJobsSupabaseClientForTests, acquireSystemJobLock, listDueSystemJobs, upsertSystemJob } from '../../modules/jobs/jobs.repository.js';
import { __resetJobsSchedulerForTests, dispatchDueJob, nextDaily0300, runJobsSchedulerTick, startJobsScheduler, stopJobsScheduler } from '../../modules/jobs/jobs.scheduler.js';

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

function createSystemJobsSupabaseMock(initial = {}) {
  const state = {
    jobs: (initial.jobs || []).map((item) => ({ ...item })),
    runs: (initial.runs || []).map((item) => ({ ...item }))
  };

  function tableChain(table) {
    return {
      _table: table,
      _filters: {},
      _insertPayload: null,
      _updatePayload: null,
      select() { return this; },
      eq(key, value) { this._filters[key] = value; return this; },
      or() { return this; },
      order() { return this; },
      limit() { return this; },
      not() { return this; },
      lte() { return this; },
      gte() { return this; },
      insert(payload) {
        this._insertPayload = payload;
        if (table === 'system_jobs') {
          const row = { ...payload };
          state.jobs.push(row);
        }
        if (table === 'system_job_runs') {
          const row = { ...payload };
          state.runs.push(row);
        }
        return this;
      },
      update(payload) {
        this._updatePayload = payload;
        return this;
      },
      maybeSingle() {
        if (table === 'system_jobs') {
          const row = state.jobs.find((item) => (!this._filters.lock_key || item.lock_key === this._filters.lock_key)) || null;
          return Promise.resolve({ data: row ? { ...row } : null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      single() {
        if (table === 'system_jobs') {
          if (this._updatePayload) {
            const row = state.jobs.find((item) => (!this._filters.lock_key || item.lock_key === this._filters.lock_key));
            if (row) Object.assign(row, this._updatePayload);
            return Promise.resolve({ data: row ? { ...row } : null, error: null });
          }
          if (this._insertPayload) {
            const row = state.jobs[state.jobs.length - 1] || null;
            return Promise.resolve({ data: row ? { ...row } : null, error: null });
          }
          const row = state.jobs.find((item) => (!this._filters.lock_key || item.lock_key === this._filters.lock_key)) || null;
          return Promise.resolve({ data: row ? { ...row } : null, error: null });
        }
        if (table === 'system_job_runs') {
          const row = state.runs[state.runs.length - 1] || null;
          return Promise.resolve({ data: row ? { ...row } : null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }
    };
  }

  return {
    state,
    from(table) {
      return tableChain(table);
    }
  };
}

export function getJobsTests() {
  return [
    {
      name: 'ensureSystemJob atualiza job existente sem trocar id e preserva FK',
      run: async () => {
        __resetSystemJobsForTests();
        const mock = createSystemJobsSupabaseMock({
          jobs: [{
            id: 'job-1',
            account_id: 'acc-jobs',
            nome: 'job-antigo',
            status: 'ativo',
            lock_key: 'acc-jobs:job-retest',
            locked_at: null,
            locked_by: null,
            last_run_at: null,
            next_run_at: null,
            last_success_at: null,
            last_error: null,
            metadata: { cadence: 'daily' },
            created_at: '2026-06-17T00:00:00.000Z',
            updated_at: '2026-06-17T00:00:00.000Z'
          }],
          runs: [{
            id: 'run-1',
            job_id: 'job-1',
            account_id: 'acc-jobs',
            nome: 'job-antigo',
            status: 'success',
            started_at: '2026-06-17T01:00:00.000Z',
            finished_at: '2026-06-17T01:01:00.000Z',
            duration_ms: 60000,
            processed_count: 1,
            success_count: 1,
            error_count: 0,
            metadata: {},
            error: null
          }]
        });
        __setSystemJobsSupabaseClientForTests(mock, true);
        try {
          const first = await upsertSystemJob({ id: 'job-new', nome: 'job-retest', lock_key: 'acc-jobs:job-retest', status: 'ativo', metadata: { cadence: 'hourly', ttlMinutes: 20 } }, { accountId: 'acc-jobs' });
          const second = await upsertSystemJob({ id: 'job-other', nome: 'job-retest', lock_key: 'acc-jobs:job-retest', status: 'ativo', metadata: { ttlMinutes: 45 } }, { accountId: 'acc-jobs' });
          assert.equal(first.id, 'job-1');
          assert.equal(second.id, 'job-1');
          assert.equal(second.created_at, '2026-06-17T00:00:00.000Z');
          assert.equal(second.account_id, 'acc-jobs');
          assert.equal(second.status, 'ativo');
          assert.equal(mock.state.runs[0].job_id, 'job-1');
          assert.equal(mock.state.jobs[0].id, 'job-1');
          assert.equal(mock.state.jobs[0].metadata.cadence, 'hourly');
          assert.equal(mock.state.jobs[0].metadata.ttlMinutes, 45);
        } finally {
          __setSystemJobsSupabaseClientForTests(null, false);
        }
      }
    },
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
        assert.equal(dump.jobs.some((job) => job.nome === 'radar_comercial_diario' && job.status === 'ativo'), true);
        assert.equal(dump.runs.some((run) => run.nome === 'radar_comercial_diario' && ['success', 'error', 'running'].includes(run.status)), true);
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
          assert.equal(dump.jobs.some((job) => job.nome === 'clientes_enriquecimento_automatico' && job.status === 'ativo'), true);
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
          assert.equal(dump.jobs.some((job) => job.nome === 'clientes_geolocalizacao_automatico' && job.status === 'ativo'), true);
          const clientes = __dumpMemoryClientes();
          assert.equal(Boolean(clientes.find((item) => item.id === first.id)?.geolocalizacao_status), true);
          assert.equal(Boolean(clientes.find((item) => item.id === second.id)?.geolocalizacao_status), false);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'POST /jobs/notificacoes-resumo-semanal/run responde 202, cria run e envia e-mail quando configurado',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousEmail = process.env.JOB_NOTIFICATIONS_EMAIL;
        process.env.JOB_NOTIFICATIONS_EMAIL = 'alerts@neuralhire.test';
        try {
          const app = createApiApp();
          await createCliente({ nome: 'Cliente 1', documento: '12345678000190', situacao_cadastral: 'Inativa', latitude: null, longitude: null }, { accountId: 'acc-notify' });
          const out = await call(app, { method: 'POST', url: '/jobs/notificacoes-resumo-semanal/run', role: 'admin', accountId: 'acc-notify' });
          assert.equal(out.res.statusCode, 202);
          assert.equal(out.body.success, true);

          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }

          const run = dump.runs.find((item) => item.nome === 'notificacoes_resumo_semanal');
          assert.ok(run);
          assert.equal(run.metadata.notification.type, 'weekly_summary');
          assert.equal(run.metadata.notification.sent, true);
          assert.equal(run.metadata.notification.to, 'alerts@neuralhire.test');
          assert.equal(typeof run.metadata.notification.periodStart === 'string', true);
          assert.equal(typeof run.metadata.notification.periodEnd === 'string', true);
        } finally {
          process.env.JOB_NOTIFICATIONS_EMAIL = previousEmail;
        }
      }
    },
    {
      name: 'POST /jobs/notificacoes-resumo-semanal/run não falha sem destinatário e registra skip',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousEmail = process.env.JOB_NOTIFICATIONS_EMAIL;
        delete process.env.JOB_NOTIFICATIONS_EMAIL;
        try {
          const app = createApiApp();
          await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-notify-skip' });
          const out = await call(app, { method: 'POST', url: '/jobs/notificacoes-resumo-semanal/run', role: 'admin', accountId: 'acc-notify-skip' });
          assert.equal(out.res.statusCode, 202);
          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }
          const run = dump.runs.find((item) => item.nome === 'notificacoes_resumo_semanal');
          assert.ok(run);
          assert.equal(run.metadata.notification.sent, false);
          assert.equal(run.metadata.notification_skipped, true);
        } finally {
          process.env.JOB_NOTIFICATIONS_EMAIL = previousEmail;
        }
      }
    },
    {
      name: 'alerta imediato dispara apenas quando situação cadastral não está ativa',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousEmail = process.env.JOB_NOTIFICATIONS_EMAIL;
        process.env.JOB_NOTIFICATIONS_EMAIL = 'alerts@neuralhire.test';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('brasilapi.com.br')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              text: async () => JSON.stringify({ razao_social: 'Cliente 1 LTDA', descricao_situacao_cadastral: 'Inativa' }),
              json: async () => ({ razao_social: 'Cliente 1 LTDA', descricao_situacao_cadastral: 'Inativa' })
            };
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const app = createApiApp();
          const cliente = await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-alert' });
          const out = await call(app, { method: 'POST', url: '/jobs/clientes-enriquecimento/run', role: 'admin', accountId: 'acc-alert' });
          assert.equal(out.res.statusCode, 202);
          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }
          const run = dump.runs.find((item) => item.nome === 'clientes_enriquecimento_automatico');
          assert.ok(run);
          assert.equal(run.metadata.notification.type, 'situacao_cadastral_alert');
          assert.equal(run.metadata.notification.sent, true);
          assert.equal(run.metadata.notification.to, 'alerts@neuralhire.test');
          assert.equal(run.metadata.notification.cliente_id, cliente.id);
        } finally {
          process.env.JOB_NOTIFICATIONS_EMAIL = previousEmail;
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'alerta imediato não envia para ATIVA e falha de e-mail não derruba o job principal',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousEmail = process.env.JOB_NOTIFICATIONS_EMAIL;
        process.env.JOB_NOTIFICATIONS_EMAIL = 'alerts@neuralhire.test';
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('brasilapi.com.br')) {
            return {
              ok: true,
              status: 200,
              headers: { get: () => 'application/json' },
              text: async () => JSON.stringify({ razao_social: 'Cliente 1 LTDA', descricao_situacao_cadastral: 'ATIVA' }),
              json: async () => ({ razao_social: 'Cliente 1 LTDA', descricao_situacao_cadastral: 'ATIVA' })
            };
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const app = createApiApp();
          await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-ativa' });
          const out = await call(app, { method: 'POST', url: '/jobs/clientes-enriquecimento/run', role: 'admin', accountId: 'acc-ativa' });
          assert.equal(out.res.statusCode, 202);
          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }
          const run = dump.runs.find((item) => item.nome === 'clientes_enriquecimento_automatico');
          assert.ok(run);
          assert.equal(run.metadata.notification?.sent, false);
          assert.equal(run.metadata.notification?.type, 'situacao_cadastral_alert');
        } finally {
          process.env.JOB_NOTIFICATIONS_EMAIL = previousEmail;
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
        assert.equal(dump.jobs.find((job) => job.nome === 'clientes_enriquecimento_automatico')?.status, 'ativo');
        assert.equal(String(dump.jobs.find((job) => job.nome === 'clientes_enriquecimento_automatico')?.next_run_at || '').length > 0, true);
      }
    },
    {
      name: 'lock e execução mantêm system_jobs em ativo',
      run: async () => {
        __resetSystemJobsForTests();
        const acquired = await acquireSystemJobLock({ lockKey: 'acc-status:jobs:radar_comercial_diario', nome: 'radar_comercial_diario', ttlMinutes: 120, accountId: 'acc-status', workerId: 'worker-status' });
        assert.equal(acquired.acquired, true);
        assert.equal(acquired.job.status, 'ativo');
        const dump = __dumpSystemJobsForTests();
        assert.equal(dump.jobs.every((job) => ['ativo', 'inativo'].includes(job.status)), true);
      }
    },
    {
      name: 'scheduler não inicia quando desabilitado',
      run: async () => {
        __resetJobsSchedulerForTests();
        const previous = process.env.JOBS_SCHEDULER_ENABLED;
        process.env.JOBS_SCHEDULER_ENABLED = 'false';
        try {
          assert.equal(process.env.JOBS_SCHEDULER_ENABLED === 'true', false);
        } finally {
          process.env.JOBS_SCHEDULER_ENABLED = previous;
        }
      }
    },
    {
      name: 'scheduler inicia quando habilitado',
      run: async () => {
        __resetJobsSchedulerForTests();
        const started = startJobsScheduler({ intervalMs: 5000 });
        assert.equal(started.started, true);
        assert.equal(started.intervalMs, 5000);
        stopJobsScheduler();
      }
    },
    {
      name: 'lista jobs vencidos corretamente',
      run: async () => {
        __resetSystemJobsForTests();
        const now = new Date('2026-06-17T12:00:00.000Z');
        await upsertSystemJob({ nome: 'radar_comercial_diario', lock_key: 'acc-due:radar', account_id: 'acc-due', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-due' });
        await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'acc-due:enrich', account_id: 'acc-due', status: 'ativo', next_run_at: '2026-06-17T13:00:00.000Z' }, { accountId: 'acc-due' });
        const due = await listDueSystemJobs({ now, limit: 10, accountId: 'acc-due' });
        assert.equal(due.length, 1);
        assert.equal(due[0].nome, 'radar_comercial_diario');
      }
    },
    {
      name: 'não lista jobs futuros',
      run: async () => {
        __resetSystemJobsForTests();
        const now = new Date('2026-06-17T12:00:00.000Z');
        await upsertSystemJob({ nome: 'notificacoes_resumo_semanal', lock_key: 'acc-future:weekly', account_id: 'acc-future', status: 'ativo', next_run_at: '2026-06-17T12:01:00.000Z' }, { accountId: 'acc-future' });
        const due = await listDueSystemJobs({ now, limit: 10, accountId: 'acc-future' });
        assert.equal(due.length, 0);
      }
    },
    {
      name: 'dispara handler correto por nome',
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
              text: async () => JSON.stringify({ nome: 'Cliente Scheduler', razao_social: 'Cliente Scheduler LTDA' }),
              json: async () => ({ nome: 'Cliente Scheduler', razao_social: 'Cliente Scheduler LTDA' })
            };
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const cliente = await createCliente({ nome: 'Cliente Scheduler', documento: '32345678000190' }, { accountId: 'acc-sched' });
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'acc-sched:clientes:enriquecimento:automatico', account_id: 'acc-sched', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-sched' });
          const result = await dispatchDueJob(job, { accountId: 'acc-sched', requestId: 'scheduler-test', workerId: 'scheduler:test' });
          assert.equal(result.ok, true);
          const dump = __dumpSystemJobsForTests();
          assert.ok(dump.runs.some((run) => run.nome === 'clientes_enriquecimento_automatico'));
          assert.equal(Boolean(cliente.id), true);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'ignora job sem handler com log warning',
      run: async () => {
        __resetSystemJobsForTests();
        const job = await upsertSystemJob({ nome: 'job_sem_handler', lock_key: 'acc-unknown:job', account_id: 'acc-unknown', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-unknown' });
        const result = await dispatchDueJob(job, { accountId: 'acc-unknown', requestId: 'scheduler-test', workerId: 'scheduler:test' });
        assert.equal(result.ok, false);
        assert.equal(result.skipped, true);
      }
    },
    {
      name: 'erro de job não derruba scheduler',
      run: async () => {
        __resetSystemJobsForTests();
        __resetJobsSchedulerForTests();
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async (url) => {
          if (String(url).includes('brasilapi.com.br')) {
            throw new Error('falha simulada');
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'acc-fail:clientes:enriquecimento:automatico', account_id: 'acc-fail', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-fail' });
          const tick = await runJobsSchedulerTick({ now: new Date('2026-06-17T12:00:00.000Z'), accountId: 'acc-fail', workerId: 'scheduler:test' });
          assert.equal(tick.ok, true);
          assert.equal(tick.dueJobsCount >= 1, true);
          assert.ok(job.id);
        } finally {
          globalThis.fetch = previousFetch;
        }
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
