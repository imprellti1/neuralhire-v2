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

function kpiIcon(type) {
  const icons = {
    total: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v10H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 7V5h10v2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11h8M8 14h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    active: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4a8 8 0 1 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v4l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v4m0 3.5h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    running: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  return icons[type] || icons.total;
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'success') return 'is-success';
  if (normalized === 'error') return 'is-error';
  if (normalized === 'running') return 'is-running';
  return '';
}

function isActiveJob(job) {
  return String(job?.status || '').toLowerCase() === 'ativo';
}

function isLockedJob(job) {
  return Boolean(job?.locked_at);
}

export async function renderAdminJobsPage(container, { apiClient, isActiveRoute = () => true } = {}) {
  const state = createAdminJobsState();
  const runTargets = Object.keys(JOB_LABELS);
  let destroyed = false;
  let refreshTimer = null;
  const canRender = () => !destroyed && isActiveRoute();
  container.__adminJobsCleanup = () => {
    destroyed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
  };

  async function load() {
    if (!canRender()) return;
    state.loading = true;
    state.jobsError = null;
    state.runsError = null;
    render();
    try {
      const [jobs, runs] = await Promise.all([
        fetchAdminJobs(apiClient),
        fetchAdminJobRuns(apiClient, state.runFilters)
      ]);
      if (!canRender()) return;
      state.jobs = jobs.items || [];
      state.runs = runs.items || [];
      state.jobsError = null;
      state.runsError = null;
      if (!state.selectedJobId && state.jobs[0]?.id) state.selectedJobId = state.jobs[0].id;
      if (state.selectedJobId) {
        const detail = await fetchAdminJob(apiClient, state.selectedJobId);
        if (!canRender()) return;
        state.selectedJob = detail.item || null;
        state.runs = detail.runs || state.runs;
      }
    } catch (error) {
      if (canRender()) {
        if (String(error?.message || '').toLowerCase().includes('/jobs/runs')) state.runsError = error;
        else state.jobsError = error;
      }
    } finally {
      state.loading = false;
      state.refreshing = false;
      if (canRender()) render();
    }
  }

  async function triggerJob(jobName) {
    state.successMessage = '';
    render();
    try {
      console.info('job_manual_run_clicked', { job_id: jobName });
      console.info('job_manual_run_requested', { job_id: jobName });
      await runAdminJob(apiClient, jobName);
      console.info('job_manual_run_finished', { job_id: jobName });
      state.successMessage = 'Job iniciado com sucesso';
      state.refreshing = true;
      render();
      refreshTimer = setTimeout(() => {
        if (canRender()) void load();
      }, 1200);
    } catch (error) {
      state.error = error;
      if (canRender()) render();
    }
  }

  function openJob(jobId) {
    state.selectedJobId = jobId;
    void load();
  }

  function render() {
    const total = state.jobs.length;
    const active = state.jobs.filter((job) => isActiveJob(job)).length;
    const errored = state.jobs.filter((job) => job.last_error).length;
    const blocked = state.jobs.filter((job) => isLockedJob(job)).length;

    container.innerHTML = `
      <section class="admin-jobs-page">
        <style>
          .admin-jobs-page{display:grid;gap:18px;color:#E5E7EB}
          .admin-jobs-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
          .admin-jobs-title{margin:0;font-size:30px;line-height:1.1;color:#F8FAFC}
          .admin-jobs-subtitle{margin:8px 0 0;color:#94A3B8}
          .admin-jobs-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
          .admin-jobs-btn{height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(15,23,42,.55);color:#E5E7EB;cursor:pointer;transition:background .15s ease,border-color .15s ease,transform .15s ease}
          .admin-jobs-btn:hover{transform:translateY(-1px)}
          .admin-jobs-btn-primary{background:#2563eb;border-color:#2563eb;color:#fff}
          .admin-jobs-btn-primary:hover{background:#1d4ed8;border-color:#1d4ed8}
          .admin-jobs-card{background:rgba(10,20,40,.75);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(12px);border-radius:20px;padding:16px;box-shadow:0 18px 60px rgba(2,8,23,.28)}
          .admin-jobs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
          .admin-jobs-kpi{display:flex;align-items:center;gap:14px;min-height:110px}
          .admin-jobs-kpi-icon{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;flex:0 0 auto}
          .admin-jobs-kpi-icon svg{width:22px;height:22px;display:block}
          .admin-jobs-kpi-icon.total{background:#1d4ed8;color:#dbeafe}
          .admin-jobs-kpi-icon.active{background:#166534;color:#bbf7d0}
          .admin-jobs-kpi-icon.error{background:#991b1b;color:#fecaca}
          .admin-jobs-kpi-icon.running{background:#92400e;color:#fde68a}
          .admin-jobs-kpi-label{font-size:13px;color:#94A3B8}
          .admin-jobs-kpi-value{font-size:30px;font-weight:700;line-height:1;color:#F8FAFC;margin-top:6px}
          .admin-jobs-kpi-copy{display:flex;flex-direction:column;gap:3px}
          .admin-jobs-table-wrap{overflow-x:auto}
          .admin-jobs-table{width:100%;min-width:1080px;border-collapse:collapse;font-size:14px}
          .admin-jobs-table th,.admin-jobs-table td{padding:12px 10px;border-bottom:1px solid rgba(148,163,184,.16);text-align:left;vertical-align:top;color:#E5E7EB}
          .admin-jobs-table th{color:#F8FAFC;font-weight:600;white-space:nowrap}
          .admin-jobs-table tbody tr:hover td{background:rgba(59,130,246,.08)}
          .admin-jobs-muted{color:#94A3B8}
          .admin-jobs-status{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;text-transform:lowercase}
          .admin-jobs-status.is-success{background:#14532d;color:#86efac}
          .admin-jobs-status.is-error{background:#7f1d1d;color:#fca5a5}
          .admin-jobs-status.is-running{background:#78350f;color:#fde68a}
          .admin-jobs-btn-secondary{background:transparent;border-color:rgba(255,255,255,.15)}
          .admin-jobs-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
          .admin-jobs-select,.admin-jobs-input{height:38px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.92);color:#E5E7EB;padding:0 10px}
          .admin-jobs-select option{background:#020617;color:#E5E7EB}
          .admin-jobs-meta-panel{background:#020617}
          .admin-jobs-pre{white-space:pre;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:#020617;color:#cbd5e1;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.08)}
          .admin-jobs-feedback{padding:12px 14px;border-radius:14px}
          .admin-jobs-feedback.success{background:rgba(20,83,45,.5);color:#86efac;border:1px solid rgba(134,239,172,.18)}
          .admin-jobs-feedback.error{background:rgba(127,29,29,.45);color:#fca5a5;border:1px solid rgba(252,165,165,.16)}
          .admin-jobs-empty{color:#94A3B8}
          .admin-jobs-actions-cell{white-space:nowrap}
          .admin-jobs-inline-small{color:#94A3B8;font-size:12px;margin-left:8px}
          .admin-jobs-section-title{margin:0;color:#F8FAFC}
          .admin-jobs-detail-title{margin:0 0 10px;color:#F8FAFC}
          @media (max-width: 1100px){.admin-jobs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
          @media (max-width: 720px){.admin-jobs-grid{grid-template-columns:1fr}.admin-jobs-header{flex-direction:column}.admin-jobs-actions{width:100%;justify-content:flex-start}.admin-jobs-card{padding:14px}}
        </style>
        <header class="admin-jobs-header">
          <div>
            <h1 class="admin-jobs-title">Central de Jobs</h1>
            <p class="admin-jobs-subtitle">Monitore e execute manualmente os jobs administrativos da plataforma.</p>
          </div>
          <div class="admin-jobs-actions">
            <button id="admin-jobs-refresh" class="admin-jobs-btn admin-jobs-btn-primary" type="button">Atualizar</button>
          </div>
        </header>
        ${state.successMessage ? `<div id="admin-jobs-success" class="admin-jobs-feedback success">${esc(state.successMessage)}</div>` : ''}
        ${state.jobsError ? `<div id="admin-jobs-error" class="admin-jobs-feedback error">Não foi possível carregar os jobs.</div>` : ''}
        ${state.runsError ? `<div id="admin-jobs-runs-error" class="admin-jobs-feedback error">Não foi possível carregar as execuções.</div>` : ''}
        <div class="admin-jobs-grid">
          ${[
            ['Total Jobs', total, 'total'],
            ['Ativos', active, 'active'],
            ['Erros', errored, 'error'],
            ['Em execução / Bloqueados', blocked, 'running']
          ].map(([label, value, icon]) => `<article class="admin-jobs-card admin-jobs-kpi"><div class="admin-jobs-kpi-icon ${icon}">${kpiIcon(icon)}</div><div class="admin-jobs-kpi-copy"><div class="admin-jobs-kpi-label">${label}</div><div class="admin-jobs-kpi-value">${esc(value)}</div></div></article>`).join('')}
        </div>
        <article class="admin-jobs-card">
          <h2 class="admin-jobs-section-title">Jobs</h2>
          ${state.loading ? '<p class="admin-jobs-muted">Carregando...</p>' : !state.jobs.length ? '<p class="admin-jobs-empty">Nenhum job encontrado.</p>' : `<div class="admin-jobs-table-wrap"><table class="admin-jobs-table"><thead><tr><th>Nome</th><th>Status</th><th>Última execução</th><th>Último sucesso</th><th>Próxima execução</th><th>Duração</th><th>Erro</th><th>Ações</th></tr></thead><tbody>${state.jobs.map((job) => `<tr><td>${esc(JOB_LABELS[job.nome] || job.nome)}</td><td><span class="admin-jobs-status ${statusClass(job.status)}">${esc(job.status || '-')}</span></td><td>${esc(fmtDate(job.last_run_at))}</td><td>${esc(fmtDate(job.last_success_at))}</td><td>${esc(fmtDate(job.next_run_at))}</td><td>${esc(fmtDuration(job.last_duration_ms))}</td><td>${esc(job.last_error || '-')}</td><td class="admin-jobs-actions-cell"><button type="button" class="admin-job-run admin-jobs-btn admin-jobs-btn-primary" data-id="${esc(job.id)}" data-job="${esc(job.nome)}">Executar agora</button> <button type="button" class="admin-job-open admin-jobs-btn admin-jobs-btn-secondary" data-id="${esc(job.id)}">Ver execuções</button></td></tr>`).join('')}</tbody></table></div>`}
        </article>
        <article class="admin-jobs-card">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
            <h2 class="admin-jobs-section-title">Últimas execuções</h2>
            <div class="admin-jobs-filters">
              <select id="admin-jobs-filter-name" class="admin-jobs-select">${['', ...runTargets].map((name) => `<option value="${esc(name)}" ${state.runFilters.nome === name ? 'selected' : ''}>${name ? esc(JOB_LABELS[name]) : 'Todos jobs'}</option>`).join('')}</select>
              <select id="admin-jobs-filter-status" class="admin-jobs-select"><option value="">Todos status</option><option value="success">success</option><option value="error">error</option><option value="running">running</option></select>
              <input id="admin-jobs-filter-limit" class="admin-jobs-input" type="number" min="1" max="100" value="${esc(state.runFilters.limit)}" style="width:90px">
            </div>
          </div>
          ${state.loading ? '<p class="admin-jobs-muted">Carregando...</p>' : !state.runs.length ? '<p class="admin-jobs-empty">Nenhuma execução encontrada.</p>' : `<div class="admin-jobs-table-wrap"><table class="admin-jobs-table" style="margin-top:12px"><thead><tr><th>Início</th><th>Job</th><th>Status</th><th>Duração</th><th>Processados</th><th>Sucessos</th><th>Erros</th><th>Erro textual</th><th>Metadata</th></tr></thead><tbody>${state.runs.map((run) => `<tr><td>${esc(fmtDate(run.started_at))}</td><td>${esc(JOB_LABELS[run.nome] || run.nome)}</td><td><span class="admin-jobs-status ${statusClass(run.status)}">${esc(run.status || '-')}</span></td><td>${esc(fmtDuration(run.duration_ms))}</td><td>${esc(run.processed_count ?? 0)}</td><td>${esc(run.success_count ?? 0)}</td><td>${esc(run.error_count ?? 0)}</td><td>${esc(run.error || '-')}</td><td><button type="button" class="admin-job-meta admin-jobs-btn admin-jobs-btn-secondary" data-meta="${esc(JSON.stringify(run.metadata || {}))}">Ver JSON</button> <small class="admin-jobs-inline-small">${esc(summaryText(run.metadata))}</small></td></tr>`).join('')}</tbody></table></div>`}
        </article>
        ${state.selectedJob ? `<article class="admin-jobs-card admin-jobs-meta-panel"><h2 class="admin-jobs-detail-title">Detalhe / Metadata</h2><p><strong>${esc(JOB_LABELS[state.selectedJob.nome] || state.selectedJob.nome)}</strong></p><pre id="admin-jobs-detail" class="admin-jobs-pre">${esc(JSON.stringify(state.selectedJob.metadata || {}, null, 2))}</pre></article>` : ''}
      </section>`;

    container.querySelector('#admin-jobs-refresh')?.addEventListener('click', () => { if (canRender()) void load(); });
    container.querySelectorAll('.admin-job-run').forEach((btn) => btn.addEventListener('click', () => triggerJob(btn.getAttribute('data-id') || btn.getAttribute('data-job'))));
    container.querySelectorAll('.admin-job-open').forEach((btn) => btn.addEventListener('click', () => openJob(btn.getAttribute('data-id'))));
    container.querySelector('#admin-jobs-filter-name')?.addEventListener('change', (event) => { state.runFilters.nome = event.target.value; if (canRender()) void load(); });
    container.querySelector('#admin-jobs-filter-status')?.addEventListener('change', (event) => { state.runFilters.status = event.target.value; if (canRender()) void load(); });
    container.querySelector('#admin-jobs-filter-limit')?.addEventListener('change', (event) => { state.runFilters.limit = Number(event.target.value || 20); if (canRender()) void load(); });
    container.querySelectorAll('.admin-job-meta').forEach((btn) => btn.addEventListener('click', async () => {
      await navigator.clipboard?.writeText(btn.getAttribute('data-meta') || '{}').catch(() => {});
    }));
  }

  await load();
}
