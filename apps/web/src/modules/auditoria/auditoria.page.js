import { createAuditoriaState } from './auditoria.state.js';
import { fetchAuditLogById, fetchAuditLogs } from './auditoria.service.js';

function injectStyles() {
  if (document.getElementById('nh-auditoria-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-auditoria-style';
  style.textContent = `.nha-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06)}.nha-header{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}.nha-title{font-size:30px;font-weight:700}.nha-sub{margin-top:6px;color:#61708f}.nha-tools{display:grid;grid-template-columns:2fr 1fr 1fr 140px;gap:10px}.nha-input,.nha-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nha-btn{background:#1f56dc;color:#fff;font-weight:600;cursor:pointer}.nha-table{width:100%;border-collapse:collapse;font-size:13px}.nha-table th,.nha-table td{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nha-row{cursor:pointer}.nha-row:hover td{background:#f7faff}.nha-badge{padding:4px 9px;border-radius:999px;font-weight:700}.nha-ok{background:#dcfce7;color:#166534}.nha-fail{background:#fee2e2;color:#991b1b}.nha-empty,.nha-error{padding:28px;text-align:center;color:#61708f}.nha-detail{margin-top:16px;padding-top:16px;border-top:1px solid #ebf0f8}.nha-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.nha-pre{background:#0f172a;color:#e2e8f0;padding:14px;border-radius:12px;overflow:auto}@media (max-width:1024px){.nha-tools{grid-template-columns:1fr}.nha-grid{grid-template-columns:1fr}.nha-title{font-size:24px}}`;
  document.head.appendChild(style);
}

export function renderAuditoriaPage(root, { apiClient }) {
  injectStyles();
  const state = createAuditoriaState();

  async function load(page = 1) {
    state.loading = true;
    state.error = false;
    render();
    try {
      const data = await fetchAuditLogs(apiClient, { page, limit: state.pagination.limit, search: state.search, ...state.filters });
      state.items = data.items || [];
      state.pagination = data.pagination || state.pagination;
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function openDetail(id) {
    try {
      state.selected = (await fetchAuditLogById(apiClient, id)).item;
      render();
    } catch {
      state.selected = null;
    }
  }

  function badgeClass(status) { return status === 'failed' ? 'nha-badge nha-fail' : 'nha-badge nha-ok'; }

  function render() {
    root.innerHTML = `
      <section class="nha-header">
        <div><div class="nha-title">Auditoria</div><div class="nha-sub">Consulta global de processos críticos com isolamento por conta.</div></div>
        <div class="nha-tools">
          <input id="nha-search" class="nha-input" placeholder="Busca textual" value="${state.search}">
          <input id="nha-start" class="nha-input" type="date" value="${state.filters.startDate}">
          <input id="nha-end" class="nha-input" type="date" value="${state.filters.endDate}">
          <select id="nha-status" class="nha-input"><option value="">Todos status</option><option value="success">Sucesso</option><option value="failed">Falha</option><option value="partial">Parcial</option></select>
        </div>
      </section>
      <section class="nha-panel">
        ${state.loading ? 'Carregando...' : state.error ? '<div class="nha-error">Não foi possível carregar os logs.</div>' : !state.items.length ? '<div class="nha-empty">Nenhum log encontrado.</div>' : `<table class="nha-table"><tr><th>Data/Hora</th><th>Usuário</th><th>Módulo</th><th>Ação</th><th>Entidade</th><th>Status</th><th>Descrição</th><th>RequestId</th></tr>${state.items.map((item) => `<tr class="nha-row" data-id="${item.id}"><td>${item.created_at || '-'}</td><td>${item.user_nome || item.user_email || item.user_id || '-'}</td><td>${item.modulo || '-'}</td><td>${item.acao || '-'}</td><td>${item.entidade || '-'}</td><td><span class="${badgeClass(item.status)}">${item.status || '-'}</span></td><td>${item.descricao || '-'}</td><td>${item.request_id || '-'}</td></tr>`).join('')}</table>`}
        ${state.selected ? `<div class="nha-detail"><h3>Detalhe do log</h3><div class="nha-grid"><div><strong>Resumo</strong><div>${state.selected.descricao || '-'}</div></div><div><strong>RequestId</strong><div>${state.selected.request_id || '-'}</div></div><div><strong>IP</strong><div>${state.selected.ip || '-'}</div></div><div><strong>User Agent</strong><div>${state.selected.user_agent || '-'}</div></div></div><pre class="nha-pre">${JSON.stringify({ metadata: state.selected.metadata, erro_codigo: state.selected.erro_codigo, erro_mensagem: state.selected.erro_mensagem }, null, 2)}</pre></div>` : ''}
      </section>`;
    root.querySelector('#nha-search').oninput = (e) => { state.search = e.target.value; load(1); };
    root.querySelector('#nha-start').onchange = (e) => { state.filters.startDate = e.target.value; load(1); };
    root.querySelector('#nha-end').onchange = (e) => { state.filters.endDate = e.target.value; load(1); };
    root.querySelector('#nha-status').onchange = (e) => { state.filters.status = e.target.value; load(1); };
    root.querySelectorAll('.nha-row').forEach((row) => { row.onclick = () => openDetail(row.getAttribute('data-id')); });
  }

  render();
  load(1);
}
