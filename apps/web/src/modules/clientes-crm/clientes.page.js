import { createClientesState } from './clientes.state.js';
import { fetchClientesData } from './clientes.service.js';
import { fetchVendedoresData } from '../vendedores/vendedores.service.js';

function fmtDate(value) {
  if (!value) return '-';
  return value.toLocaleDateString('pt-BR');
}

function injectStyles() {
  if (document.getElementById('nh-clientes-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-clientes-style';
  style.textContent = `
  .nhc-panel{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);width:100%}
  .nhc-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}
  .nhc-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhc-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  .nhc-tools{display:grid;grid-template-columns:minmax(260px,460px) 180px 120px 140px;gap:10px;align-items:center}
  .nhc-input,.nhc-btn{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}
  .nhc-btn{background:#4f8cff;color:#fff;border-color:#4f8cff;font-weight:600;cursor:pointer}
  .nhc-meta{display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px;color:#61708f;font-size:13px}
  .nhc-table{width:100%;font-size:13px;border-collapse:collapse;table-layout:auto}
  .nhc-table th{font-size:12px;color:#a9bbd8;text-transform:uppercase;letter-spacing:.04em;background:rgba(255,255,255,.03)}
  .nhc-table td,.nhc-table th{padding:10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;vertical-align:middle;white-space:nowrap}
  .nhc-table tr:last-child td{border-bottom:none}
  .nhc-row-link{cursor:pointer}
  .nhc-row-link:hover td{background:rgba(79,140,255,.08)}
  .nhc-badge{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(79,140,255,.16);color:#bcd0ff}
  .nhc-pager{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
  .nhc-pager button{height:34px;min-width:34px;border:1px solid rgba(148,163,184,.22);border-radius:8px;background:#0b1628;color:#e7eefb;cursor:pointer}
  .nhc-pager button[disabled]{opacity:.45;cursor:not-allowed}
  .nhc-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nhc-state{padding:24px;text-align:center;color:#91a4c4}.nhc-table-wrap{width:100%;overflow:auto}
  @media (max-width:1200px){.nhc-title{font-size:26px}}
  @media (max-width:1024px){.nhc-tools{grid-template-columns:1fr}.nhc-title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

export function renderClientesPage(root, { apiClient }) {
  injectStyles();
  const state = createClientesState();
  let searchDebounceTimer = null;
  let activeLoadToken = 0;

  function renderTable() {
    if (state.loading) {
      return '<div class="nhc-panel nhc-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></div>';
    }
    if (state.error) {
      return '<div class="nhc-panel nhc-state">Não foi possível carregar os clientes.<br/><br/><button id="nhc-retry" class="nhc-btn">Tentar novamente</button></div>';
    }
    if (!state.items.length) {
      return '<div class="nhc-panel nhc-state">Nenhum cliente encontrado.</div>';
    }

    const rows = state.items.map((c) => `
      <tr data-id="${c.id}" class="nhc-row-link">
        <td>${c.empresaExibicao}</td>
        <td>${c.razaoSocialExibicao}</td>
        <td>${c.contatoExibicao}</td>
        <td>${c.telefoneExibicao}</td>
        <td>${c.cidadeExibicao}</td>
        <td>${c.ufExibicao}</td>
        <td><span class="nhc-badge">${c.statusExibicao}</span></td>
        <td>${fmtDate(c.criadoEmExibicao)}</td>
      </tr>
    `).join('');

    return `
      <section class="nhc-panel">
        <div class="nhc-meta">
          <div>Página ${state?.pagination?.page || 1} de ${state?.pagination?.totalPages || 1} • Total API: ${Math.max(state?.pagination?.total || 0, state?.items?.length || 0)}</div>
          <div>${state.search ? `Busca remota por "${state.search}"` : 'Listagem padrão da API'}</div>
        </div>
        <div class="nhc-table-wrap"><table class="nhc-table">
          <tr>
            <th>Empresa</th><th>Razão Social</th><th>Contato</th><th>Telefone</th><th>Cidade</th><th>UF</th><th>Vendedor</th><th>Status</th><th>Criação</th>
          </tr>
          ${rows}
        </table></div><div class="nhc-pager">
          <button id="nhc-prev" ${(state?.pagination?.page || 1) <= 1 ? 'disabled' : ''}>&lt;</button>
          <button id="nhc-next" ${(state?.pagination?.page || 1) >= (state?.pagination?.totalPages || 1) ? 'disabled' : ''}>&gt;</button>
        </div>
      </section>
    `;
  }

  function render() {
    root.innerHTML = `
      <section class="nhc-header">
        <div><div class="nhc-title">Clientes CRM</div><div class="nhc-sub">Listagem operacional de clientes com busca remota e paginação da API.</div></div>
        <div class="nhc-tools">
          <input id="nhc-search" class="nhc-input" placeholder="Pesquisar cliente" value="${state.search}" autocomplete="off" />
          <select id="nhc-vendedor" class="nhc-input">
            <option value="">Todos os vendedores</option>
            ${(state.vendedores || []).map((v) => `<option value="${v.id}" ${String(state.vendedor_id || '') === String(v.id) ? 'selected' : ''}>${v.nome || v.empresa || v.id}</option>`).join('')}
          </select>
          <button id="nhc-refresh" class="nhc-btn">Atualizar</button>
          <button id="nhc-new" class="nhc-btn">Novo Cliente</button>
        </div>
      </section>
      ${renderTable()}
    `;

    const refresh = root.querySelector('#nhc-refresh');
    if (refresh) refresh.onclick = () => load(state?.pagination?.page || 1);
    const add = root.querySelector('#nhc-new');
    if (add) add.onclick = () => { window.location.hash = '#/clientes/novo'; };

    const retry = root.querySelector('#nhc-retry');
    if (retry) retry.onclick = () => load(state?.pagination?.page || state?.page || 1);

    const search = root.querySelector('#nhc-search');
    if (search) {
      search.value = state.search || '';
      search.oninput = (event) => {
        state.search = event.target.value || '';
        scheduleSearchLoad();
      };
    }

    const vendedor = root.querySelector('#nhc-vendedor');
    if (vendedor) {
      vendedor.value = state.vendedor_id || '';
      vendedor.onchange = (event) => {
        state.vendedor_id = event.target.value || '';
        load(1);
      };
    }

    const prev = root.querySelector('#nhc-prev');
    if (prev) prev.onclick = () => load(Math.max(1, (state?.pagination?.page || 1) - 1));

    const next = root.querySelector('#nhc-next');
    if (next) next.onclick = () => load(Math.min(state?.pagination?.totalPages || 1, (state?.pagination?.page || 1) + 1));

    root.querySelectorAll('.nhc-row-link').forEach((row) => {
      row.onclick = () => {
        const id = row.getAttribute('data-id');
        if (id) window.location.hash = `#/clientes/${id}`;
      };
    });
  }

  async function load(page = 1, options = {}) {
    const loadToken = ++activeLoadToken;
    if (!options.preserveLoading) state.loading = true;
    state.error = false;
    render();
    try {
      const data = await fetchClientesData(apiClient, {
        page,
        limit: state?.pagination?.limit || 10,
        search: state.search,
        vendedor_id: state.vendedor_id
      });
      if (loadToken !== activeLoadToken) return;
      state.items = data.items;
      state.pagination = data.pagination;
    } catch {
      if (loadToken !== activeLoadToken) return;
      state.error = true;
    } finally {
      if (loadToken !== activeLoadToken) return;
      state.loading = false;
      render();
    }
  }

  async function loadVendedores() {
    try {
      const data = await fetchVendedoresData(apiClient, { status: 'ativo' });
      state.vendedores = data.items || [];
    } catch {
      state.vendedores = [];
    }
  }

  function scheduleSearchLoad() {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    const term = String(state.search || '').trim();
    searchDebounceTimer = setTimeout(() => {
      if (term.length === 0) {
        load(1);
        return;
      }
      if (term.length >= 2) {
        load(1);
      }
    }, 300);
  }

  render();
  loadVendedores().finally(() => load(1));
}




