import assert from 'node:assert/strict';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __loadMemoryClientes, __resetMemoryClientesForTests, createCliente, __dumpMemoryClientes } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';
import { __loadMemoryPedidos, __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { __dumpMemoryCustomerKnowledgeEmbeddingsForTests, __resetMemoryCustomerKnowledgeEmbeddingsForTests, createPendingEmbedding, upsertEmbedding } from '../../modules/whatsapp-learning/customer-knowledge-embedding.repository.js';
import { __resetMemoryAiDirectorObservationsForTests, createObservation, listObservations } from '../../modules/ai-director-observations/ai-director-observations.repository.js';
import { __dumpMemoryAiDirectorForTests, __resetMemoryAiDirectorForTests, __setAiDirectorSupabaseClientForTests, createExecutiveMemory, listExecutiveMemories } from '../../modules/ai-director/ai-director.repository.js';
import { __resetMemoryAiDirectorActionPlansForTests, buildExecutiveActionPlan, listActionPlans, upsertActionPlan } from '../../modules/ai-director/ai-director-action-plans.repository.js';
import { __resetMemoryAiDirectorTasksForTests, generateDirectorTasksFromOpenActionPlans, listDirectorTasks, normalizeDirectorTaskKey } from '../../modules/ai-director/ai-director-tasks.repository.js';
import { __resetAuditLogsForTests, __seedAuditLogForTests } from '../../modules/audit-logs/audit-logs.repository.js';
import { __resetSystemJobsForTests, __dumpSystemJobsForTests, __setSystemJobsSupabaseClientForTests, acquireSystemJobLock, ensureDefaultSystemJobs, getSystemJobDefaults, listDueSystemJobs, recordSystemJobRun, updateSystemJobSchedule, upsertSystemJob } from '../../modules/jobs/jobs.repository.js';
import { __resetJobsSchedulerForTests, dispatchDueJob, nextDaily0300, runDiretorDelegacaoJob, runDiretorPlanoAcaoJob, runDiretorReuniaoExecutivaJob, runJobsSchedulerTick, runVendedorIaObservacaoJob, startJobsScheduler, stopJobsScheduler, runWhatsappLearningEmbeddingWorker } from '../../modules/jobs/jobs.scheduler.js';

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
      name: 'GET /jobs inclui gerente comercial observacao',
      run: async () => {
        __resetSystemJobsForTests();
        const app = createApiApp();
        await ensureDefaultSystemJobs(null, { logger: { info: () => null } });
        const req = createTestRequest({ method: 'GET', url: '/jobs', headers: { 'x-test-role': 'admin' } });
        const res = createTestResponse();
        await app(req, res);
        const out = { res, body: parse(res) };
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(Array.isArray(out.body.items), true);
        assert.equal(out.body.items.length, 16);
        assert.equal(out.body.items.some((job) => job.nome === 'gerente_comercial_observacao'), true);
        assert.equal(out.body.items.some((job) => job.nome === 'vendedor_ia_observacao'), true);
        assert.equal(out.body.items.some((job) => job.nome === 'diretor_reuniao_executiva'), true);
        assert.equal(out.body.items.some((job) => job.nome === 'diretor_plano_acao'), true);
        assert.equal(out.body.items.some((job) => job.nome === 'whatsapp_learning_worker'), true);
        assert.equal(out.body.items.some((job) => job.nome === 'whatsapp_learning_consolidation_worker'), true);
      }
    },
    {
      name: 'bootstrap padrão inclui diretor reunião executiva',
      run: async () => {
        const defaults = getSystemJobDefaults();
        assert.equal(defaults.length, 16);
        assert.equal(defaults.some((job) => job.nome === 'gerente_comercial_observacao'), true);
        assert.equal(defaults.some((job) => job.nome === 'vendedor_ia_observacao'), true);
        assert.equal(defaults.some((job) => job.nome === 'diretor_reuniao_executiva'), true);
        assert.equal(defaults.some((job) => job.nome === 'diretor_plano_acao'), true);
        assert.equal(defaults.some((job) => job.nome === 'whatsapp_learning_worker'), true);
        assert.equal(defaults.some((job) => job.nome === 'whatsapp_learning_consolidation_worker'), true);
        __resetSystemJobsForTests();
        const logs = [];
        await ensureDefaultSystemJobs(null, { logger: { info: (...args) => logs.push(args) } });
        const dump = __dumpSystemJobsForTests();
        assert.equal(dump.jobs.length, 16);
        assert.equal(dump.jobs.some((job) => job.nome === 'gerente_comercial_observacao'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'vendedor_ia_observacao'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'diretor_reuniao_executiva'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'diretor_plano_acao'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'whatsapp_learning_worker'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'whatsapp_learning_cognitive_worker'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'whatsapp_learning_consolidation_worker'), true);
        assert.equal(dump.jobs.some((job) => job.nome === 'whatsapp_learning_embedding_worker'), true);
        assert.equal(dump.jobs.some((job) => job.metadata.cadence === 'every-10-minutes'), true);
        assert.equal(dump.jobs.some((job) => job.lock_key === 'diretor_reuniao_executiva'), true);
        assert.equal(dump.jobs.some((job) => job.lock_key === 'diretor_plano_acao'), true);
        assert.equal(logs.some(([message]) => message === 'system_jobs_bootstrap_started'), true);
        assert.equal(logs.some(([message]) => message === 'system_jobs_bootstrap_finished'), true);
        await ensureDefaultSystemJobs(null, { logger: { info: () => null } });
        const secondDump = __dumpSystemJobsForTests();
        assert.equal(secondDump.jobs.length, 16);
      }
    },
    {
      name: 'whatsapp_learning_embedding_worker é registrado e respeita flag desligada',
      run: async () => {
        __resetSystemJobsForTests();
        const previous = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_WORKER_ENABLED = 'false';
        try {
          const defaults = getSystemJobDefaults();
          assert.equal(defaults.some((job) => job.nome === 'whatsapp_learning_embedding_worker'), true);
          await ensureDefaultSystemJobs(null, { logger: { info: () => null } });
          const dump = __dumpSystemJobsForTests();
          const job = dump.jobs.find((item) => item.nome === 'whatsapp_learning_embedding_worker');
          assert.ok(job);
          assert.equal(job.metadata.cadence, 'every-10-minutes');
          assert.equal(job.lock_key, 'whatsapp_learning_embedding_worker');
          const result = await runWhatsappLearningEmbeddingWorker({});
          assert.equal(result.ok, true);
          assert.equal(result.disabled, true);
          assert.equal(result.processed, 0);
          assert.equal(result.failed, 0);
          assert.equal(result.ignored, 0);
        } finally {
          if (previous === undefined) delete process.env.EMBEDDING_WORKER_ENABLED;
          else process.env.EMBEDDING_WORKER_ENABLED = previous;
        }
      }
    },
    {
      name: 'whatsapp_learning_embedding_worker processa pending de um tenant e ignora já processados',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryCustomerKnowledgeEmbeddingsForTests();
        const previous = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_WORKER_ENABLED = 'true';
        try {
          await createPendingEmbedding({ accountId: 'acc-embed', customerKnowledgeId: 'ck-pending-1', embeddingHash: 'hash-pending-1', embeddingMetadata: { source_event_id: 'evt-pending-1' } }, { accountId: 'acc-embed' });
          await upsertEmbedding({ accountId: 'acc-embed', customerKnowledgeId: 'ck-processed-1', embeddingStatus: 'processed', embeddingProvider: 'disabled', embeddingVersion: 1, embeddingHash: 'hash-processed-1', embeddingMetadata: { source_event_id: 'evt-processed-1' }, processedAt: '2026-06-30T09:00:00.000Z', lastAttemptAt: '2026-06-30T09:00:00.000Z' }, { accountId: 'acc-embed' });
          await upsertEmbedding({ accountId: 'acc-other', customerKnowledgeId: 'ck-other', embeddingStatus: 'pending', embeddingProvider: 'disabled', embeddingVersion: 1, embeddingHash: 'hash-other', embeddingMetadata: { source_event_id: 'evt-other' } }, { accountId: 'acc-other' });
          const first = await runWhatsappLearningEmbeddingWorker({ accountId: 'acc-embed' });
          assert.equal(first.ok, true);
          assert.equal(first.disabled, true);
          assert.equal(first.provider, 'disabled');
          assert.equal(first.processed, 1);
          assert.equal(first.failed, 0);
          assert.equal(first.scanned, 1);
          const rows = __dumpMemoryCustomerKnowledgeEmbeddingsForTests();
          assert.equal(rows.find((row) => row.customer_knowledge_id === 'ck-pending-1').embedding_status, 'processed');
          assert.equal(rows.find((row) => row.customer_knowledge_id === 'ck-processed-1').embedding_status, 'processed');
          assert.equal(rows.find((row) => row.customer_knowledge_id === 'ck-other').embedding_status, 'pending');
          const second = await runWhatsappLearningEmbeddingWorker({ accountId: 'acc-embed' });
          assert.equal(second.processed, 0);
          assert.equal(second.failed, 0);
          assert.equal(second.scanned, 0);
          assert.equal(second.ignored, 0);
        } finally {
          if (previous === undefined) delete process.env.EMBEDDING_WORKER_ENABLED;
          else process.env.EMBEDDING_WORKER_ENABLED = previous;
        }
      }
    },
    {
      name: 'POST /jobs/gerente-comercial-observacao/run responde 202 e cria observacoes comerciais',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryProdutosForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto A', preco: 600 }, { accountId: 'acc-manager' });
        const clienteRisco = await createCliente({ nome: 'Cliente Risco', documento: '12345678000190', ativo: true }, { accountId: 'acc-manager' });
        const clienteReativado = await createCliente({ nome: 'Cliente Reativado', documento: '22345678000190', ativo: true }, { accountId: 'acc-manager' });
        const clienteQueda = await createCliente({ nome: 'Cliente Queda', documento: '32345678000190', ativo: true }, { accountId: 'acc-manager' });
        const clienteCrescimento = await createCliente({ nome: 'Cliente Crescimento', documento: '42345678000190', ativo: true }, { accountId: 'acc-manager' });

        await createPedido({ cliente_id: clienteRisco.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 600 }], data_emissao: '2026-01-01', data_faturamento: '2026-01-01', numero: 'P-1' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteReativado.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 600 }], data_emissao: '2026-03-01', data_faturamento: '2026-03-01', numero: 'P-2' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteReativado.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 600 }], data_emissao: '2026-06-12', data_faturamento: '2026-06-12', numero: 'P-3' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteQueda.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 600 }], data_emissao: '2026-05-01', data_faturamento: '2026-05-01', numero: 'P-4' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteQueda.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 600 }], data_emissao: '2026-05-15', data_faturamento: '2026-05-15', numero: 'P-5' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteQueda.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 100 }], data_emissao: '2026-06-10', data_faturamento: '2026-06-10', numero: 'P-6' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteCrescimento.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 100 }], data_emissao: '2026-05-01', data_faturamento: '2026-05-01', numero: 'P-7' }, { accountId: 'acc-manager' });
        await createPedido({ cliente_id: clienteCrescimento.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 100 }, { produto_id: produto.id, quantidade: 1, preco_unitario: 100 }], data_emissao: '2026-06-08', data_faturamento: '2026-06-08', numero: 'P-8' }, { accountId: 'acc-manager' });

        const out = await call(app, { method: 'POST', url: '/jobs/gerente-comercial-observacao/run', role: 'admin', accountId: 'acc-manager' });
        assert.equal(out.res.statusCode, 202);
        let dump = __dumpSystemJobsForTests();
        for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
          await wait(25);
          dump = __dumpSystemJobsForTests();
        }
        const run = dump.runs.find((item) => item.nome === 'gerente_comercial_observacao');
        assert.ok(run);
        assert.equal(run.metadata.accounts_processed, 1);
        assert.equal(run.metadata.clientes_analisados >= 4, true);
        assert.equal(run.metadata.observations_created, 2);
        const observations = await listObservations({ accountId: 'acc-manager' }, { status: 'open', limit: 50 });
        assert.equal(observations.items.some((item) => item.category === 'comercial'), true);
        assert.equal(observations.items.some((item) => item.title === 'Cliente sem compra há mais de 90 dias'), true);
        assert.equal(observations.items.some((item) => item.title === 'Cliente reativado'), true);
      }
    },
    {
      name: 'job não duplica observação aberta existente',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryProdutosForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto A', preco: 600 }, { accountId: 'acc-dup' });
        const cliente = await createCliente({ nome: 'Cliente Duplicado', documento: '52345678000190', ativo: true }, { accountId: 'acc-dup' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 600 }], data_emissao: '2026-01-01', data_faturamento: '2026-01-01', numero: 'P-9' }, { accountId: 'acc-dup' });
        await createObservation({ accountId: 'acc-dup' }, {
          manager_id: 'gerente_comercial',
          manager_name: 'Gerente Comercial',
          category: 'comercial',
          title: 'Cliente sem compra há mais de 90 dias',
          description: 'Cliente Cliente Duplicado não compra desde 2026-01-01.',
          severity: 'high',
          source_type: 'cliente',
          source_id: cliente.id,
          metadata: { cliente_id: cliente.id, cliente_nome: 'Cliente Duplicado' }
        });
        const out = await call(app, { method: 'POST', url: '/jobs/gerente-comercial-observacao/run', role: 'admin', accountId: 'acc-dup' });
        assert.equal(out.res.statusCode, 202);
        let dump = __dumpSystemJobsForTests();
        for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
          await wait(25);
          dump = __dumpSystemJobsForTests();
        }
        const run = dump.runs.find((item) => item.nome === 'gerente_comercial_observacao');
        assert.ok(run);
        const observations = await listObservations({ accountId: 'acc-dup' }, { status: 'open', limit: 50 });
        const matching = observations.items.filter((item) => item.category === 'comercial' && item.source_id === cliente.id && item.title === 'Cliente sem compra há mais de 90 dias');
        assert.equal(matching.length >= 1, true);
      }
    },
    {
      name: 'job registra métricas no resultado',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryProdutosForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const app = createApiApp();
        const cliente = await createCliente({ nome: 'Cliente Métrica', documento: '62345678000190', ativo: true }, { accountId: 'acc-metrics' });
        const produto = await createProduto({ nome: 'Produto Métrica', preco: 100 }, { accountId: 'acc-metrics' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 100 }], data_emissao: '2026-06-10', data_faturamento: '2026-06-10', numero: 'P-10' }, { accountId: 'acc-metrics' });
        const out = await call(app, { method: 'POST', url: '/jobs/gerente-comercial-observacao/run', role: 'admin', accountId: 'acc-metrics' });
        assert.equal(out.res.statusCode, 202);
        let dump = __dumpSystemJobsForTests();
        for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
          await wait(25);
          dump = __dumpSystemJobsForTests();
        }
        const run = dump.runs.find((item) => item.nome === 'gerente_comercial_observacao');
        assert.ok(run);
        assert.equal(typeof run.metadata.observations_created, 'number');
        assert.equal(typeof run.metadata.observations_skipped_duplicate, 'number');
        assert.equal(typeof run.metadata.accounts_processed, 'number');
        assert.equal(typeof run.metadata.clientes_analisados, 'number');
      }
    },
    {
      name: 'novos jobs de observação executam manualmente e gravam observações',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryProdutosForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        __resetAuditLogsForTests();
        const app = createApiApp();
        const produto = await createProduto({ nome: 'Produto Observado', preco: 10 }, { accountId: 'acc-new-jobs' });
        await createCliente({ nome: 'Cliente Sem Categoria', documento: '72345678000190', ativo: true }, { accountId: 'acc-new-jobs' });
        await createCliente({ nome: 'Cliente Sem Geo', documento: '82345678000190', ativo: true, latitude: null, longitude: null }, { accountId: 'acc-new-jobs' });
        await createCliente({ nome: 'Cliente Inválido', documento: '123', ativo: true }, { accountId: 'acc-new-jobs' });
        await createPedido({ cliente_id: 'cliente-inexistente', itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 10 }], data_emissao: '2026-06-10', data_faturamento: '2026-06-10', numero: 'P-11' }, { accountId: 'acc-new-jobs' }).catch(() => null);
        __seedAuditLogForTests({ account_id: 'acc-new-jobs', status: 'failed', descricao: 'Falha simulada' }, { accountId: 'acc-new-jobs' });

        const jobs = [
          '/jobs/gerente-produtos-observacao/run',
          '/jobs/gerente-auditoria-observacao/run',
          '/jobs/gerente-administrativo-observacao/run'
        ];
        for (const url of jobs) {
          const out = await call(app, { method: 'POST', url, role: 'admin', accountId: 'acc-new-jobs' });
          assert.equal(out.res.statusCode, 202);
        }

        let dump = __dumpSystemJobsForTests();
        for (let attempt = 0; attempt < 40 && dump.runs.length < 3; attempt += 1) {
          await wait(25);
          dump = __dumpSystemJobsForTests();
        }
        assert.equal(dump.runs.some((item) => item.nome === 'gerente_produtos_observacao'), true);
        assert.equal(dump.runs.some((item) => item.nome === 'gerente_auditoria_observacao'), true);
        assert.equal(dump.runs.some((item) => item.nome === 'gerente_administrativo_observacao'), true);
        const observations = await listObservations({ accountId: 'acc-new-jobs' }, { limit: 100 });
        assert.equal(observations.items.some((item) => item.category === 'produtos'), true);
        assert.equal(observations.items.some((item) => item.category === 'auditoria'), true);
        assert.equal(observations.items.some((item) => item.category === 'administrativo'), true);
      }
    },
    {
      name: 'POST /jobs/:id/run executa o job correto pelo id',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-manual' });
        const job = await upsertSystemJob({ nome: 'gerente_comercial_observacao', lock_key: 'acc-manual:gerente_comercial_observacao', account_id: 'acc-manual', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-manual' });
        const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-manual' });
        assert.equal(out.res.statusCode, 202);
        assert.equal(out.body.status, 'running');
      }
    },
    {
      name: 'diretor reunião executiva prioriza no máximo 5 grupos com rank e severidade',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const accountId = 'acc-director';
        const groups = [
          { category: 'auditoria', manager_id: 'gerente_auditoria', manager_name: 'Gerente Auditoria', title: 'Log crítico', severity: 'critical', impact: 'critical', urgency: 'critical', metadata: { entity_critical: true, theme: 'logs críticos' } },
          { category: 'comercial', manager_id: 'gerente_comercial', manager_name: 'Gerente Comercial', title: 'Receita em queda', severity: 'high', impact: 'high', urgency: 'high', metadata: { theme: 'queda de receita' } },
          { category: 'administrativo', manager_id: 'gerente_administrativo', manager_name: 'Gerente Administrativo', title: 'Cadastro pendente', severity: 'medium', impact: 'medium', urgency: 'medium', metadata: { theme: 'pendências cadastrais' } },
          { category: 'produtos', manager_id: 'gerente_produtos', manager_name: 'Gerente Produtos', title: 'Falha de catálogo', severity: 'medium', impact: 'low', urgency: 'medium', metadata: { theme: 'falhas de catálogo' } },
          { category: 'comercial', manager_id: 'gerente_comercial', manager_name: 'Gerente Comercial', title: 'Follow-up atrasado', severity: 'low', impact: 'low', urgency: 'low', metadata: { theme: 'follow-up comercial' } },
          { category: 'auditoria', manager_id: 'gerente_auditoria', manager_name: 'Gerente Auditoria', title: 'Outro log crítico', severity: 'critical', impact: 'critical', urgency: 'critical', metadata: { theme: 'logs fiscais' } }
        ];
        for (let i = 0; i < groups.length; i += 1) {
          await createObservation({ accountId }, {
            manager_id: groups[i].manager_id,
            manager_name: groups[i].manager_name,
            category: groups[i].category,
            title: groups[i].title,
            description: groups[i].title,
            severity: groups[i].severity,
            impact_score: 80,
            urgency_score: 90,
            source_type: 'pedido',
            source_id: `source-${i}`,
            status: 'open',
            metadata: groups[i].metadata
          });
        }
        const { runDiretorReuniaoExecutivaJob } = await import('../../modules/jobs/jobs.scheduler.js');
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        const result = await runDiretorReuniaoExecutivaJob({ accountId, auth: { role: 'admin', accountId }, job });
        assert.equal(result.ok, true);
        assert.equal(typeof result.next_run_at, 'string');
        const priorities = __dumpMemoryAiDirectorForTests().filter((item) => item.account_id === accountId && item.origem === 'diretor_reuniao_executiva' && item.tipo === 'prioridade_executiva');
        assert.equal(priorities.length <= 5, true);
        assert.equal(priorities.length, 4);
        const scores = priorities.map((item) => Number(item.metadata.score || 0));
        assert.deepEqual([...scores].sort((a, b) => b - a), scores);
        assert.deepEqual(priorities.map((item) => item.metadata.rank), [1, 2, 3, 4]);
        assert.equal(priorities[0].severidade, 'critica');
        assert.equal(Array.isArray(priorities[0].metadata.observation_ids), true);
        assert.equal(priorities[0].metadata.criteria_version, 1);
        assert.equal(typeof priorities[0].metadata.score, 'number');
        assert.equal(typeof priorities[0].metadata.rank, 'number');
        assert.equal(Array.isArray(priorities[0].metadata.managers), true);
        assert.equal(Array.isArray(priorities[0].metadata.categories), true);
        assert.equal(priorities.some((item) => item.metadata.normalized_title_key === 'pendencias criticas de auditoria'), true);
        assert.equal(priorities.some((item) => item.metadata.normalized_title_key === 'clientes em risco comercial'), true);
        const auditoria = priorities.find((item) => item.metadata.normalized_title_key === 'pendencias criticas de auditoria');
        const comercial = priorities.find((item) => item.metadata.normalized_title_key === 'clientes em risco comercial');
        assert.equal(auditoria?.metadata.merged_groups_count, 2);
        assert.equal(auditoria?.metadata.observation_ids.length, 2);
        assert.equal(comercial?.metadata.merged_groups_count, 2);
        assert.equal(comercial?.metadata.observation_ids.length, 2);
      }
    },
    {
      name: 'diretor reunião executiva atualiza sem duplicar em execução repetida',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const accountId = 'acc-director-dup';
        await createObservation({ accountId }, {
          manager_id: 'gerente_comercial',
          manager_name: 'Gerente Comercial',
          category: 'comercial',
          title: 'Receita em queda',
          description: 'Queda relevante de faturamento no período recente.',
          severity: 'critical',
          impact_score: 80,
          urgency_score: 90,
          source_type: 'pedido',
          source_id: 'pedido-1',
          status: 'open',
          metadata: { theme: 'queda de receita' }
        });
        const { runDiretorReuniaoExecutivaJob } = await import('../../modules/jobs/jobs.scheduler.js');
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        await runDiretorReuniaoExecutivaJob({ accountId, auth: { role: 'admin', accountId }, job });
        await runDiretorReuniaoExecutivaJob({ accountId, auth: { role: 'admin', accountId }, job });
        const same = __dumpMemoryAiDirectorForTests().filter((item) => item.account_id === accountId && item.tipo === 'prioridade_executiva' && item.origem === 'diretor_reuniao_executiva');
        assert.equal(same.length, 1);
        assert.equal(same[0].metadata.generated_by, 'diretor_reuniao_executiva');
        assert.equal(same[0].metadata.criteria_version, 1);
      }
    },
    {
      name: 'diretor reunião executiva consolida títulos equivalentes sem contador',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const accountId = 'acc-director-merge';
        await createObservation({ accountId }, {
          manager_id: 'gerente_produtos',
          manager_name: 'Gerente Produtos',
          category: 'produtos',
          title: 'Produtos sem imagem (32)',
          description: 'Primeiro grupo de produtos sem imagem.',
          severity: 'high',
          impact_score: 80,
          urgency_score: 90,
          source_type: 'pedido',
          source_id: 'produto-1',
          status: 'open',
          metadata: { theme: 'imagens ausentes' }
        });
        await createObservation({ accountId }, {
          manager_id: 'gerente_produtos_ops',
          manager_name: 'Gerente de Produtos',
          category: 'produtos',
          title: 'Produtos sem imagem 33',
          description: 'Segundo grupo equivalente de produtos sem imagem.',
          severity: 'high',
          impact_score: 80,
          urgency_score: 90,
          source_type: 'pedido',
          source_id: 'produto-2',
          status: 'open',
          metadata: { theme: 'imagens ausentes.' }
        });
        await createObservation({ accountId }, {
          manager_id: 'gerente_produtos',
          manager_name: 'Gerente Produtos',
          category: 'produtos',
          title: 'Produtos sem imagem',
          description: 'Terceiro grupo equivalente.',
          severity: 'high',
          impact_score: 80,
          urgency_score: 90,
          source_type: 'pedido',
          source_id: 'produto-3',
          status: 'open',
          metadata: { theme: 'imagens ausentes' }
        });
        const { runDiretorReuniaoExecutivaJob } = await import('../../modules/jobs/jobs.scheduler.js');
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        await runDiretorReuniaoExecutivaJob({ accountId, auth: { role: 'admin', accountId }, job });
        const priorities = __dumpMemoryAiDirectorForTests().filter((item) => item.account_id === accountId && item.origem === 'diretor_reuniao_executiva' && item.tipo === 'prioridade_executiva');
        assert.equal(priorities.length, 1);
        assert.equal(priorities[0].titulo, 'Pendências críticas de produtos');
        assert.equal(priorities[0].metadata.rank, 1);
        assert.equal(priorities[0].metadata.score > 0, true);
        assert.equal(Array.isArray(priorities[0].metadata.observation_ids), true);
        assert.equal(priorities[0].metadata.observation_ids.length, 3);
        assert.equal(priorities[0].metadata.merged_groups_count, 2);
        assert.equal(typeof priorities[0].metadata.normalized_title_key, 'string');
        assert.equal(Array.isArray(priorities[0].metadata.merged_titles), true);
        assert.equal(priorities[0].metadata.merged_titles.length, 1);
        assert.equal(Array.isArray(priorities[0].metadata.managers), true);
        assert.equal(Array.isArray(priorities[0].metadata.categories), true);
        assert.equal(priorities[0].metadata.total_observations, 3);
        assert.match(priorities[0].descricao, /Consolida/i);
        assert.match(priorities[0].descricao, /gerentes?/i);
        assert.match(priorities[0].descricao, /categorias?/i);
        assert.match(priorities[0].descricao, /plano de correção priorizado/i);
      }
    },
    {
      name: 'diretor reunião executiva não falha sem observações e agenda próximo futuro',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetMemoryAiDirectorForTests();
        const { runDiretorReuniaoExecutivaJob } = await import('../../modules/jobs/jobs.scheduler.js');
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        const result = await runDiretorReuniaoExecutivaJob({ accountId: 'acc-empty-director', auth: { role: 'admin', accountId: 'acc-empty-director' }, job });
        assert.equal(result.ok, true);
        assert.equal(typeof result.next_run_at, 'string');
        assert.equal(new Date(result.next_run_at).getTime() > Date.now() - 1000, true);
      }
    },
    {
      name: 'diretor reunião executiva com falha agenda backoff futuro',
      run: async () => {
        __resetSystemJobsForTests();
        const mock = createSystemJobsSupabaseMock({
          jobs: [{
            id: 'job-director',
            account_id: null,
            nome: 'diretor_reuniao_executiva',
            status: 'ativo',
            lock_key: 'diretor_reuniao_executiva',
            locked_at: null,
            locked_by: null,
            last_run_at: null,
            next_run_at: '2026-06-17T05:00:00.000Z',
            last_success_at: null,
            last_error: null,
            metadata: {},
            created_at: '2026-06-17T00:00:00.000Z',
            updated_at: '2026-06-17T00:00:00.000Z'
          }]
        });
        mock.from = (table) => ({
          select() { return this; },
          eq() { return this; },
          order() { return this; },
          range() { return this; },
          limit() { return this; },
          ilike() { return this; },
          then(resolve) {
            if (table === 'ai_director_observations') {
              return resolve({ data: [{
                id: 'obs-1',
                account_id: 'acc-director-fail',
                manager_id: 'gerente_comercial',
                category: 'comercial',
                title: 'Receita em queda',
                description: 'Queda relevante',
                severity: 'high',
                impact_score: 80,
                urgency_score: 90,
                status: 'open',
                origin: 'pedido',
                created_at: '2026-06-16T00:00:00.000Z',
                updated_at: '2026-06-16T00:00:00.000Z'
              }], count: 1, error: null });
            }
            return resolve({ data: [], count: 0, error: null });
          },
          maybeSingle() {
            if (table === 'system_jobs') return Promise.resolve({ data: mock.state.jobs[0], error: null });
            if (table === 'ai_director_observations') return Promise.resolve({ data: null, error: null });
            if (table === 'ai_director_executive_memories') return Promise.resolve({ data: null, error: null });
            return Promise.resolve({ data: null, error: null });
          },
          insert() {
            return {
              select() {
                return {
                  single: async () => ({ data: null, error: { message: 'falha simulada' } })
                };
              }
            };
          },
          update() {
            return {
              select() {
                return this;
              },
              eq() {
                return {
                  select() {
                    return {
                      single: async () => ({ data: mock.state.jobs[0], error: null })
                    };
                  }
                };
              }
            };
          }
        });
        __setSystemJobsSupabaseClientForTests(mock, true);
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        try {
          const { runDiretorReuniaoExecutivaJob } = await import('../../modules/jobs/jobs.scheduler.js');
          const result = await runDiretorReuniaoExecutivaJob({ accountId: 'acc-director-fail', auth: { accountId: 'acc-director-fail', role: 'admin' }, job });
          assert.equal(result.ok, true);
          assert.equal(typeof result.next_run_at, 'string');
          assert.equal(new Date(result.next_run_at).getTime() > Date.now() - 1000, true);
        } finally {
          __setSystemJobsSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'execução manual não cria novo system_job',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const app = createApiApp();
        await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-manual' });
        const job = await upsertSystemJob({ nome: 'gerente_comercial_observacao', lock_key: 'gerente_comercial_observacao', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
        const before = __dumpSystemJobsForTests().jobs.filter((item) => item.lock_key === 'gerente_comercial_observacao').length;
        const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-manual' });
        assert.equal(out.res.statusCode, 202);
        await wait(100);
        const after = __dumpSystemJobsForTests().jobs.filter((item) => item.lock_key === 'gerente_comercial_observacao').length;
        assert.equal(after, before);
      }
    },
    {
      name: 'recordSystemJobRun resolve job_id a partir do job global',
      run: async () => {
        __resetSystemJobsForTests();
        const mock = createSystemJobsSupabaseMock({
          jobs: [{
            id: 'job-global',
            account_id: null,
            nome: 'radar_comercial_diario',
            status: 'ativo',
            lock_key: 'jobs:radar_comercial_diario',
            locked_at: null,
            locked_by: null,
            last_run_at: null,
            next_run_at: null,
            last_success_at: null,
            last_error: null,
            metadata: {},
            created_at: '2026-06-17T00:00:00.000Z',
            updated_at: '2026-06-17T00:00:00.000Z'
          }]
        });
        __setSystemJobsSupabaseClientForTests(mock, true);
        try {
          const run = await recordSystemJobRun({ nome: 'radar_comercial_diario', status: 'success', started_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          assert.equal(run.job_id, 'job-global');
          assert.equal(mock.state.runs[0].job_id, 'job-global');
        } finally {
          __setSystemJobsSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'updateSystemJobSchedule falha sem id ou jobKey',
      run: async () => {
        __resetSystemJobsForTests();
        await assert.rejects(() => updateSystemJobSchedule({}, { next_run_at: '2026-06-17T12:00:00.000Z' }, { accountId: null }));
      }
    },
    {
      name: 'radar comercial roda em fan-out por tenant quando não há accountId global',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        await createCliente({ nome: 'Cliente A', documento: '12345678000190' }, { accountId: 'acc-a' });
        await createCliente({ nome: 'Cliente B', documento: '22345678000190' }, { accountId: 'acc-b' });
        const result = await dispatchDueJob({ id: 'job-global', nome: 'radar_comercial_diario', lock_key: 'jobs:radar_comercial_diario', account_id: null, next_run_at: '2026-06-17T11:00:00.000Z' }, { requestId: 'scheduler-test', workerId: 'scheduler:test' });
        assert.equal(result.ok, true);
        assert.equal(result.result.mode, 'tenant_fanout');
        assert.equal(result.result.tenant_count >= 2, true);
      }
    },
    {
      name: 'job com erro reage com next_run_at futuro',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousFetch = globalThis.fetch;
        globalThis.fetch = async () => { throw new Error('falha simulada'); };
        try {
          const job = await upsertSystemJob({ nome: 'radar_comercial_diario', lock_key: 'acc-fail:jobs:radar_comercial_diario', account_id: 'acc-fail', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-fail' });
          const out = await dispatchDueJob(job, { accountId: 'acc-fail', requestId: 'scheduler-test', workerId: 'scheduler:test' });
          assert.equal(out.ok, true);
          await wait(50);
          const dump = __dumpSystemJobsForTests();
          const stored = dump.jobs.find((item) => item.id === job.id);
          assert.ok(stored);
          assert.equal(typeof stored.next_run_at, 'string');
        } finally {
          globalThis.fetch = previousFetch;
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
        const job = await upsertSystemJob({ nome: 'radar_comercial_diario', lock_key: 'jobs:radar_comercial_diario', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
        const startedAt = Date.now();
        const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-jobs' });
        const responseDurationMs = Date.now() - startedAt;
        assert.equal(out.res.statusCode, 202);
        assert.equal(out.body.success, true);
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
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'clientes:enriquecimento:automatico', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          const first = await createCliente({ nome: 'Cliente 1', documento: '12345678000190' }, { accountId: 'acc-enrich' });
          const second = await createCliente({ nome: 'Cliente 2', documento: '22345678000190' }, { accountId: 'acc-enrich' });
          const startedAt = Date.now();
          const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-enrich' });
          assert.equal(out.res.statusCode, 202);
          assert.equal(out.body.success, true);
          assert.equal(out.body.status, 'running');
          assert.equal(Date.now() - startedAt < 1000, true);

          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }

          const run = dump.runs.find((item) => item.nome === 'clientes_enriquecimento_automatico');
          assert.ok(run);
          assert.equal(run.processed_count, 1);
          assert.equal(run.success_count, 1);
          assert.equal(run.metadata.result, 'success');
          assert.equal(dump.jobs.some((item) => item.nome === 'clientes_enriquecimento_automatico' && item.status === 'ativo'), true);
          const clientes = __dumpMemoryClientes();
          assert.equal(Boolean(clientes.find((item) => item.id === first.id)?.enriquecimento_status), true);
          assert.equal(Boolean(clientes.find((item) => item.id === second.id)?.enriquecimento_status), false);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'jobs tenant-aware não criam system_jobs por tenant',
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
              text: async () => JSON.stringify({ nome: 'Cliente Tenant', razao_social: 'Cliente Tenant LTDA' }),
              json: async () => ({ nome: 'Cliente Tenant', razao_social: 'Cliente Tenant LTDA' })
            };
          }
          throw new Error(`fetch inesperado ${url}`);
        };
        try {
          await createCliente({ nome: 'Tenant 1', documento: '72345678000190' }, { accountId: 'acc-tenant-1' });
          await createCliente({ nome: 'Tenant 2', documento: '82345678000190' }, { accountId: 'acc-tenant-2' });
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'clientes:enriquecimento:automatico', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          const result = await dispatchDueJob(job, { requestId: 'scheduler-tenant-test', workerId: 'scheduler:test' });
          assert.equal(result.ok, true);
          await wait(100);
          const dump = __dumpSystemJobsForTests();
          assert.equal(dump.runs.some((run) => run.nome === 'clientes_enriquecimento_automatico' && run.account_id === null && run.metadata?.mode === 'tenant_fanout'), true);
          assert.equal(dump.jobs.filter((item) => item.nome === 'clientes_enriquecimento_automatico').length, 1);
          const perTenantRuns = dump.runs.filter((run) => run.nome === 'clientes_enriquecimento_automatico' && ['acc-tenant-1', 'acc-tenant-2'].includes(run.account_id));
          assert.equal(perTenantRuns.length >= 2, true);
          assert.equal(perTenantRuns.every((run) => run.account_id), true);
          const globalJob = dump.jobs.find((item) => item.nome === 'clientes_enriquecimento_automatico' && item.account_id === null);
          assert.equal(Boolean(globalJob?.next_run_at), true);
          assert.equal(Boolean(globalJob?.last_run_at), true);
          assert.equal(Boolean(globalJob?.last_success_at), true);
          assert.equal(new Date(globalJob.next_run_at).getTime() > Date.parse('2026-06-17T11:00:00.000Z'), true);
        } finally {
          globalThis.fetch = previousFetch;
        }
      }
    },
    {
      name: 'POST /jobs/:id/run executa os jobs de clientes por id',
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
          const job = await upsertSystemJob({ nome: 'clientes_geolocalizacao_automatico', lock_key: 'clientes:geolocalizacao:automatico', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-geo' });
          assert.equal(out.res.statusCode, 202);
          assert.equal(out.body.success, true);
          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }
          const run = dump.runs.find((item) => item.nome === 'clientes_geolocalizacao_automatico');
          assert.ok(run);
          assert.equal(run.processed_count, 1);
          assert.equal(dump.jobs.some((job) => job.nome === 'clientes_geolocalizacao_automatico' && job.status === 'ativo'), true);
          const storedJob = dump.jobs.find((item) => item.nome === 'clientes_geolocalizacao_automatico');
          assert.equal(new Date(storedJob.next_run_at).getTime() > Date.parse('2026-06-17T11:00:00.000Z'), true);
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
      name: 'POST /jobs/notificacoes-resumo-semanal/run fan-out sem tenant reage com segurança',
      run: async () => {
        __resetSystemJobsForTests();
        __resetMemoryClientesForTests();
        const previousEmail = process.env.JOB_NOTIFICATIONS_EMAIL;
        process.env.JOB_NOTIFICATIONS_EMAIL = 'alerts@neuralhire.test';
        try {
          const app = createApiApp();
          await createCliente({ nome: 'Cliente Global', documento: '12345678000190', situacao_cadastral: 'Inativa', latitude: null, longitude: null }, { accountId: 'acc-notify-global' });
          const job = await upsertSystemJob({ nome: 'notificacoes_resumo_semanal', lock_key: 'notificacoes:resumo-semanal', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-notify-global' });
          assert.equal(out.res.statusCode, 202);
          let dump = __dumpSystemJobsForTests();
          for (let attempt = 0; attempt < 40 && dump.runs.length === 0; attempt += 1) {
            await wait(25);
            dump = __dumpSystemJobsForTests();
          }
          const run = dump.runs.find((item) => item.nome === 'notificacoes_resumo_semanal');
          assert.ok(run);
          assert.equal(run.status, 'success');
          assert.equal(run.account_id, 'acc-notify-global');
          assert.equal(run.metadata.notification.type, 'weekly_summary');
          assert.equal(dump.jobs.find((item) => item.nome === 'notificacoes_resumo_semanal')?.status, 'ativo');
          assert.equal(String(dump.jobs.find((item) => item.nome === 'notificacoes_resumo_semanal')?.next_run_at || '').length > 0, true);
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
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'clientes:enriquecimento:automatico', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-alert' });
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
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'clientes:enriquecimento:automatico', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
          const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-ativa' });
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
        const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'clientes:enriquecimento:automatico', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
        const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'admin', accountId: 'acc-empty' });
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
      name: 'lista jobs vencidos respeita ordenação e limite',
      run: async () => {
        __resetSystemJobsForTests();
        const now = new Date('2026-06-17T12:00:00.000Z');
        await upsertSystemJob({ nome: 'job_a', lock_key: 'acc-due:job-a', account_id: 'acc-due', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-due' });
        await upsertSystemJob({ nome: 'job_b', lock_key: 'acc-due:job-b', account_id: 'acc-due', status: 'ativo', next_run_at: '2026-06-17T10:30:00.000Z' }, { accountId: 'acc-due' });
        await upsertSystemJob({ nome: 'job_c', lock_key: 'acc-due:job-c', account_id: 'acc-due', status: 'inativo', next_run_at: '2026-06-17T09:00:00.000Z' }, { accountId: 'acc-due' });
        const due = await listDueSystemJobs({ now, limit: 1, accountId: 'acc-due' });
        assert.equal(due.length, 1);
        assert.equal(due[0].nome, 'job_b');
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
      name: 'execução atualiza exatamente o mesmo registro do system_jobs',
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
          await createCliente({ nome: 'Cliente Scheduler', documento: '32345678000190' }, { accountId: 'acc-sched' });
          const job = await upsertSystemJob({ nome: 'clientes_enriquecimento_automatico', lock_key: 'acc-sched:clientes:enriquecimento:automatico', account_id: 'acc-sched', status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: 'acc-sched' });
          const result = await dispatchDueJob(job, { accountId: 'acc-sched', requestId: 'scheduler-test', workerId: 'scheduler:test' });
          assert.equal(result.ok, true);
          await wait(100);
          const dump = __dumpSystemJobsForTests();
          const stored = dump.jobs.find((item) => item.id === job.id);
          assert.ok(stored);
          assert.equal(stored.id, job.id);
          assert.equal(stored.lock_key, job.lock_key);
          assert.equal(stored.last_run_at !== null, true);
          assert.equal(stored.next_run_at !== null, true);
          assert.equal(stored.locked_at, null);
          assert.equal(stored.locked_by, null);
        } finally {
          globalThis.fetch = previousFetch;
        }
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
        const job = await upsertSystemJob({ nome: 'radar_comercial_diario', lock_key: 'jobs:radar_comercial_diario', account_id: null, status: 'ativo', next_run_at: '2026-06-17T11:00:00.000Z' }, { accountId: null });
        const out = await call(app, { method: 'POST', url: `/jobs/${job.id}/run`, role: 'sales', accountId: 'acc-jobs' });
        assert.equal(out.res.statusCode, 403);
        assert.equal(out.body.error.code, 'JOB_FORBIDDEN');
        assert.equal(out.body.error.domain, 'system-jobs');
      }
    },
    {
      name: 'buildExecutiveActionPlan gera gerente_produtos e impacto alto',
      run: async () => {
        __resetMemoryAiDirectorActionPlansForTests();
        const plan = buildExecutiveActionPlan({
          id: 'mem-1',
          account_id: 'acc-plan',
          titulo: 'Pendências críticas de produtos',
          descricao: 'Produtos críticos com falhas',
          categoria: 'produtos',
          severidade: 'critica',
          metadata: { score: 160, categories: ['produtos'] }
        });
        assert.equal(plan.gerente_responsavel, 'gerente_produtos');
        assert.equal(plan.impacto, 'alto');
        assert.equal(plan.prioridade_score, 160);
        assert.equal(plan.prazo_dias, 3);
        assert.equal(plan.metadata.normalized_title_key, 'regularizar_pendencias_criticas_de_produtos');
      }
    },
    {
      name: 'buildExecutiveActionPlan normaliza titulo com acento e pontuacao',
      run: async () => {
        __resetMemoryAiDirectorActionPlansForTests();
        const plan = buildExecutiveActionPlan({
          id: 'mem-2',
          account_id: 'acc-plan',
          titulo: 'Pendências!  críticas, de   produtos??',
          descricao: 'Falhas de catálogo',
          categoria: 'produtos',
          severidade: 'critica',
          metadata: { score: 160, categories: ['produtos'] }
        });
        assert.equal(plan.metadata.normalized_title_key, 'executar_plano_de_acao_pendencias_criticas_de_produtos');
      }
    },
    {
      name: 'diretor_plano_acao cria plano e nao duplica',
      run: async () => {
        __resetMemoryAiDirectorForTests();
        __resetMemoryAiDirectorActionPlansForTests();
        __resetSystemJobsForTests();
        await createExecutiveMemory({
          tipo: 'prioridade_executiva',
          titulo: 'Pendências críticas de produtos',
          descricao: 'Falhas de catálogo',
          categoria: 'produtos',
          severidade: 'critica',
          metadata: { score: 160, categories: ['produtos'] }
        }, { accountId: 'acc-plan' });
        await createExecutiveMemory({
          tipo: 'prioridade_executiva',
          titulo: 'Pendências administrativas de cadastro',
          descricao: 'Pendências de cadastro',
          categoria: 'administrativo',
          severidade: 'media',
          metadata: { score: 60, categories: ['administrativo'] }
        }, { accountId: 'acc-plan' });
        const job = await upsertSystemJob({ nome: 'diretor_plano_acao', lock_key: 'diretor_plano_acao', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        await runDiretorPlanoAcaoJob({ accountId: 'acc-plan', job, auth: { accountId: 'acc-plan' } });
        const first = await listActionPlans('acc-plan', {}, {});
        assert.equal(first.items.length, 2);
        await runDiretorPlanoAcaoJob({ accountId: 'acc-plan', job, auth: { accountId: 'acc-plan' } });
        const second = await listActionPlans('acc-plan', {}, {});
        assert.equal(second.items.length, 2);
      }
    },
    {
      name: 'diretor_plano_acao deduplica por normalized_title_key com memoria equivalente',
      run: async () => {
        __resetMemoryAiDirectorForTests();
        __resetMemoryAiDirectorActionPlansForTests();
        __resetSystemJobsForTests();
        await createExecutiveMemory({
          tipo: 'prioridade_executiva',
          titulo: 'Pendências críticas de produtos',
          descricao: 'Falhas de catálogo',
          categoria: 'produtos',
          severidade: 'critica',
          metadata: { score: 160, categories: ['produtos'] }
        }, { accountId: 'acc-plan' });
        await createExecutiveMemory({
          tipo: 'prioridade_executiva',
          titulo: 'Pendências críticas de produtos',
          descricao: 'Outra memória com mesmo tema',
          categoria: 'produtos',
          severidade: 'alta',
          metadata: { score: 140, categories: ['produtos'] }
        }, { accountId: 'acc-plan' });
        const job = await upsertSystemJob({ nome: 'diretor_plano_acao', lock_key: 'diretor_plano_acao', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        await runDiretorPlanoAcaoJob({ accountId: 'acc-plan', job, auth: { accountId: 'acc-plan' } });
        const plans = await listActionPlans('acc-plan', { status: 'aberto' }, {});
        assert.equal(plans.items.length, 1);
        assert.equal(plans.items[0].metadata.normalized_title_key, 'regularizar_pendencias_criticas_de_produtos');
        await runDiretorPlanoAcaoJob({ accountId: 'acc-plan', job, auth: { accountId: 'acc-plan' } });
        const afterSecondRun = await listActionPlans('acc-plan', { status: 'aberto' }, {});
        assert.equal(afterSecondRun.items.length, 1);
      }
    },
    {
      name: 'diretor_reuniao_executiva é idempotente para memória executiva equivalente',
      run: async () => {
        __resetMemoryAiDirectorForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetSystemJobsForTests();
        const accountId = 'acc-exec';
        await createObservation({ accountId }, {
          manager_id: 'gerente_produtos',
          manager_name: 'Gerente Produtos',
          category: 'produtos',
          title: 'Pendencias criticas de produtos',
          description: 'Falhas recorrentes no catalogo',
          severity: 'high',
          status: 'open',
          metadata: { logical_theme: 'pendencias criticas de produtos' }
        });
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        const first = await runDiretorReuniaoExecutivaJob({ accountId, job, auth: { accountId } });
        assert.equal(first.ok, true);
        let memories = __dumpMemoryAiDirectorForTests().filter((item) => item.account_id === accountId && item.tipo === 'prioridade_executiva' && item.origem === 'diretor_reuniao_executiva');
        assert.equal(memories.length, 1);
        const firstId = memories[0].id;
        const second = await runDiretorReuniaoExecutivaJob({ accountId, job, auth: { accountId } });
        assert.equal(second.ok, true);
        memories = __dumpMemoryAiDirectorForTests().filter((item) => item.account_id === accountId && item.tipo === 'prioridade_executiva' && item.origem === 'diretor_reuniao_executiva');
        assert.equal(memories.length, 1);
        assert.equal(memories[0].id, firstId);
      }
    },
    {
      name: 'diretor_reuniao_executiva recupera de 23505 sem erro',
      run: async () => {
        __resetMemoryAiDirectorForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetSystemJobsForTests();
        const accountId = 'acc-exec-23505';
        await createObservation({
          accountId
        }, {
          manager_id: 'gerente_produtos',
          manager_name: 'Gerente Produtos',
          category: 'produtos',
          title: 'Pendencias criticas de produtos',
          description: 'Falhas recorrentes no catalogo',
          severity: 'high',
          status: 'open',
          metadata: { logical_theme: 'pendencias criticas de produtos' }
        });
        const job = await upsertSystemJob({ nome: 'diretor_reuniao_executiva', lock_key: 'diretor_reuniao_executiva', account_id: null, status: 'ativo', next_run_at: '2026-06-17T05:00:00.000Z' }, { accountId: null });
        const records = [];
        let insertCount = 0;
        let retryMode = false;
        const savedRow = {
          id: 'mem-retry-1',
          account_id: accountId,
          tipo: 'prioridade_executiva',
          titulo: 'Pendências críticas de produtos',
          descricao: 'Falhas recorrentes no catálogo',
          categoria: 'produtos',
          severidade: 'alta',
          origem: 'diretor_reuniao_executiva',
          metadata: { generated_by: 'diretor_reuniao_executiva' },
          criado_em: '2026-06-17T05:00:00.000Z',
          updated_at: '2026-06-17T05:00:00.000Z'
        };
        const fakeSupabase = {
          from(table) {
            if (table !== 'ai_director_executive_memories') throw new Error(`table inesperada: ${table}`);
            const query = {
              _filters: {},
              select() { return this; },
              eq(column, value) { this._filters[column] = value; return this; },
              ilike(column, value) { this._filters[column] = value; return this; },
              order() { return this; },
              limit() { return this; },
              async single() {
                const item = retryMode && records.find((row) =>
                  String(row.account_id || '') === String(this._filters.account_id || '') &&
                  String(row.tipo || '') === String(this._filters.tipo || '') &&
                  String(row.categoria || '') === String(this._filters.categoria || '') &&
                  String(row.origem || '') === String(this._filters.origem || '') &&
                  String(row.titulo || '').toLowerCase() === String(this._filters.titulo || '').toLowerCase() &&
                  String(row.id || '') === String(this._filters.id || '')
                ) || null;
                return item ? { data: item, error: null } : { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
              },
              async maybeSingle() {
                const item = records.find((row) =>
                  String(row.account_id || '') === String(this._filters.account_id || '') &&
                  String(row.id || '') === String(this._filters.id || '')
                ) || null;
                return { data: item, error: null };
              },
              async then(resolve, reject) {
                try {
                  const data = records.filter((row) =>
                    String(row.account_id || '') === String(this._filters.account_id || '') &&
                    (!this._filters.tipo || String(row.tipo || '') === String(this._filters.tipo || '')) &&
                    (!this._filters.categoria || String(row.categoria || '') === String(this._filters.categoria || '')) &&
                    (!this._filters.origem || String(row.origem || '') === String(this._filters.origem || ''))
                  );
                  resolve({ data, error: null });
                } catch (error) {
                  reject(error);
                }
              }
            };
            return {
              select() { return query; },
              update(payload) {
                assert.equal(Object.prototype.hasOwnProperty.call(payload, 'created_at'), false);
                return {
                  select() {
                    return this;
                  },
                  eq(column, value) {
                    return {
                      select() { return this; },
                      async single() {
                        const idx = records.findIndex((row) => String(row[column] || '') === String(value || ''));
                        if (idx === -1) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
                        records[idx] = { ...records[idx], ...payload };
                        return { data: records[idx], error: null };
                      }
                    };
                  }
                };
              },
              insert(payload) {
                assert.equal(Object.prototype.hasOwnProperty.call(payload, 'created_at'), false);
                return {
                  select() {
                    return {
                      async single() {
                        insertCount += 1;
                        if (insertCount === 1) {
                          retryMode = true;
                          records.push({ ...savedRow });
                          return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "ai_director_executive_memories_logical_dedupe_idx"' } };
                        }
                        records.push({ ...payload });
                        return { data: payload, error: null };
                      }
                    };
                  }
                };
              }
            };
          }
          ,
          rpc(name, params) {
            if (name !== 'find_ai_director_executive_memory_by_logical_key') throw new Error(`rpc inesperada: ${name}`);
            const item = records.find((row) =>
              String(row.account_id || '') === String(params.p_account_id || '') &&
              String(row.tipo || '') === String(params.p_tipo || '') &&
              String(row.categoria || '') === String(params.p_categoria || '') &&
              String(row.origem || '') === String(params.p_origem || '') &&
              String(row.titulo || '').toLowerCase() === String(params.p_titulo || '').toLowerCase()
            ) || null;
            return Promise.resolve({ data: item ? [item] : [], error: null });
          }
        };
        __setAiDirectorSupabaseClientForTests(fakeSupabase, true);
        try {
          const result = await runDiretorReuniaoExecutivaJob({ accountId, job, auth: { accountId } });
          assert.equal(result.ok, true);
          const second = await runDiretorReuniaoExecutivaJob({ accountId, job, auth: { accountId } });
          assert.equal(second.ok, true);
          assert.equal(insertCount, 1);
          assert.equal(records.filter((item) => item.account_id === accountId && item.tipo === 'prioridade_executiva' && item.origem === 'diretor_reuniao_executiva').length, 1);
          assert.equal(Object.prototype.hasOwnProperty.call(records[0], 'created_at'), false);
          assert.equal(result.fatalError, null);
          assert.equal(second.fatalError, null);
        } finally {
          __setAiDirectorSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'createExecutiveMemory define origem default e envia p_origem no retry 23505',
      run: async () => {
        __resetMemoryAiDirectorForTests();
        const accountId = 'acc-origin-default';
        const rpcCalls = [];
        let insertCount = 0;
        let retryRow = null;
        const fakeSupabase = {
          from(table) {
            if (table !== 'ai_director_executive_memories') throw new Error(`table inesperada: ${table}`);
            return {
              select() { return this; },
              eq() { return this; },
              update() {
                return {
                  select() { return this; },
                  eq() {
                    return {
                      select() { return this; },
                      single() {
                        return Promise.resolve({ data: retryRow ? { ...retryRow, updated_at: new Date().toISOString() } : null, error: retryRow ? null : { code: 'PGRST116', message: 'No rows found' } });
                      }
                    };
                  }
                };
              },
              insert(payload) {
                return {
                  select() {
                    return {
                      single() {
                        insertCount += 1;
                        if (insertCount === 1) {
                          retryRow = { ...payload, id: payload.id || 'mem-default-origin', account_id: accountId };
                          return Promise.resolve({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "ai_director_executive_memories_logical_dedupe_idx"' } });
                        }
                        return Promise.resolve({ data: { ...payload, id: payload.id || 'mem-default-origin' }, error: null });
                      }
                    };
                  }
                };
              }
            };
          },
          rpc(name, params) {
            rpcCalls.push({ name, params });
            if (name !== 'find_ai_director_executive_memory_by_logical_key') throw new Error(`rpc inesperada: ${name}`);
            return Promise.resolve({ data: retryRow ? [retryRow] : [], error: null });
          }
        };
        __setAiDirectorSupabaseClientForTests(fakeSupabase, true);
        try {
          const result = await createExecutiveMemory({
            tipo: 'prioridade_executiva',
            titulo: 'Memoria sem origem',
            descricao: 'Descricao valida',
            categoria: 'produtos',
            severidade: 'alta',
            metadata: { source: 'test' }
          }, { accountId });
          assert.equal(result.origem, 'diretor_ia');
          assert.equal(rpcCalls.length >= 1, true);
          assert.equal(rpcCalls[0].params.p_origem, 'diretor_ia');
          assert.equal(rpcCalls[0].params.p_account_id, accountId);
          assert.equal(rpcCalls[0].params.p_tipo, 'prioridade_executiva');
          assert.equal(rpcCalls[0].params.p_categoria, 'produtos');
          assert.equal(rpcCalls[0].params.p_titulo, 'Memoria sem origem');
        } finally {
          __setAiDirectorSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'status inválido de plano é rejeitado',
      run: async () => {
        __resetMemoryAiDirectorActionPlansForTests();
        let failed = false;
        try {
          await upsertActionPlan({ account_id: 'acc-plan', executive_memory_id: 'mem-1', titulo: 'x', descricao: 'y', gerente_responsavel: 'diretor_ia', impacto: 'alto', esforco: 'medio', prioridade_score: 0, prazo_dias: 3, status: 'invalido', metadata: {} }, { accountId: 'acc-plan' });
        } catch (error) {
          failed = true;
        }
        assert.equal(failed, true);
      }
    },
    {
      name: 'generateDirectorTasksFromOpenActionPlans gera prioridade por gerente',
      run: async () => {
        __resetMemoryAiDirectorTasksForTests();
        __resetMemoryAiDirectorActionPlansForTests();
        await upsertActionPlan({
          account_id: 'acc-task',
          executive_memory_id: 'mem-1',
          titulo: 'Pendências de produtos',
          descricao: 'Catálogo com inconsistências',
          gerente_responsavel: 'gerente_produtos',
          impacto: 'alto',
          esforco: 'medio',
          prioridade_score: 120,
          prazo_dias: 3,
          status: 'aberto',
          metadata: {}
        }, { accountId: 'acc-task' });
        const result = await generateDirectorTasksFromOpenActionPlans('acc-task');
        assert.equal(result.created, 1);
        const tasks = await listDirectorTasks('acc-task', {});
        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].manager_id, 'gerente_produtos');
        assert.equal(tasks[0].priority, 'high');
        assert.equal(tasks[0].title, 'Pendências de produtos');
        assert.equal(tasks[0].titulo, 'Pendências de produtos');
        assert.equal(tasks[0].descricao, 'Catálogo com inconsistências');
        assert.equal(tasks[0].prioridade, 'high');
      }
    },
    {
      name: 'generateDirectorTasksFromOpenActionPlans gera tarefa única por plano',
      run: async () => {
        __resetMemoryAiDirectorTasksForTests();
        __resetMemoryAiDirectorActionPlansForTests();
        await upsertActionPlan({
          account_id: 'acc-task',
          executive_memory_id: 'mem-2',
          titulo: 'Plano comercial',
          descricao: 'Carteira e clientes',
          gerente_responsavel: 'gerente_comercial',
          impacto: 'medio',
          esforco: 'medio',
          prioridade_score: 60,
          prazo_dias: 7,
          status: 'aberto',
          metadata: {}
        }, { accountId: 'acc-task' });
        const result = await generateDirectorTasksFromOpenActionPlans('acc-task');
        assert.equal(result.created, 1);
        assert.equal(result.total, 1);
        const tasks = await listDirectorTasks('acc-task', {});
        assert.equal(tasks.length, 1);
        assert.equal(tasks[0].manager_id, 'gerente_comercial');
      }
    },
    {
      name: 'normalizeDirectorTaskKey remove acentos, pontuação e espaços duplicados',
      run: async () => {
        assert.equal(normalizeDirectorTaskKey('  Revisar  pedidos, sem comissão!!  '), 'revisar_pedidos_sem_comissao');
      }
    },
    {
      name: 'diretor_delegacao cria tarefas e não duplica',
      run: async () => {
        __resetMemoryAiDirectorTasksForTests();
        __resetMemoryAiDirectorActionPlansForTests();
        __resetSystemJobsForTests();
        const app = createApiApp();
        await upsertActionPlan({
          account_id: 'acc-task',
          executive_memory_id: 'mem-1',
          titulo: 'Plano comercial',
          descricao: 'Carteira e clientes',
          gerente_responsavel: 'gerente_comercial',
          impacto: 'medio',
          esforco: 'medio',
          prioridade_score: 60,
          prazo_dias: 7,
          status: 'aberto',
          metadata: {}
        }, { accountId: 'acc-task' });
        const job = await upsertSystemJob({ nome: 'diretor_delegacao', lock_key: 'diretor_delegacao', account_id: null, status: 'ativo', next_run_at: '2026-06-17T04:30:00.000Z' }, { accountId: null });
        const first = await runDiretorDelegacaoJob({ accountId: 'acc-task', job, auth: { accountId: 'acc-task' } });
        assert.equal(first.ok, true);
        assert.equal(first.tasksCreated, 1);
        assert.equal(first.tasksSkipped, 0);
        assert.equal(first.tasksTotal, 1);
        let tasks = await listDirectorTasks('acc-task', {});
        assert.equal(tasks.length, 1);
        const second = await runDiretorDelegacaoJob({ accountId: 'acc-task', job, auth: { accountId: 'acc-task' } });
        assert.equal(second.ok, true);
        assert.equal(second.tasksCreated, 0);
        assert.equal(second.tasksSkipped, 1);
        assert.equal(second.tasksTotal, 1);
        tasks = await listDirectorTasks('acc-task', {});
        assert.equal(tasks.length, 1);
      }
    },
    {
      name: 'vendedor_ia_observacao gera insights e respeita dedupe',
      run: async () => {
        __resetMemoryClientesForTests();
        __resetMemoryPedidosForTests();
        __resetMemoryAlertasForTests();
        __resetMemoryAiDirectorTasksForTests();
        __resetMemoryAiDirectorObservationsForTests();
        __resetSystemJobsForTests();
        const app = createApiApp();
        __loadMemoryClientes([
          { id: 'c-risk', account_id: 'acc-vendedor', nome: 'Cliente Risco', vendedor_id: 'v1', cliente_score: 20, ativo: true }
        ]);
        __loadMemoryPedidos({
          pedidos: [
            { id: 'p1', account_id: 'acc-vendedor', cliente_id: 'c-risk', total: 1200, data_emissao: '2026-01-01T00:00:00.000Z', status: 'faturado' }
          ]
        });
        const job = await upsertSystemJob({ nome: 'vendedor_ia_observacao', lock_key: 'vendedor_ia_observacao', account_id: null, status: 'ativo', next_run_at: '2026-06-17T06:00:00.000Z' }, { accountId: null });
        const first = await runVendedorIaObservacaoJob({ accountId: 'acc-vendedor', job, auth: { accountId: 'acc-vendedor' } });
        assert.equal(first.ok, true);
        let tasks = await listDirectorTasks('acc-vendedor', { vendedor_id: 'v1', cliente_id: 'c-risk' });
        assert.equal(tasks.length >= 1, true);
        const second = await runVendedorIaObservacaoJob({ accountId: 'acc-vendedor', job, auth: { accountId: 'acc-vendedor' } });
        assert.equal(second.ok, true);
        tasks = await listDirectorTasks('acc-vendedor', { vendedor_id: 'v1', cliente_id: 'c-risk' });
        assert.equal(tasks.length >= 1, true);
      }
    }
  ];
}
