import { createAdminJobsState } from './admin-jobs.state.js';
import { fetchAdminJob, fetchAdminJobRuns, fetchAdminJobs, runAdminJob } from './admin-jobs.service.js';

const JOB_LABELS = {
  radar_comercial_diario: 'Radar Comercial Diário',
  clientes_enriquecimento_automatico: 'Clientes Enriquecimento Automático',
  clientes_geolocalizacao_automatico: 'Clientes Geolocalização Automático',
  notificacoes_resumo_semanal: 'Notificações Resumo Semanal'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function fmtDate(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function fmtDuration(value) {
  return value === null || value === undefined ? '-' : `${Math.round(Number(value))} ms`;
}

function summaryText(value) {
  if (!value || typeof value !== 'object') return '-';
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

export async function renderAdminJobsPage(container, { apiClient } = {}) {
  const state = createAdminJobsState();
  const runTargets = Object.keys(JOB_LABELS);

  async function load() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const [jobs, runs] = await Promise.all([
        fetchAdminJobs(apiClient),
        fetchAdminJobRuns(apiClient, state.runFilters)
      ]);
      state.jobs = jobs.items || [];
      state.runs = runs.items || [];
      if (!state.selectedJobId && state.jobs[0]?.id) state.selectedJobId = state.jobs[0].id;
      if (state.selectedJobId) {
        const detail = await fetchAdminJob(apiClient, state.selectedJobId);
        state.selectedJob = detail.item || null;
        state.runs = detail.runs || state.runs;
      }
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      state.refreshing = false;
      render();
    }
  }

  async function triggerJob(jobName) {
    state.successMessage = '';
    render();
    try {
      await runAdminJob(apiClient, jobName);
      state.successMessage = 'Job iniciado com sucesso';
      state.refreshing = true;
      render();
      setTimeout(() => load(), 1200);
    } catch (error) {
      state.error = error;
      render();
    }
  }

  function openJob(jobId) {
    state.selectedJobId = jobId;
    load();
  }

  function render() {
    const total = state.jobs.length;
    const active = state.jobs.filter((job) => ['running', 'active', 'busy'].includes(String(job.status || '').toLowerCase())).length;
    const errored = state.jobs.filter((job) => job.last_error).length;
    const blocked = state.jobs.filter((job) => ['running', 'locked', 'blocked'].includes(String(job.status || '').toLowerCase()) || job.locked_at).length;

    container.innerHTML = `
      <section style="display:grid;gap:18px">
        <header style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <h1 style="margin:0;font-size:30px">Central de Jobs</h1>
            <p style="margin:8px 0 0;color:#91a4c4">Monitoramento e execução manual dos jobs administrativos.</p>
          </div>
          <button id="admin-jobs-refresh" type="button">Atualizar</button>
        </header>
        ${state.successMessage ? `<div id="admin-jobs-success" style="padding:12px 14px;border-radius:12px;background:rgba(52,211,153,.14);color:#34d399">${esc(state.successMessage)}</div>` : ''}
        ${state.error ? `<div id="admin-jobs-error" style="padding:12px 14px;border-radius:12px;background:rgba(248,113,113,.12);color:#f87171">Não foi possível carregar os jobs.</div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
          ${[
            ['Total de jobs', total],
            ['Jobs ativos', active],
            ['Jobs com erro', errored],
            ['Jobs em execução/bloqueados', blocked]
          ].map(([label, value]) => `<article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px"><div style="font-size:12px;color:#61708f">${label}</div><div style="font-size:28px;font-weight:700">${esc(value)}</div></article>`).join('')}
        </div>
        <article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
          <h2 style="margin-top:0">Jobs</h2>
          ${state.loading ? '<p>Carregando...</p>' : !state.jobs.length ? '<p>Nenhum job encontrado.</p>' : `<table style="width:100%;border-collapse:collapse"><thead><tr><th align="left">Nome</th><th align="left">Status</th><th align="left">Última execução</th><th align="left">Último sucesso</th><th align="left">Próxima execução</th><th align="left">Duração</th><th align="left">Erro</th><th align="left">Ações</th></tr></thead><tbody>${state.jobs.map((job) => `<tr style="border-top:1px solid #eef3fb"><td>${esc(JOB_LABELS[job.nome] || job.nome)}</td><td>${esc(job.status || '-')}</td><td>${esc(fmtDate(job.last_run_at))}</td><td>${esc(fmtDate(job.last_success_at))}</td><td>${esc(fmtDate(job.next_run_at))}</td><td>${esc(fmtDuration(job.last_duration_ms))}</td><td>${esc(job.last_error || '-')}</td><td><button type="button" class="admin-job-run" data-job="${esc(job.nome)}">Executar agora</button> <button type="button" class="admin-job-open" data-id="${esc(job.id)}">Ver execuções</button></td></tr>`).join('')}</tbody></table>`}
        </article>
        <article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
            <h2 style="margin:0">Últimas execuções</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <select id="admin-jobs-filter-name">${['', ...runTargets].map((name) => `<option value="${esc(name)}" ${state.runFilters.nome === name ? 'selected' : ''}>${name ? esc(JOB_LABELS[name]) : 'Todos jobs'}</option>`).join('')}</select>
              <select id="admin-jobs-filter-status"><option value="">Todos status</option><option value="success">success</option><option value="error">error</option><option value="running">running</option></select>
              <input id="admin-jobs-filter-limit" type="number" min="1" max="100" value="${esc(state.runFilters.limit)}" style="width:90px">
            </div>
          </div>
          ${state.loading ? '<p>Carregando...</p>' : !state.runs.length ? '<p>Nenhuma execução encontrada.</p>' : `<table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr><th align="left">Início</th><th align="left">Job</th><th align="left">Status</th><th align="left">Duração</th><th align="left">Processados</th><th align="left">Sucessos</th><th align="left">Erros</th><th align="left">Erro textual</th><th align="left">Metadata</th></tr></thead><tbody>${state.runs.map((run) => `<tr style="border-top:1px solid #eef3fb"><td>${esc(fmtDate(run.started_at))}</td><td>${esc(JOB_LABELS[run.nome] || run.nome)}</td><td>${esc(run.status || '-')}</td><td>${esc(fmtDuration(run.duration_ms))}</td><td>${esc(run.processed_count ?? 0)}</td><td>${esc(run.success_count ?? 0)}</td><td>${esc(run.error_count ?? 0)}</td><td>${esc(run.error || '-')}</td><td><button type="button" class="admin-job-meta" data-meta="${esc(JSON.stringify(run.metadata || {}))}">Ver JSON</button> <small>${esc(summaryText(run.metadata))}</small></td></tr>`).join('')}</tbody></table>`}
        </article>
        ${state.selectedJob ? `<article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px"><h2>Detalhe / Metadata</h2><p><strong>${esc(JOB_LABELS[state.selectedJob.nome] || state.selectedJob.nome)}</strong></p><pre id="admin-jobs-detail" style="white-space:pre-wrap;background:#07111f;color:#e2e8f0;padding:14px;border-radius:12px;overflow:auto">${esc(JSON.stringify(state.selectedJob.metadata || {}, null, 2))}</pre></article>` : ''}
      </section>`;

    container.querySelector('#admin-jobs-refresh')?.addEventListener('click', load);
    container.querySelectorAll('.admin-job-run').forEach((btn) => btn.addEventListener('click', () => triggerJob(btn.getAttribute('data-job'))));
    container.querySelectorAll('.admin-job-open').forEach((btn) => btn.addEventListener('click', () => openJob(btn.getAttribute('data-id'))));
    container.querySelector('#admin-jobs-filter-name')?.addEventListener('change', (event) => { state.runFilters.nome = event.target.value; load(); });
    container.querySelector('#admin-jobs-filter-status')?.addEventListener('change', (event) => { state.runFilters.status = event.target.value; load(); });
    container.querySelector('#admin-jobs-filter-limit')?.addEventListener('change', (event) => { state.runFilters.limit = Number(event.target.value || 20); load(); });
    container.querySelectorAll('.admin-job-meta').forEach((btn) => btn.addEventListener('click', async () => {
      await navigator.clipboard?.writeText(btn.getAttribute('data-meta') || '{}').catch(() => {});
    }));
  }

  await load();
}
