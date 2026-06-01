import { createClientesState } from './clientes.state.js';
import { fetchClientesData } from './clientes.service.js';

function fmtDate(value) {
  if (!value) return '-';
  return value.toLocaleDateString('pt-BR');
}

function injectStyles() {
  if (document.getElementById('nh-clientes-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-clientes-style';
  style.textContent = `
  .nhc-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06);width:100%}
  .nhc-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}
  .nhc-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhc-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  .nhc-tools{display:grid;grid-template-columns:minmax(320px,520px) 120px 140px;gap:10px;align-items:center}
  .nhc-input,.nhc-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff;color:#16284a}
  .nhc-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  .nhc-meta{display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px;color:#61708f;font-size:13px}
  .nhc-table{width:100%;font-size:13px;border-collapse:collapse;table-layout:auto}
  .nhc-table th{font-size:12px;color:#607091;text-transform:uppercase;letter-spacing:.04em;background:#f8fbff}
  .nhc-table td,.nhc-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;vertical-align:middle;white-space:nowrap}
  .nhc-table tr:last-child td{border-bottom:none}
  .nhc-row-link{cursor:pointer}
  .nhc-row-link:hover td{background:#f7faff}
  .nhc-badge{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eaf1ff;color:#1d4ed8}
  .nhc-pager{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
  .nhc-pager button{height:34px;min-width:34px;border:1px solid #d4deee;border-radius:8px;background:#fff;cursor:pointer}
  .nhc-pager button[disabled]{opacity:.45;cursor:not-allowed}
  .nhc-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nhc-state{padding:24px;text-align:center;color:#607091}.nhc-table-wrap{width:100%;overflow:auto}
  @media (max-width:1200px){.nhc-title{font-size:26px}}
  @media (max-width:1024px){.nhc-tools{grid-template-columns:1fr}.nhc-title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

export function renderClientesPage(root, { apiClient }) {
  injectStyles();
  const state = createClientesState();

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
          <div>Exibindo ${state.items.length} item(ns) filtrados localmente</div>
        </div>
        <div class="nhc-table-wrap"><table class="nhc-table">
          <tr>
            <th>Empresa</th><th>Razão Social</th><th>Contato</th><th>Telefone</th><th>Cidade</th><th>UF</th><th>Status</th><th>Criação</th>
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
        <div><div class="nhc-title">Clientes CRM</div><div class="nhc-sub">Listagem operacional de clientes com busca local e paginação da API.</div></div>
        <div class="nhc-tools">
          <input id="nhc-search" class="nhc-input" placeholder="Pesquisar cliente" value="${state.search}" />
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
      search.oninput = (event) => {
        state.search = event.target.value || '';
        load(state?.pagination?.page || 1, { preserveLoading: true });
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
    if (!options.preserveLoading) state.loading = true;
    state.error = false;
    render();
    try {
      const data = await fetchClientesData(apiClient, {
        page,
        limit: state?.pagination?.limit || 10,
        search: state.search
      });
      state.items = data.items;
      state.pagination = data.pagination;
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




