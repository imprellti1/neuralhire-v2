import { createPedidosState } from './pedidos.state.js';
import { fetchPedidosData } from './pedidos.service.js';

function fmtDate(value) {
  if (!value) return '-';
  return value.toLocaleDateString('pt-BR');
}

function fmtCurrency(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '-';
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'aprovado') return 'is-approved';
  if (s === 'confirmado') return 'is-confirmed';
  if (s === 'faturado') return 'is-billed';
  if (s === 'cancelado') return 'is-canceled';
  return 'is-draft';
}

function injectStyles() {
  if (document.getElementById('nh-pedidos-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-pedidos-style';
  style.textContent = `
  .nho2-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06);width:100%}
  .nho2-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}
  .nho2-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nho2-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  .nho2-tools{display:grid;grid-template-columns:minmax(280px,1fr) 180px 160px 120px;gap:10px;align-items:center;width:100%}
  .nho2-input,.nho2-select,.nho2-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff;color:#16284a}
  .nho2-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  .nho2-meta{display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px;color:#61708f;font-size:13px;gap:10px;flex-wrap:wrap}
  .nho2-table{width:100%;font-size:13px;border-collapse:collapse;table-layout:fixed}
  .nho2-table th{font-size:12px;color:#607091;text-transform:uppercase;letter-spacing:.04em;background:#f8fbff}
  .nho2-table td,.nho2-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nho2-table tr:last-child td{border-bottom:none}
  .nho2-row-click{cursor:pointer}
  .nho2-row-click:hover td{background:#f8fbff}
  .nho2-badge{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eaf1ff;color:#1d4ed8}
  .nho2-badge.is-approved{background:#ecfdf3;color:#047857}.nho2-badge.is-confirmed{background:#eaf1ff;color:#1d4ed8}
  .nho2-badge.is-billed{background:#eff6ff;color:#1e40af}.nho2-badge.is-canceled{background:#fff1f2;color:#be123c}
  .nho2-pager{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
  .nho2-pager button{height:34px;min-width:34px;border:1px solid #d4deee;border-radius:8px;background:#fff;cursor:pointer}
  .nho2-pager button[disabled]{opacity:.45;cursor:not-allowed}
  .nho2-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nho2-state{padding:24px;text-align:center;color:#607091}.nho2-table-wrap{width:100%;overflow-x:hidden}
  @media (max-width:1440px){.nho2-tools{grid-template-columns:minmax(240px,1fr) 160px 150px 120px}}
  @media (max-width:1366px){.nho2-title{font-size:28px}}
  @media (max-width:1280px){.nho2-title{font-size:26px}.nho2-tools{grid-template-columns:minmax(220px,1fr) 150px 140px 110px}}
  @media (max-width:1024px){.nho2-tools{grid-template-columns:1fr 1fr}.nho2-title{font-size:24px}.nho2-table{table-layout:auto}}
  `;
  document.head.appendChild(style);
}

export function renderPedidosPage(root, { apiClient }) {
  injectStyles();
  const state = createPedidosState();

  function renderTable() {
    if (state.loading) return '<div class="nho2-panel nho2-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></div>';
    if (state.error) return '<div class="nho2-panel nho2-state">Não foi possível carregar os pedidos.<br/><br/><button id="nho2-retry" class="nho2-btn">Tentar novamente</button></div>';
    if (!(state?.items?.length || 0)) return '<div class="nho2-panel nho2-state">Nenhum pedido encontrado.</div>';

    const rows = (state?.items || []).map((p) => `
      <tr data-id="${p?.id || ''}" class="nho2-row-click">
        <td>${p?.pedidoExibicao || '-'}</td>
        <td>${p?.clienteExibicao || '-'}</td>
        <td><span class="nho2-badge ${statusClass(p?.statusExibicao)}">${p?.statusExibicao || '-'}</span></td>
        <td>${p?.origemExibicao || '-'}</td>
        <td>${fmtCurrency(p?.valorTotalExibicao)}</td>
        <td>${fmtDate(p?.criadoEmExibicao)}</td>
      </tr>
    `).join('');

    const page = state?.pagination?.page || state?.page || 1;
    const totalPages = state?.pagination?.totalPages || 1;
    const totalApi = Math.max(state?.pagination?.total || 0, state?.pagination?.totalItems || 0, state?.pagination?.count || 0, state?.total || 0, state?.items?.length || 0);

    return `<section class="nho2-panel"><div class="nho2-meta"><div>Página ${page} de ${totalPages} • Total API: ${totalApi}</div><div>Exibindo ${(state?.items || []).length} item(ns) filtrados localmente</div></div><div class="nho2-table-wrap"><table class="nho2-table"><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Origem</th><th>Valor Total</th><th>Criação</th></tr>${rows}</table></div><div class="nho2-pager"><button id="nho2-prev" ${page <= 1 ? 'disabled' : ''}>&lt;</button><button id="nho2-next" ${page >= totalPages ? 'disabled' : ''}>&gt;</button></div></section>`;
  }

  function render() {
    root.innerHTML = `<section class="nho2-header"><div><div class="nho2-title">Pedidos Comercial</div><div class="nho2-sub">Gestão operacional de pedidos com busca, filtros e paginação.</div></div><div class="nho2-tools"><input id="nho2-search" class="nho2-input" placeholder="Buscar por pedido, cliente, status ou origem" value="${state?.search || ''}" /><select id="nho2-status" class="nho2-select"><option value="all" ${state.status === 'all' ? 'selected' : ''}>Todos status</option><option value="rascunho" ${state.status === 'rascunho' ? 'selected' : ''}>Rascunho</option><option value="aprovado" ${state.status === 'aprovado' ? 'selected' : ''}>Aprovado</option><option value="confirmado" ${state.status === 'confirmado' ? 'selected' : ''}>Confirmado</option><option value="faturado" ${state.status === 'faturado' ? 'selected' : ''}>Faturado</option><option value="cancelado" ${state.status === 'cancelado' ? 'selected' : ''}>Cancelado</option></select><select id="nho2-period" class="nho2-select"><option value="all" ${state.period === 'all' ? 'selected' : ''}>Período: todos</option><option value="7d" ${state.period === '7d' ? 'selected' : ''}>Últimos 7 dias</option><option value="30d" ${state.period === '30d' ? 'selected' : ''}>Últimos 30 dias</option><option value="90d" ${state.period === '90d' ? 'selected' : ''}>Últimos 90 dias</option><option value="month" ${state.period === 'month' ? 'selected' : ''}>Mês atual</option></select><button id="nho2-new" class="nho2-btn">Novo Pedido</button><button id="nho2-refresh" class="nho2-btn">Atualizar</button></div></section>${renderTable()}`;

    const create = root.querySelector('#nho2-new');
    if (create) create.onclick = () => { window.location.hash = '#/pedidos/novo'; };

    const refresh = root.querySelector('#nho2-refresh');
    if (refresh) refresh.onclick = () => load(state?.pagination?.page || 1);

    const retry = root.querySelector('#nho2-retry');
    if (retry) retry.onclick = () => load(state?.pagination?.page || state?.page || 1);

    const search = root.querySelector('#nho2-search');
    if (search) search.oninput = (event) => { state.search = event.target.value || ''; load(1, { preserveLoading: true }); };

    const status = root.querySelector('#nho2-status');
    if (status) status.onchange = (event) => { state.status = event.target.value || 'all'; load(1); };

    const period = root.querySelector('#nho2-period');
    if (period) period.onchange = (event) => { state.period = event.target.value || 'all'; load(1); };

    const prev = root.querySelector('#nho2-prev');
    if (prev) prev.onclick = () => load(Math.max(1, (state?.pagination?.page || 1) - 1));

    const next = root.querySelector('#nho2-next');
    if (next) next.onclick = () => load(Math.min(state?.pagination?.totalPages || 1, (state?.pagination?.page || 1) + 1));
    root.querySelectorAll('.nho2-row-click').forEach((row) => {
      row.onclick = () => {
        const id = row.getAttribute('data-id');
        if (!id) return;
        window.location.hash = `#/pedidos/${id}`;
      };
    });
  }

  async function load(page = 1, options = {}) {
    if (!options.preserveLoading) state.loading = true;
    state.error = false;
    render();
    try {
      const data = await fetchPedidosData(apiClient, {
        page: page || 1,
        limit: state?.pagination?.limit || 10,
        search: state?.search || '',
        status: state?.status || 'all',
        period: state?.period || 'all'
      });
      state.items = data?.items || [];
      state.pagination = data?.pagination || state?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 };
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  render();
  load(1);
}

