import { getApprovalIntelligenceActions, getApprovalIntelligenceDashboard, getApprovalIntelligenceReasons, getApprovalIntelligenceTrends } from './approval-intelligence.service.js';
import { mapApprovalIntelligenceResponse } from './approval-intelligence.mapper.js';
import { createApprovalIntelligenceState } from './approval-intelligence.state.js';

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function color(rate) { return rate > 80 ? '#047857' : rate >= 50 ? '#b45309' : '#b42318'; }
function fmtMs(value) { return `${Math.round(Number(value || 0) / 60000)} min`; }

export async function renderApprovalIntelligencePage(container, { apiClient } = {}) {
  const state = createApprovalIntelligenceState();
  const render = () => {
    if (state.loading) { container.innerHTML = '<section><h1>Approval Intelligence</h1><p>Carregando...</p></section>'; return; }
    if (state.error) { container.innerHTML = `<section><h1>Approval Intelligence</h1><p>Erro ao carregar</p><button id="ai-retry" type="button">Tentar novamente</button></section>`; container.querySelector('#ai-retry')?.addEventListener('click', load); return; }
    const d = state.data || {};
    const summary = d.summary || {};
    container.innerHTML = `
      <section style="display:grid;gap:18px">
        <header><h1>Approval Intelligence</h1><p>Inteligência operacional sobre aprovações e rejeições de drafts.</p></header>
        <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px">
          ${[
            ['Total Drafts', summary.totalDrafts ?? 0],
            ['Taxa Aprovação', `${(summary.approvalRate ?? 0).toFixed(1)}%`],
            ['Taxa Rejeição', `${(summary.rejectionRate ?? 0).toFixed(1)}%`],
            ['Tempo Médio Aprovação', fmtMs(summary.avgApprovalTime)],
            ['Tempo Médio Envio', fmtMs(summary.avgSendTime)]
          ].map(([label, value]) => `<article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px"><div style="font-size:12px;color:#61708f">${label}</div><div style="font-size:28px;font-weight:700">${esc(value)}</div></article>`).join('')}
        </div>
        <article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
          <h2>Top Estratégias</h2>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr><th align="left">Tipo</th><th align="left">Geradas</th><th align="left">Aprovadas</th><th align="left">Rejeitadas</th><th align="left">Taxa</th></tr></thead>
            <tbody>
              ${(d.actions || []).map((row) => `<tr style="border-top:1px solid #eef3fb"><td>${esc(row.type)}</td><td>${esc(row.generated)}</td><td>${esc(row.approved)}</td><td>${esc(row.rejected)}</td><td><span style="color:${color((row.approved / Math.max(1, row.generated)) * 100)};font-weight:700">${((row.approved / Math.max(1, row.generated)) * 100).toFixed(1)}%</span></td></tr>`).join('') || '<tr><td colspan="5">Sem dados</td></tr>'}
            </tbody>
          </table>
        </article>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          <article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
            <h2>Motivos de Rejeição</h2>
            <ul>${(d.reasons || []).map((item) => `<li>${esc(item.reason)} (${esc(item.count)})</li>`).join('') || '<li>Sem dados</li>'}</ul>
          </article>
          <article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
            <h2>Tendência</h2>
            <ul>${(d.trends || []).map((item) => `<li>${esc(item.date)} - ${esc(item.approved)} aprovadas, ${esc(item.rejected)} rejeições</li>`).join('') || '<li>Sem dados</li>'}</ul>
          </article>
        </div>
      </section>`;
  };
  const load = async () => {
    state.loading = true; state.error = null; render();
    try {
      const [dashboard, actions, reasons, trends] = await Promise.all([
        getApprovalIntelligenceDashboard(apiClient),
        getApprovalIntelligenceActions(apiClient),
        getApprovalIntelligenceReasons(apiClient),
        getApprovalIntelligenceTrends(apiClient)
      ]);
      state.data = mapApprovalIntelligenceResponse({
        ...dashboard,
        actions: actions.items || dashboard.actions || [],
        reasons: reasons.items || dashboard.reasons || [],
        trends: trends.items || dashboard.trends || []
      });
    } catch (error) { state.error = error; }
    finally { state.loading = false; render(); }
  };
  await load();
}
