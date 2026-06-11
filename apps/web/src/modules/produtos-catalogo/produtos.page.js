import { createProdutosState } from './produtos.state.js';
import { fetchProdutosData } from './produtos.service.js';

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

function injectStyles() {
  if (document.getElementById('nh-produtos-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-produtos-style';
  style.textContent = `
  .nhp-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06);width:100%}
  .nhp-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}
  .nhp-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhp-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  .nhp-tools{display:grid;grid-template-columns:minmax(280px,1fr) 130px 140px;gap:10px;align-items:center}
  .nhp-input,.nhp-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff;color:#16284a}
  .nhp-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  .nhp-meta{display:flex;justify-content:space-between;align-items:center;margin:10px 0 8px;color:#61708f;font-size:13px;gap:10px;flex-wrap:wrap}
  .nhp-table{width:100%;font-size:13px;border-collapse:collapse;table-layout:fixed}
  .nhp-table th{font-size:12px;color:#607091;text-transform:uppercase;letter-spacing:.04em;background:#f8fbff}
  .nhp-table td,.nhp-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .nhp-row-link{cursor:pointer}
  .nhp-row-link:hover{background:#f7faff}
  .nhp-table tr:last-child td{border-bottom:none}
  .nhp-badge{display:inline-block;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eaf1ff;color:#1d4ed8}
  .nhp-pager{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}
  .nhp-pager button{height:34px;min-width:34px;border:1px solid #d4deee;border-radius:8px;background:#fff;cursor:pointer}
  .nhp-pager button[disabled]{opacity:.45;cursor:not-allowed}
  .nhp-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nhp-state{padding:24px;text-align:center;color:#607091}.nhp-table-wrap{width:100%;overflow-x:hidden}
  @media (max-width:1200px){.nhp-title{font-size:26px}}
  @media (max-width:1024px){.nhp-tools{grid-template-columns:1fr}.nhp-title{font-size:24px}.nhp-table{table-layout:auto}}
  `;
  document.head.appendChild(style);
}

export function renderProdutosPage(root, { apiClient }) {
  injectStyles();
  const state = createProdutosState();
  let searchLoadTimer = null;
  let searchDebounceToken = 0;

  function commitSearchDraft() {
    state.search = state.searchDraft;
  }

  function renderTable() {
    if (state.loading) {
      return '<div class="nhp-panel nhp-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></div>';
    }
    if (state.error) {
      return '<div class="nhp-panel nhp-state">Não foi possível carregar os produtos.<br/><br/><button id="nhp-retry" class="nhp-btn">Tentar novamente</button></div>';
    }
    if (!(state?.items?.length || 0)) {
      return '<div class="nhp-panel nhp-state">Nenhum produto encontrado.</div>';
    }

    const rows = (state.items || []).map((p) => `
      <tr class="nhp-row-link" data-id="${p.id}">
        <td>${p.produtoExibicao}</td>
        <td>${p.skuExibicao}</td>
        <td>${p.categoriaExibicao}</td>
        <td>${p.fabricanteExibicao || 'Sem fábrica'}</td>
        <td>${fmtCurrency(p.precoExibicao)}</td>
        <td><span class="nhp-badge">${p.statusExibicao}</span></td>
        <td>${fmtDate(p.criadoEmExibicao)}</td>
      </tr>
    `).join('');

    const page = state?.pagination?.page || state?.page || 1;
    const totalPages = state?.pagination?.totalPages || 1;
    const totalApi = Math.max(state?.pagination?.total || 0, state?.items?.length || 0);

    return `
      <section class="nhp-panel">
        <div class="nhp-meta">
          <div>Página ${page} de ${totalPages} • Total API: ${totalApi}</div>
          <div>Exibindo ${(state?.items || []).length} item(ns) filtrados localmente</div>
        </div>
        <div class="nhp-table-wrap"><table class="nhp-table">
          <tr>
            <th>Produto</th><th>SKU</th><th>Categoria</th><th>Fábrica</th><th>Preço</th><th>Status</th><th>Criação</th>
          </tr>
          ${rows}
        </table></div><div class="nhp-pager">
          <button id="nhp-prev" ${page <= 1 ? 'disabled' : ''}>&lt;</button>
          <button id="nhp-next" ${page >= totalPages ? 'disabled' : ''}>&gt;</button>
        </div>
      </section>
    `;
  }

  function render() {
    const activeElement = document.activeElement;
    const searchWasFocused = activeElement && activeElement.id === 'nhp-search';
    const searchSelectionStart = searchWasFocused ? activeElement.selectionStart : null;
    const searchSelectionEnd = searchWasFocused ? activeElement.selectionEnd : null;
    root.innerHTML = `
      <section class="nhp-header">
        <div><div class="nhp-title">Produtos / Catálogo</div><div class="nhp-sub">Listagem operacional de produtos com busca local e paginação da API.</div></div>
        <div class="nhp-tools">
          <input id="nhp-search" class="nhp-input" placeholder="Pesquisar produto" value="${state.searchDraft}" />
          <button id="nhp-new" class="nhp-btn">Novo Produto</button>
          <button id="nhp-refresh" class="nhp-btn">Atualizar</button>
        </div>
      </section>
      ${renderTable()}
    `;

    const refresh = root.querySelector('#nhp-refresh');
    if (refresh) refresh.onclick = () => {
      commitSearchDraft();
      load(state?.pagination?.page || 1);
    };
    const create = root.querySelector('#nhp-new');
    if (create) create.onclick = () => { window.location.hash = '#/produtos/novo'; };

    const retry = root.querySelector('#nhp-retry');
    if (retry) retry.onclick = () => {
      commitSearchDraft();
      load(state?.pagination?.page || state?.page || 1);
    };

    const search = root.querySelector('#nhp-search');
    if (search) {
      search.value = state.searchDraft;
      search.oninput = (event) => {
        state.searchDraft = event.target.value || '';
        if (searchLoadTimer) clearTimeout(searchLoadTimer);
        const nextToken = ++searchDebounceToken;
        searchLoadTimer = setTimeout(() => {
          searchLoadTimer = null;
          if (nextToken !== searchDebounceToken) return;
          commitSearchDraft();
          load(1);
        }, 300);
      };
    }

    const prev = root.querySelector('#nhp-prev');
    if (prev) prev.onclick = () => load(Math.max(1, (state?.pagination?.page || 1) - 1));

    const next = root.querySelector('#nhp-next');
    if (next) next.onclick = () => load(Math.min(state?.pagination?.totalPages || 1, (state?.pagination?.page || 1) + 1));

    root.querySelectorAll('.nhp-row-link').forEach((row) => {
      row.onclick = () => { window.location.hash = `#/produtos/${row.getAttribute('data-id')}`; };
    });

    if (searchWasFocused) {
      const restoredSearch = root.querySelector('#nhp-search');
      if (restoredSearch) {
        restoredSearch.focus();
        if (searchSelectionStart !== null && searchSelectionEnd !== null && restoredSearch.setSelectionRange) {
          restoredSearch.setSelectionRange(searchSelectionStart, searchSelectionEnd);
        }
      }
    }
  }

  async function load(page = 1, options = {}) {
    if (!options.preserveLoading) state.loading = true;
    state.error = false;
    render();
    try {
      const data = await fetchProdutosData(apiClient, {
        page,
        limit: state?.pagination?.limit || 10,
        search: state.search
      });
      state.items = data?.items || [];
      state.pagination = data?.pagination || state.pagination;
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
