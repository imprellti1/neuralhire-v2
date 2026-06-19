const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR');

function brl(value) {
  return money.format(Number(value || 0));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function injectStyles() {
  if (document.getElementById('nh-vendedor-ia-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-vendedor-ia-style';
  style.textContent = `
    .nhi-wrap{display:grid;gap:16px}
    .nhi-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap}
    .nhi-title{font-size:32px;font-weight:800;letter-spacing:-.03em}
    .nhi-sub{margin-top:6px;color:#91a4c4;max-width:72ch}
    .nhi-tabs{display:flex;gap:8px;flex-wrap:wrap}
    .nhi-tab{border:1px solid rgba(148,163,184,.18);background:#0f1b2f;color:#dbe7fb;border-radius:999px;padding:10px 14px;cursor:pointer}
    .nhi-tab.is-active{background:rgba(79,140,255,.18);border-color:rgba(79,140,255,.36);color:#fff;font-weight:700}
    .nhi-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
    .nhi-kpi,.nhi-card,.nhi-panel{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px}
    .nhi-kpi{padding:16px}
    .nhi-kpi small{display:block;text-transform:uppercase;letter-spacing:.08em;color:#91a4c4;font-size:11px}
    .nhi-kpi b{display:block;margin-top:8px;font-size:26px}
    .nhi-panel{padding:18px}
    .nhi-table{width:100%;border-collapse:collapse}
    .nhi-table th,.nhi-table td{padding:12px 10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;vertical-align:top}
    .nhi-table th{font-size:12px;color:#91a4c4;text-transform:uppercase;letter-spacing:.08em}
    .nhi-badge{display:inline-flex;padding:4px 10px;border-radius:999px;background:rgba(79,140,255,.16);color:#dbe7fb;font-size:12px;font-weight:700}
    .nhi-list{display:grid;gap:12px}
    .nhi-card{padding:16px}
    .nhi-card h4{margin:0 0 4px;font-size:17px}
    .nhi-card p{margin:0;color:#91a4c4}
    .nhi-empty,.nhi-error{padding:24px;text-align:center;color:#91a4c4}
    @media (max-width:1100px){.nhi-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.nhi-title{font-size:28px}}
    @media (max-width:720px){.nhi-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.nhi-title{font-size:24px}.nhi-table{display:block;overflow:auto}}
  `;
  document.head.appendChild(style);
}

function tabButton(id, active, label) {
  return `<button class="nhi-tab ${active === id ? 'is-active' : ''}" data-tab="${id}">${label}</button>`;
}

function renderPortfolio(items = []) {
  if (!items.length) return '<div class="nhi-empty">Nenhum cliente na carteira.</div>';
  return `<div class="nhi-panel"><table class="nhi-table"><thead><tr><th>Cliente</th><th>Cidade</th><th>Score</th><th>Último Pedido</th><th>Dias sem Comprar</th><th>Risco</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(item.nome)}</td><td>${esc(item.cidade || '-')}</td><td>${num.format(item.score || 0)}<div class="nhi-badge">${esc(item.classificacao || '-')}</div></td><td>${item.ultimo_pedido ? new Date(item.ultimo_pedido).toLocaleDateString('pt-BR') : '-'}</td><td>${item.dias_sem_comprar ?? '-'}</td><td><span class="nhi-badge">${esc(item.status_risco || '-')}</span></td></tr>`).join('')}</tbody></table></div>`;
}

function renderCards(items = [], emptyLabel = 'Sem itens.') {
  if (!items.length) return `<div class="nhi-empty">${emptyLabel}</div>`;
  return `<div class="nhi-list">${items.map((item) => `<article class="nhi-card"><h4>${esc(item.cliente || item.nome || 'Cliente')}</h4><p>${esc(item.motivo || item.descricao || '')}</p><p style="margin-top:8px">${brl(item.impacto_estimado || 0)}</p></article>`).join('')}</div>`;
}

export async function renderVendedorIaPage(root, { apiClient }) {
  injectStyles();
  const state = { activeTab: 'overview', loading: true, overview: null, portfolio: [], alerts: [], opportunities: [], tasks: [], performance: null, error: null };

  async function load() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const [overview, portfolio, alerts, opportunities, tasks, performance] = await Promise.all([
        apiClient.get('/ai-sales/overview'),
        apiClient.get('/ai-sales/portfolio'),
        apiClient.get('/ai-sales/alerts'),
        apiClient.get('/ai-sales/opportunities'),
        apiClient.get('/ai-sales/tasks'),
        apiClient.get('/ai-sales/performance')
      ]);
      state.overview = overview;
      state.portfolio = portfolio.items || [];
      state.alerts = alerts.items || [];
      state.opportunities = opportunities.items || [];
      state.tasks = tasks.items || [];
      state.performance = performance;
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  function render() {
    root.innerHTML = `<section class="nhi-wrap"><div class="nhi-head"><div><div class="nhi-title">Vendedor IA</div><div class="nhi-sub">Camada operacional da carteira comercial por vendedor_id, preparada para delegações futuras do Gerente Comercial IA.</div></div><div class="nhi-tabs">${tabButton('overview', state.activeTab, 'Visão Geral')}${tabButton('portfolio', state.activeTab, 'Carteira')}${tabButton('alerts', state.activeTab, 'Alertas')}${tabButton('opportunities', state.activeTab, 'Oportunidades')}${tabButton('tasks', state.activeTab, 'Tarefas')}${tabButton('performance', state.activeTab, 'Performance')}</div></div>${state.error ? '<div class="nhi-error">Falha ao carregar a carteira do vendedor.</div>' : ''}${state.loading ? '<div class="nhi-panel">Carregando...</div>' : ''}${!state.loading && !state.error && state.overview ? `<section class="nhi-kpis"><article class="nhi-kpi"><small>Clientes</small><b>${num.format(state.overview.total_clientes || 0)}</b></article><article class="nhi-kpi"><small>Em risco</small><b>${num.format(state.overview.clientes_em_risco || 0)}</b></article><article class="nhi-kpi"><small>Inativos</small><b>${num.format(state.overview.clientes_inativos || 0)}</b></article><article class="nhi-kpi"><small>Oportunidades</small><b>${num.format(state.overview.oportunidades || 0)}</b></article><article class="nhi-kpi"><small>Faturamento</small><b>${brl(state.overview.faturamento_carteira || 0)}</b></article><article class="nhi-kpi"><small>Ticket médio</small><b>${brl(state.overview.ticket_medio || 0)}</b></article></section>` : ''}${!state.loading && !state.error ? renderTab() : ''}</section>`;
    root.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => { state.activeTab = btn.getAttribute('data-tab'); render(); }));
  }

  function renderTab() {
    if (state.activeTab === 'overview') return `<div class="nhi-panel">${renderPortfolio(state.portfolio.slice(0, 5))}</div>`;
    if (state.activeTab === 'portfolio') return renderPortfolio(state.portfolio);
    if (state.activeTab === 'alerts') return `<div class="nhi-panel">${renderCards(state.alerts, 'Nenhum alerta comercial ativo.')}</div>`;
    if (state.activeTab === 'opportunities') return `<div class="nhi-panel">${renderCards(state.opportunities, 'Nenhuma oportunidade detectada.')}</div>`;
    if (state.activeTab === 'tasks') return `<div class="nhi-panel">${renderCards(state.tasks.map((task) => ({ cliente: task.title || task.titulo || 'Tarefa', motivo: task.description || task.descricao || task.status || '', impacto_estimado: task.priority || task.prioridade || '' })), 'Nenhuma tarefa vinculada ao vendedor.')}</div>`;
    if (state.activeTab === 'performance') return `<section class="nhi-kpis"><article class="nhi-kpi"><small>Faturamento da carteira</small><b>${brl(state.performance?.faturamento_carteira || 0)}</b></article><article class="nhi-kpi"><small>Clientes ativos</small><b>${num.format(state.performance?.clientes_ativos || 0)}</b></article><article class="nhi-kpi"><small>Clientes recuperados</small><b>${num.format(state.performance?.clientes_recuperados || 0)}</b></article><article class="nhi-kpi"><small>Oportunidades geradas</small><b>${num.format(state.performance?.oportunidades_geradas || 0)}</b></article></section>`;
    return '';
  }

  render();
  await load();
}

