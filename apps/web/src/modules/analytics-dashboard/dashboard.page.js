import { fetchDashboardData } from './dashboard.service.js';
import { createDashboardState } from './dashboard.state.js';

function brl(value) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0); }
function num(value) { return new Intl.NumberFormat('pt-BR').format(value || 0); }

function statusLabel(key) {
  const map = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', faturado: 'Faturado', cancelado: 'Cancelado' };
  return map[String(key || '').toLowerCase()] || key;
}

function chartSvg(points) {
  if (!points.length) return '<div class="nh-empty-inline">Nenhum dado encontrado para o período.</div>';
  const values = points.map((x) => Number(x.totalFaturado || x.total || x.value || 0));
  const max = Math.max(...values, 1);
  const w = 820; const h = 300; const padX = 16; const padY = 20;
  const step = points.length > 1 ? (w - (padX * 2)) / (points.length - 1) : w - (padX * 2);
  const coords = points.map((p, i) => {
    const x = Math.round(padX + (i * step));
    const y = Math.round(h - padY - ((Number(p.totalFaturado || p.total || p.value || 0) / max) * (h - (padY * 2))));
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  const area = `${path} L ${coords[coords.length - 1].x} ${h - padY} L ${coords[0].x} ${h - padY} Z`;
  const grid = [0.25, 0.5, 0.75].map((n) => `<line x1="${padX}" y1="${Math.round(h - padY - (n * (h - (padY * 2))))}" x2="${w - padX}" y2="${Math.round(h - padY - (n * (h - (padY * 2))))}" />`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="nh-chart"><g class="g">${grid}</g><path class="a" d="${area}"/><path class="l" d="${path}"/></svg>`;
}

function injectStyles() {
  if (document.getElementById('nh-analytics-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-analytics-style';
  style.textContent = `
  .nh-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
  \.nhd-header{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;margin-bottom:14px;flex-wrap:wrap}
  \.nhd-title{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.15}
  \.nhd-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  \.nhd-filters{display:grid;grid-template-columns:150px 165px 165px 120px;gap:8px}
  \.nhd-input,\.nhd-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff;color:#16284a}
  \.nhd-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  \.nhd-btn:hover{filter:brightness(1.03)}
  \.nhd-grid-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}
  \.nhd-kpi{background:linear-gradient(180deg,#fff,#f8fbff);border:1px solid #dbe4f2;border-radius:14px;padding:14px}
  \.nhd-kpi small{color:#5f6f8e;font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
  \.nhd-kpi b{display:block;margin-top:8px;font-size:32px;letter-spacing:-.02em;font-weight:800;color:#0e2348}
  \.nhd-main{display:grid;grid-template-columns:1.7fr 1fr;gap:10px;margin-bottom:10px}
  .nh-panel h3{margin:0 0 12px;font-size:15px}
  .nh-chart{width:100%;height:300px}.nh-chart .g line{stroke:#e7edf8;stroke-width:1}.nh-chart .a{fill:rgba(37,99,235,.12)}.nh-chart .l{stroke:#2563eb;stroke-width:3;fill:none;stroke-linecap:round}
  \.nhd-lists{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .nh-table{width:100%;font-size:13px;border-collapse:collapse}
  .nh-table th{font-size:12px;color:#607091;text-transform:uppercase;letter-spacing:.04em;background:#f8fbff}
  .nh-table td,.nh-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left}
  .nh-table tr:last-child td{border-bottom:none}
  .nh-table td:last-child,.nh-table th:last-child{text-align:right}
  .nh-badge{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eaf1ff;color:#1d4ed8}
  .nh-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nh-state,.nh-empty-inline{padding:24px;text-align:center;color:#607091}
  @media (max-width:1280px){\.nhd-grid-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}\.nhd-main,\.nhd-lists{grid-template-columns:1fr}\.nhd-title{font-size:26px}}
  @media (max-width:1024px){\.nhd-filters{grid-template-columns:1fr 1fr}\.nhd-title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

export function renderAnalyticsDashboardPage(root, { apiClient }) {
  injectStyles();
  const state = createDashboardState();

  function render() {
    const d = state.data;
    root.innerHTML = `
    <section class="nhd-header">
      <div><div class="nhd-title">Dashboard Comercial</div><div class="nhd-sub">Visão consolidada de performance, receita e clientes no período selecionado.</div></div>
      <div class="nhd-filters">
        <select id="period" class="nhd-input"><option value="30d">Últimos 30 dias</option><option value="7d">Últimos 7 dias</option><option value="custom">Personalizado</option></select>
        <input id="startDate" class="nhd-input" type="date" value="${state.filters.startDate}" />
        <input id="endDate" class="nhd-input" type="date" value="${state.filters.endDate}" />
        <button id="refresh" class="nhd-btn">Atualizar</button>
      </div>
    </section>
    ${state.loading ? `<div class="nh-panel nh-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></div>` : ''}
    ${state.error ? `<div class="nh-panel nh-state">Não foi possível carregar os indicadores.<br/><br/><button id="retry" class="nhd-btn">Tentar novamente</button></div>` : ''}
    ${!state.loading && !state.error && d ? `
      <section class="nhd-grid-kpi">
        <article class="nhd-kpi"><small>Faturamento</small><b>${brl(d.kpis.faturamento)}</b></article>
        <article class="nhd-kpi"><small>Pedidos</small><b>${num(d.kpis.pedidos)}</b></article>
        <article class="nhd-kpi"><small>Ticket Médio</small><b>${brl(d.kpis.ticketMedio)}</b></article>
        <article class="nhd-kpi"><small>Clientes Compradores</small><b>${num(d.kpis.clientesCompradores)}</b></article>
      </section>
      <section class="nhd-main">
        <article class="nh-panel"><h3>Evolução do Faturamento</h3>${chartSvg(d.timeline)}</article>
        <article class="nh-panel"><h3>Pedidos por Status</h3>${Object.keys(d.pedidosPorStatus).length ? `<table class="nh-table">${Object.entries(d.pedidosPorStatus).map(([k,v])=>`<tr><td><span class="nh-badge">${statusLabel(k)}</span></td><td>${num(v)}</td></tr>`).join('')}</table>` : `<div class="nh-empty-inline">Nenhum dado encontrado para o período.</div>`}</article>
      </section>
      <section class="nhd-lists">
        <article class="nh-panel"><h3>Top Clientes</h3>${d.topClientes.length ? `<table class="nh-table"><tr><th>Cliente</th><th>Total Comprado</th><th>Ticket Médio</th></tr>${d.topClientes.map((c)=>`<tr><td>${c.nomeExibicao || '-'}</td><td>${brl(c.totalComprado)}</td><td>${brl(c.ticketMedio)}</td></tr>`).join('')}</table>` : `<div class="nh-state">Nenhum dado encontrado para o período.</div>`}</article>
        <article class="nh-panel"><h3>Top Produtos</h3>${d.topProdutos.length ? `<table class="nh-table"><tr><th>Produto</th><th>Quantidade</th><th>Faturamento</th></tr>${d.topProdutos.map((p)=>`<tr><td>${p.produtoExibicao || '-'}</td><td>${num(p.quantidadeVendida || p.quantidade || 0)}</td><td>${brl(p.totalVendido || p.faturamento || 0)}</td></tr>`).join('')}</table>` : `<div class="nh-state">Nenhum dado encontrado para o período.</div>`}</article>
      </section>` : ''}
    `;

    const refreshBtn = root.querySelector('#refresh');
    if (refreshBtn) refreshBtn.onclick = load;
    const retry = root.querySelector('#retry');
    if (retry) retry.onclick = load;
  }

  async function load() {
    state.filters.startDate = root.querySelector('#startDate')?.value || state.filters.startDate;
    state.filters.endDate = root.querySelector('#endDate')?.value || state.filters.endDate;
    state.loading = true; state.error = false; render();
    try {
      state.data = await fetchDashboardData(apiClient, state.filters);
      const hasData = state.data.timeline.length || state.data.topClientes.length || state.data.topProdutos.length || Object.keys(state.data.pedidosPorStatus).length;
      if (!hasData) state.data = { ...state.data, empty: true };
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
      if (state.data?.empty && !state.error) {
        const panel = document.createElement('div');
        panel.className = 'nh-panel nh-state';
        panel.textContent = 'Nenhum dado encontrado para o período.';
        root.appendChild(panel);
      }
    }
  }

  render();
  load();
}


