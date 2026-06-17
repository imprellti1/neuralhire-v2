import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAdminJobsPage } from './admin-jobs.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('admin jobs page renders empty state, data, actions and errors', async () => {
  const dom = setupFrontendDom('#/admin/jobs');
  let mode = 'empty';
  const calls = [];
  const apiClient = {
    get: async (path) => {
      calls.push(path);
      if (mode === 'error') throw new Error('boom');
      if (path === '/jobs') return { items: mode === 'data' ? [{ id: 'j1', nome: 'radar_comercial_diario', status: 'ativo', locked_at: null, updated_at: '2026-06-17T10:00:00.000Z', metadata: { cadence: 'daily' } }, { id: 'j2', nome: 'clientes_enriquecimento_automatico', status: 'running', locked_at: '2026-06-17T10:05:00.000Z', updated_at: '2026-06-17T10:05:00.000Z', metadata: { cadence: 'adaptive' } }] : [] };
      if (path === '/jobs/runs') return { items: mode === 'data' ? [{ id: 'r1', job_id: 'j1', nome: 'radar_comercial_diario', status: 'success', started_at: '2026-06-17T09:00:00.000Z', duration_ms: 1200, processed_count: 4, success_count: 4, error_count: 0, metadata: { step: 'ok' }, error: null }] : [] };
      if (path === '/jobs/j1') return { item: { id: 'j1', nome: 'radar_comercial_diario', metadata: { cadence: 'daily' } }, runs: [{ id: 'r1', started_at: '2026-06-17T09:00:00.000Z' }] };
      throw new Error(`unexpected path ${path}`);
    },
    post: async () => ({})
  };
  await renderAdminJobsPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Nenhum job encontrado/i);
  mode = 'data';
  document.querySelector('#admin-jobs-refresh')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Radar Comercial Diário/i);
  assert.match(document.body.textContent, /Em execução \/ Bloqueados/i);
  assert.match(document.body.textContent, /Ativos/i);
  assert.match(document.body.textContent, /Últimas execuções/i);
  assert.match(document.body.textContent, /2026/i);
  document.querySelector('.admin-job-run')?.click();
  await flush(); await flush();
  mode = 'error';
  document.querySelector('#admin-jobs-refresh')?.click();
  await flush(); await flush();
  assert.match(document.body.textContent, /Não foi possível carregar os jobs/i);
  assert.ok(calls.includes('/jobs'));
  teardownFrontendDom(dom);
});

test('admin jobs page triggers correct endpoint and success feedback', async () => {
  const dom = setupFrontendDom('#/admin/jobs');
  const calls = [];
  const apiClient = {
    get: async (path) => {
      calls.push(`GET ${path}`);
      if (path === '/jobs') return { items: [{ id: 'j1', nome: 'clientes_enriquecimento_automatico', status: 'idle', updated_at: '2026-06-17T10:00:00.000Z', metadata: {} }] };
      if (path === '/jobs/runs') return { items: [] };
      if (path === '/jobs/j1') return { item: { id: 'j1', nome: 'clientes_enriquecimento_automatico', metadata: {} }, runs: [] };
      return { items: [] };
    },
    post: async (path) => {
      calls.push(`POST ${path}`);
      return { message: 'ok' };
    }
  };
  await renderAdminJobsPage(document.body, { apiClient });
  await flush(); await flush();
  document.querySelector('.admin-job-run')?.click();
  await flush(); await flush();
  assert.ok(calls.includes('POST /jobs/clientes-enriquecimento/run'));
  assert.match(document.body.textContent, /Job iniciado com sucesso/i);
  teardownFrontendDom(dom);
});
