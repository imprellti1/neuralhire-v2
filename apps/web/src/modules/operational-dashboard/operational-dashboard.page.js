import { createOperationalDashboardState } from './operational-dashboard.state.js';
import { fetchOperationalDashboardData } from './operational-dashboard.service.js';

function num(value) { return new Intl.NumberFormat('pt-BR').format(value || 0); }
function brl(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0); }

function statusLabel(key) {
  const map = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', faturado: 'Faturado', cancelado: 'Cancelado' };
  return map[String(key || '').toLowerCase()] || key;
}

function injectStyles() {
  if (document.getElementById('nh-operational-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-operational-style';
  style.textContent = `
  .nh-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
  \.nho-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap}
  \.nho-title{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
  \.nho-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  \.nho-filters{display:grid;grid-template-columns:150px 150px 165px 165px 120px;gap:8px}
  \.nho-input,\.nho-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff;color:#16284a}
  \.nho-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  \.nho-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
  \.nho-kpi{background:linear-gradient(180deg,#fff,#f8fbff);border:1px solid #dbe4f2;border-radius:14px;padding:14px}
  \.nho-kpi small{color:#5f6f8e;font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  \.nho-kpi b{display:block;margin-top:8px;font-size:32px;letter-spacing:-.02em;font-weight:800;color:#0e2348}
  \.nho-funnel{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  \.nho-stage{border:1px solid #dbe4f2;border-radius:12px;padding:12px;background:#fbfdff}
  \.nho-stage strong{font-size:13px}
  \.nho-stage .p{height:8px;background:#e7eefc;border-radius:10px;overflow:hidden;margin-top:8px}
  \.nho-stage .p i{display:block;height:100%;background:linear-gradient(90deg,#2f68e7,#4a87ff)}
  \.nho-two{display:grid;grid-template-columns:1.8fr 1fr;gap:10px;margin-top:10px}
  .nh-table{width:100%;font-size:13px;border-collapse:collapse}
  .nh-table th{font-size:12px;color:#607091;text-transform:uppercase;letter-spacing:.04em;background:#f8fbff}
  .nh-table td,.nh-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left}
  .nh-table td:last-child,.nh-table th:last-child{text-align:right}
  .nh-status{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eaf1ff;color:#1d4ed8}
  .nh-alerts{margin:0;padding-left:18px;display:grid;gap:10px}
  .nh-alerts li{color:#4a5874}
  .nh-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nh-state{padding:24px;text-align:center;color:#607091}
  @media (max-width:1280px){\.nho-grid{grid-template-columns:repeat(2,minmax(0,1fr))}\.nho-two{grid-template-columns:1fr}\.nho-funnel{grid-template-columns:repeat(2,1fr)}\.nho-title{font-size:26px}}
  @media (max-width:1024px){\.nho-filters{grid-template-columns:1fr 1fr}\.nho-title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

export function renderOperationalDashboardPage(root, { apiClient }) {
  injectStyles();
  const state = createOperationalDashboardState();

  function render() {
    const d = state.data;
    root.innerHTML = `
      <section class="nho-header">
        <div><div class="nho-title">Dashboard Operacional</div><div class="nho-sub">Execução diária da equipe comercial, com foco em funil e ritmo de pedidos.</div></div>
        <div class="nho-filters">
          <select id="period" class="nho-input"><option value="30d">Últimos 30 dias</option><option value="7d">Últimos 7 dias</option><option value="custom">Personalizado</option></select>
          <select id="status" class="nho-input"><option value="all">Todos</option><option value="rascunho">Rascunho</option><option value="aprovado">Confirmado</option><option value="faturado">Faturado</option><option value="cancelado">Cancelado</option></select>
          <input id="startDate" class="nho-input" type="date" value="${state.filters.startDate}" />
          <input id="endDate" class="nho-input" type="date" value="${state.filters.endDate}" />
          <button id="refresh" class="nho-btn">Atualizar</button>
        </div>
      </section>
      ${state.loading ? `<div class="nh-panel nh-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></div>` : ''}
      ${state.error ? `<div class="nh-panel nh-state">Não foi possível carregar os dados operacionais.<br/><br/><button id="retry" class="nho-btn">Tentar novamente</button></div>` : ''}
      ${!state.loading && !state.error && d ? `
        ${d.empty ? `<div class="nh-panel nh-state">Nenhum dado operacional encontrado.</div>` : `
        <section class="nho-grid">
          <article class="nho-kpi"><small>Pedidos em aberto</small><b>${num(d.resumo.emAberto)}</b></article>
          <article class="nho-kpi"><small>Pedidos confirmados</small><b>${num(d.resumo.confirmados)}</b></article>
          <article class="nho-kpi"><small>Pedidos faturados</small><b>${num(d.resumo.faturados)}</b></article>
          <article class="nho-kpi"><small>Pedidos cancelados</small><b>${num(d.resumo.cancelados)}</b></article>
        </section>
        <section class="nh-panel"><h3>Funil Comercial</h3><div class="nho-funnel">${d.funil.map((f)=>`<div class="nho-stage"><strong>${statusLabel(f.status)}</strong><div>${num(f.quantidade)} pedidos</div><small>${f.percentual}%</small><div class="p"><i style="width:${f.percentual}%"></i></div></div>`).join('')}</div></section>
        <section class="nho-two">
          <article class="nh-panel"><h3>Pedidos Recentes</h3><table class="nh-table"><tr><th>Número/ID</th><th>Cliente</th><th>Valor</th><th>Status</th><th>Data</th></tr>${d.pedidosRecentes.map((p)=>`<tr><td>${p.id}</td><td>${p.cliente}</td><td>${brl(p.valor)}</td><td><span class="nh-status">${statusLabel(p.status)}</span></td><td>${new Date(p.data).toLocaleDateString('pt-BR')}</td></tr>`).join('')}</table></article>
          <article class="nh-panel"><h3>Necessita Atenção</h3>${d.alertas.length ? `<ul class="nh-alerts">${d.alertas.map((a)=>`<li>${a}</li>`).join('')}</ul>` : `<div class="nh-state" style="padding:8px">Sem alertas operacionais no período.</div>`}</article>
        </section>`}
      ` : ''}
    `;

    const refresh = root.querySelector('#refresh'); if (refresh) refresh.onclick = load;
    const retry = root.querySelector('#retry'); if (retry) retry.onclick = load;
    const status = root.querySelector('#status'); if (status) status.value = state.filters.status;
  }

  async function load() {
    state.filters.status = root.querySelector('#status')?.value || state.filters.status;
    state.filters.startDate = root.querySelector('#startDate')?.value || state.filters.startDate;
    state.filters.endDate = root.querySelector('#endDate')?.value || state.filters.endDate;
    state.loading = true; state.error = false; render();
    try { state.data = await fetchOperationalDashboardData(apiClient, state.filters); }
    catch { state.error = true; }
    finally { state.loading = false; render(); }
  }

  render();
  load();
}


