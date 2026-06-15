import { createProductAuditState } from './product-audit.state.js';
import { fetchProductAuditDetail, fetchProductAuditFabricantes, fetchProductAuditProducts, saveProductAuditFabricante, saveProductAuditFix } from './product-audit.service.js';
import { getProductAuditIssueLabel, getProductAuditIssueSeverity, getProductAuditIssueTooltip } from './product-audit.mapper.js';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function injectStyles() {
  if (document.getElementById('nha-style')) return;
  const style = document.createElement('style');
  style.id = 'nha-style';
  style.textContent = `.nha-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.22);color:#e7eefb}.nha-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px}.nha-title{font-size:30px;font-weight:700}.nha-sub{color:#91a4c4}.nha-grid{display:block}.nha-tools{display:grid;grid-template-columns:minmax(220px,1fr) 150px 120px 120px;gap:10px}.nha-input,.nha-btn,.nha-select{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nha-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;cursor:pointer}.nha-btn:disabled{opacity:.5;cursor:not-allowed}.nha-kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px;margin-bottom:12px}.nha-kpis div{padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(11,22,40,.94)}.nha-kpis strong{display:block;font-size:18px}.nha-table-wrap{overflow-x:hidden}.nha-table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.nha-table col:nth-child(1){width:54px}.nha-table col:nth-child(2){width:23%}.nha-table col:nth-child(3){width:12%}.nha-table col:nth-child(4){width:18%}.nha-table col:nth-child(5){width:12%}.nha-table col:nth-child(6){width:11%}.nha-table col:nth-child(7){width:10%}.nha-table col:nth-child(8){width:10%}.nha-table col:nth-child(9){width:84px}.nha-table td,.nha-table th{padding:8px 8px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nha-table th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#91a4c4;background:rgba(255,255,255,.03)}.nha-row{cursor:pointer}.nha-row:hover td{background:rgba(79,140,255,.08)}.nha-state{padding:18px;text-align:center;color:#91a4c4}.nha-actions{display:flex;gap:6px;align-items:center}.nha-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border-radius:8px;background:#0b1628;color:#e7eefb;border:1px solid rgba(148,163,184,.22);cursor:pointer;flex:0 0 auto}.nha-icon-btn svg{width:14px;height:14px;display:block;fill:currentColor}.nha-modal{position:fixed;inset:0;background:rgba(10,20,40,.55);display:grid;place-items:center;padding:16px}.nha-modal-card{width:min(720px,100%);background:linear-gradient(180deg,rgba(15,27,47,.98),rgba(11,21,37,.99));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;max-height:90vh;overflow:auto;color:#e7eefb}.nha-field{display:grid;gap:6px;margin-bottom:10px}.nha-field input,.nha-field textarea,.nha-field select{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nha-field textarea{height:90px;padding:10px}.nha-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#0b1628;color:#93c5fd;margin:2px 4px 2px 0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nha-badge.is-high{background:rgba(248,113,113,.16);color:#fda4af}.nha-badge.is-medium{background:rgba(249,115,22,.16);color:#fdba74}.nha-badge.is-low{background:rgba(59,130,246,.16);color:#93c5fd}.nha-summary-operational{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.nha-summary-chip{padding:8px 12px;border-radius:999px;background:#0b1628;border:1px solid rgba(148,163,184,.18);font-weight:600;color:#e7eefb}.nha-pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,.12)}.nha-pagination-meta{display:flex;flex-direction:column;gap:2px;min-width:0}.nha-pagination-title{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#91a4c4}.nha-pagination-sub{font-size:13px;color:#91a4c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nha-pagination-actions{display:flex;gap:8px;align-items:center}.nha-btn.nha-btn-secondary{background:#0b1628;color:#cbd5e1;border-color:rgba(148,163,184,.22)}.nha-btn.nha-btn-secondary:disabled{background:#0f1b2f;color:#64748b}.nha-ellipsis{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;display:block}.nha-issues{display:flex;flex-wrap:wrap;gap:6px;min-width:0}.nha-issue-chip{display:inline-flex;align-items:center;max-width:100%;padding:4px 8px;border-radius:999px;font-size:11px;line-height:1.2;font-weight:700;white-space:normal;overflow:visible;word-break:break-word}.nha-issue-chip.is-high{background:rgba(248,113,113,.16);color:#fda4af}.nha-issue-chip.is-medium{background:rgba(249,115,22,.16);color:#fdba74}.nha-issue-chip.is-low{background:rgba(59,130,246,.16);color:#93c5fd}@media (max-width:1200px){.nha-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.nha-tools{grid-template-columns:1fr}.nha-pagination{flex-direction:column;align-items:stretch}.nha-pagination-actions{justify-content:flex-end}}`;
  document.head.appendChild(style);
}

function iconEye() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5.5 0-9.7 4-11 7 1.3 3 5.5 7 11 7s9.7-4 11-7c-1.3-3-5.5-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>';
}

function iconPencil() {
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.95l-3.75-3.75L3 17.25zm18-11.5a1 1 0 0 0 0-1.41l-1.34-1.34a1 1 0 0 0-1.41 0l-1.5 1.5 3.75 3.75 1.5-1.5z"/></svg>';
}

export function renderProductAuditPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createProductAuditState();
  let searchLoadTimer = null;

  function kpis() {
    const s = state.summary || {};
    return [
      ['Total produtos', s.totalProdutos || s.totalProducts || 0],
      ['Com problemas', s.comProblemas ?? s.withIssues ?? 0],
      ['Sem fábrica', s.semFabrica ?? s.withoutFabricante ?? 0],
      ['Sem imagem', s.semImagem ?? s.withoutImage ?? 0],
      ['Sem categoria', s.semCategoria ?? s.withoutCategory ?? 0],
      ['Duplicados', s.duplicados ?? s.duplicates ?? 0],
      ['Inativos', s.inativos ?? s.inactive ?? 0],
      ['Estoque zerado', s.estoqueZerado ?? s.zeroStock ?? 0]
    ];
  }

  function issueBadges(issues = []) {
    return issues.map((issue) => {
      const severity = getProductAuditIssueSeverity(issue);
      const tooltip = getProductAuditIssueTooltip(issue);
      const label = getProductAuditIssueLabel(issue);
      return `<span class="nha-issue-chip is-${severity}" title="${tooltip}" aria-label="${tooltip}">${label}</span>`;
    }).join(' ');
  }

  function issueSummary() {
    const s = state.summary || {};
    return `<div class="nha-summary-operational"><strong>Produtos com problema: ${s.comProblemas ?? 0}</strong><span class="nha-summary-chip">Críticos: ${s.criticos ?? 0}</span><span class="nha-summary-chip">Médios: ${s.medios ?? 0}</span><span class="nha-summary-chip">Leves: ${s.leves ?? 0}</span></div>`;
  }

  function renderModal() {
    if (!state.modal || !state.selected) return '';
    const item = state.selected;
    if (state.modal === 'fabricante') {
      const options = (state.fabricantes || []).map((f) => `<option value="${f.id}" ${f.id === item.fabricanteId ? 'selected' : ''}>${f.nome}</option>`).join('');
      return `<div class="nha-modal"><div class="nha-modal-card"><h3>Vincular fábrica</h3><select id="nha-fabricante" class="nha-select">${options}</select><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button id="nha-cancel" class="nha-btn nha-btn-secondary">Cancelar</button><button id="nha-save-fabricante" class="nha-btn">Salvar</button></div></div></div>`;
    }
    return `<div class="nha-modal"><div class="nha-modal-card"><h3>Corrigir produto</h3><label class="nha-field">Nome<input id="nha-nome" value="${item.nome || ''}"></label><label class="nha-field">SKU<input id="nha-sku" value="${item.sku || ''}"></label><label class="nha-field">Categoria<input id="nha-categoria" value="${item.categoria || ''}"></label><label class="nha-field">Subcategoria<input id="nha-subcategoria" value="${item.subcategoria || ''}"></label><label class="nha-field">Família<input id="nha-familia" value="${item.familia || ''}"></label><label class="nha-field">Coleção<input id="nha-colecao" value="${item.colecao || ''}"></label><label class="nha-field">Preço<input id="nha-preco" value="${item.preco ?? item.preco_unitario ?? 0}"></label><label class="nha-field">Status<select id="nha-status"><option value="ativo" ${String(item.status || '').toLowerCase() === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${String(item.status || '').toLowerCase() === 'inativo' ? 'selected' : ''}>inativo</option></select></label><label class="nha-field">Imagem URL<input id="nha-imagemUrl" value="${item.imagemUrl || item.imagem_url || ''}"></label><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button id="nha-cancel" class="nha-btn nha-btn-secondary">Cancelar</button><button id="nha-save-fix" class="nha-btn">Salvar</button></div></div></div>`;
  }

  function render() {
    const rows = (state.items || []).map((item) => `<tr class="nha-row" data-id="${item.id}"><td>${item.imagemUrl || item.imagem_url ? 'Imagem' : '-'}</td><td><span class="nha-ellipsis" title="${item.produtoExibicao || '-'}">${item.produtoExibicao || '-'}</span></td><td>${item.skuExibicao}</td><td><span class="nha-ellipsis" title="${item.categoriaExibicao || '-'}">${item.categoriaExibicao || '-'}</span></td><td>${brl(item.precoExibicao)}</td><td>${item.estoqueExibicao}</td><td><span class="nha-badge">${item.statusExibicao}</span></td><td><div class="nha-issues" title="${(item.issuesRaw || []).map((issue) => getProductAuditIssueTooltip(issue)).join(' | ')}">${issueBadges(item.issuesRaw || []) || '-'}</div></td><td><div class="nha-actions"><button class="nha-icon-btn" data-view="${item.id}" aria-label="Ver produto" title="Ver produto">${iconEye()}</button><button class="nha-icon-btn" data-edit="${item.id}" aria-label="Editar produto" title="Editar produto">${iconPencil()}</button></div></td></tr>`).join('');
    const pagination = state.pagination || {};
    const totalPages = Number(pagination.totalPages || 0);
    const currentPage = Number(pagination.page || 1);
    const totalRecords = Number(pagination.total || 0);
    const pager = `<div class="nha-pagination">
      <div class="nha-pagination-meta">
        <div class="nha-pagination-title">Paginação</div>
        <div class="nha-pagination-sub">Página ${currentPage} de ${totalPages || 1} · ${totalRecords} registros</div>
      </div>
      <div class="nha-pagination-actions">
        <button class="nha-btn nha-btn-secondary" id="nha-prev" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        <button class="nha-btn" id="nha-next" ${currentPage >= (totalPages || 1) ? 'disabled' : ''}>Próxima</button>
      </div>
    </div>`;
    root.innerHTML = `<section class="nha-head"><div><div class="nha-title">Auditoria de Produtos</div><div class="nha-sub">Diagnóstico dos produtos existentes e vínculo com fábricas</div></div><div class="nha-tools"><input id="nha-search" class="nha-input" placeholder="Busca" value="${state.filters.search || ''}"><select id="nha-issue" class="nha-select"><option value="">Issue</option><option value="missing_fabricante">Sem fábrica</option><option value="missing_factory">Sem fábrica</option><option value="missing_image">Sem imagem</option><option value="missing_sku">Sem SKU</option><option value="missing_name">Sem nome</option><option value="missing_category">Sem categoria</option><option value="missing_price">Sem preço</option><option value="invalid_price">Preço inválido</option><option value="missing_variation">Sem variação</option><option value="missing_variations">Sem variação</option><option value="zero_stock">Estoque zerado</option><option value="estoque_zerado">Estoque zerado</option><option value="duplicate_sku">Duplicado</option><option value="duplicated">Duplicado</option><option value="duplicate_name">Duplicado</option><option value="inactive_product">Inativo</option></select><select id="nha-fabricante-filter" class="nha-select"><option value="">Fábrica</option>${(state.fabricantes || []).map((f) => `<option value="${f.id}">${f.nome}</option>`).join('')}</select><select id="nha-status-filter" class="nha-select"><option value="">Status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select></div></section><section class="nha-kpis">${kpis().map(([label, value]) => `<div><strong>${value}</strong>${label}</div>`).join('')}</section>${issueSummary()}<section class="nha-panel"><div class="nha-table-wrap"><table class="nha-table"><colgroup><col><col><col><col><col><col><col><col><col></colgroup><tr><th>Imagem</th><th>Produto</th><th>SKU</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Issues</th><th>Ações</th></tr>${state.loading ? '<tr><td colspan="9" class="nha-state">Carregando...</td></tr>' : rows || '<tr><td colspan="9" class="nha-state">Nenhum produto com problema encontrado.</td></tr>'}</table></div>${pager}</section>`;

    root.querySelector('#nha-search').oninput = (e) => {
      state.filters.search = e.target.value || '';
      state.filters.page = 1;
      if (searchLoadTimer) clearTimeout(searchLoadTimer);
      searchLoadTimer = setTimeout(() => {
        searchLoadTimer = null;
        load();
      }, 120);
    };
    root.querySelector('#nha-issue').onchange = (e) => { state.filters.issue = e.target.value || ''; state.filters.page = 1; load(); };
    root.querySelector('#nha-fabricante-filter').onchange = (e) => { state.filters.fabricanteId = e.target.value || ''; state.filters.page = 1; load(); };
    root.querySelector('#nha-status-filter').onchange = (e) => { state.filters.status = e.target.value || ''; state.filters.page = 1; load(); };
    const prev = root.querySelector('#nha-prev');
    if (prev) prev.onclick = () => { state.filters.page = Math.max(1, Number(state.filters.page || 1) - 1); load(); };
    const next = root.querySelector('#nha-next');
    if (next) next.onclick = () => { state.filters.page = Number(state.filters.page || 1) + 1; load(); };
    root.querySelectorAll('.nha-row').forEach((row) => { row.onclick = () => { window.location.hash = `#/produtos/${row.getAttribute('data-id')}`; }; });
    root.querySelectorAll('[data-view]').forEach((btn) => { btn.onclick = (e) => { e.stopPropagation(); window.location.hash = `#/produtos/${btn.getAttribute('data-view')}`; }; });
    root.querySelectorAll('[data-edit]').forEach((btn) => { btn.onclick = (e) => { e.stopPropagation(); window.location.hash = '#/product-editor'; }; });
  }

  function bindModal() {
    const cancel = root.querySelector('#nha-cancel');
    if (cancel) cancel.onclick = () => { state.modal = null; render(); };
    const saveFabricante = root.querySelector('#nha-save-fabricante');
    if (saveFabricante) saveFabricante.onclick = async () => {
      await saveProductAuditFabricante(apiClient, state.selected.id, root.querySelector('#nha-fabricante').value || null);
      state.modal = null;
      await load();
    };
    const saveFix = root.querySelector('#nha-save-fix');
    if (saveFix) saveFix.onclick = async () => {
      await saveProductAuditFix(apiClient, state.selected.id, {
        nome: root.querySelector('#nha-nome').value,
        sku: root.querySelector('#nha-sku').value,
        categoria: root.querySelector('#nha-categoria').value,
        subcategoria: root.querySelector('#nha-subcategoria').value,
        familia: root.querySelector('#nha-familia').value,
        colecao: root.querySelector('#nha-colecao').value,
        preco: Number(root.querySelector('#nha-preco').value || 0),
        status: root.querySelector('#nha-status').value,
        imagemUrl: root.querySelector('#nha-imagemUrl').value
      });
      state.modal = null;
      await load();
    };
  }

  async function select(id) {
    state.selected = await fetchProductAuditDetail(apiClient, id);
    render();
  }

  async function load() {
    state.loading = true;
    render();
    try {
      const [produtos, fabricantes] = await Promise.all([
        fetchProductAuditProducts(apiClient, state.filters),
        fetchProductAuditFabricantes(apiClient)
      ]);
      state.summary = produtos.summary || null;
      state.items = produtos.items || [];
      state.pagination = produtos.pagination || { page: 1, limit: 20, total: 0, totalPages: 1 };
      state.fabricantes = fabricantes.items || [];
      state.empty = !state.items.length;
      state.filters.page = state.pagination.page || state.filters.page || 1;
      state.filters.limit = state.pagination.limit || state.filters.limit || 20;
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
      bindModal();
    }
  }

  load();
}
