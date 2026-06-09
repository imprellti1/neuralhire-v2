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
  style.textContent = `.nha-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06)}.nha-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nha-title{font-size:30px;font-weight:700}.nha-sub{color:#61708f}.nha-grid{display:grid;grid-template-columns:1fr 320px;gap:14px}.nha-tools{display:grid;grid-template-columns:minmax(220px,1fr) 150px 120px 120px;gap:10px}.nha-input,.nha-btn,.nha-select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nha-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;cursor:pointer}.nha-btn:disabled{opacity:.5;cursor:not-allowed}.nha-kpis{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:10px;margin-bottom:14px}.nha-kpis div{padding:10px;border:1px solid #e5ecf8;border-radius:12px;background:#fff}.nha-kpis strong{display:block;font-size:18px}.nha-table{width:100%;border-collapse:collapse;font-size:13px}.nha-table td,.nha-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nha-row{cursor:pointer}.nha-row:hover td{background:#f7faff}.nha-state{padding:24px;text-align:center;color:#61708f}.nha-modal{position:fixed;inset:0;background:rgba(10,20,40,.35);display:grid;place-items:center;padding:16px}.nha-modal-card{width:min(720px,100%);background:#fff;border-radius:18px;padding:18px;max-height:90vh;overflow:auto}.nha-field{display:grid;gap:6px;margin-bottom:10px}.nha-field input,.nha-field textarea,.nha-field select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nha-field textarea{height:90px;padding:10px}.nha-badge{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:#edf3ff;color:#1f56dc;margin:2px 4px 2px 0}.nha-badge.is-high{background:#fef2f2;color:#b91c1c}.nha-badge.is-medium{background:#fff7ed;color:#c2410c}.nha-badge.is-low{background:#eff6ff;color:#1d4ed8}.nha-summary-operational{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.nha-summary-chip{padding:8px 12px;border-radius:999px;background:#f8fafc;border:1px solid #e5ecf8;font-weight:600}@media (max-width:1200px){.nha-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.nha-grid,.nha-tools{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

export function renderProductAuditPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createProductAuditState();

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
      return `<span class="nha-badge is-${severity}" title="${getProductAuditIssueTooltip(issue)}">${getProductAuditIssueLabel(issue)}</span>`;
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
      return `<div class="nha-modal"><div class="nha-modal-card"><h3>Vincular fábrica</h3><select id="nha-fabricante" class="nha-select">${options}</select><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button id="nha-cancel" class="nha-btn" style="background:#fff;color:#1f2937;border-color:#d4deee">Cancelar</button><button id="nha-save-fabricante" class="nha-btn">Salvar</button></div></div></div>`;
    }
    return `<div class="nha-modal"><div class="nha-modal-card"><h3>Corrigir produto</h3><label class="nha-field">Nome<input id="nha-nome" value="${item.nome || ''}"></label><label class="nha-field">SKU<input id="nha-sku" value="${item.sku || ''}"></label><label class="nha-field">Categoria<input id="nha-categoria" value="${item.categoria || ''}"></label><label class="nha-field">Subcategoria<input id="nha-subcategoria" value="${item.subcategoria || ''}"></label><label class="nha-field">Família<input id="nha-familia" value="${item.familia || ''}"></label><label class="nha-field">Coleção<input id="nha-colecao" value="${item.colecao || ''}"></label><label class="nha-field">Preço<input id="nha-preco" value="${item.preco ?? item.preco_unitario ?? 0}"></label><label class="nha-field">Status<select id="nha-status"><option value="ativo" ${String(item.status || '').toLowerCase() === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${String(item.status || '').toLowerCase() === 'inativo' ? 'selected' : ''}>inativo</option></select></label><label class="nha-field">Imagem URL<input id="nha-imagemUrl" value="${item.imagemUrl || item.imagem_url || ''}"></label><div style="margin-top:12px;display:flex;justify-content:flex-end;gap:8px"><button id="nha-cancel" class="nha-btn" style="background:#fff;color:#1f2937;border-color:#d4deee">Cancelar</button><button id="nha-save-fix" class="nha-btn">Salvar</button></div></div></div>`;
  }

  function render() {
    const rows = (state.items || []).map((item) => `<tr class="nha-row" data-id="${item.id}"><td>${item.imagemUrl || item.imagem_url ? 'Imagem' : '-'}</td><td>${item.produtoExibicao}</td><td>${item.skuExibicao}</td><td>${item.fabricanteExibicao}</td><td>${item.categoriaExibicao}</td><td>${brl(item.precoExibicao)}</td><td>${item.estoqueExibicao}</td><td><span class="nha-badge">${item.statusExibicao}</span></td><td>${issueBadges(item.issuesRaw || []) || '-'}</td><td><button class="nha-btn" data-view="${item.id}">Ver Produto</button> <button class="nha-btn" data-edit="${item.id}">Editar Produto</button></td></tr>`).join('');
    const pagination = state.pagination || {};
    const totalPages = Number(pagination.totalPages || 0);
    const currentPage = Number(pagination.page || 1);
    const hasPages = totalPages > 1;
    const pager = hasPages ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:12px"><div class="nha-state" style="padding:0;text-align:left">Página ${currentPage} de ${totalPages}</div><div style="display:flex;gap:8px"><button class="nha-btn" id="nha-prev" ${currentPage <= 1 ? 'disabled' : ''}>Anterior</button><button class="nha-btn" id="nha-next" ${currentPage >= totalPages ? 'disabled' : ''}>Próxima</button></div></div>` : '';
    root.innerHTML = `<section class="nha-head"><div><div class="nha-title">Auditoria de Produtos</div><div class="nha-sub">Diagnóstico dos produtos existentes e vínculo com fábricas</div></div><div class="nha-tools"><input id="nha-search" class="nha-input" placeholder="Busca" value="${state.filters.search || ''}"><select id="nha-issue" class="nha-select"><option value="">Issue</option><option value="missing_fabricante">Sem fábrica</option><option value="missing_factory">Sem fábrica</option><option value="missing_image">Sem imagem</option><option value="missing_sku">Sem SKU</option><option value="missing_name">Sem nome</option><option value="missing_category">Sem categoria</option><option value="missing_price">Sem preço</option><option value="invalid_price">Preço inválido</option><option value="missing_variation">Sem variação</option><option value="missing_variations">Sem variação</option><option value="zero_stock">Estoque zerado</option><option value="estoque_zerado">Estoque zerado</option><option value="duplicate_sku">Duplicado</option><option value="duplicated">Duplicado</option><option value="duplicate_name">Duplicado</option><option value="inactive_product">Inativo</option></select><select id="nha-fabricante-filter" class="nha-select"><option value="">Fábrica</option>${(state.fabricantes || []).map((f) => `<option value="${f.id}">${f.nome}</option>`).join('')}</select><select id="nha-status-filter" class="nha-select"><option value="">Status</option><option value="ativo">ativo</option><option value="inativo">inativo</option></select></div></section><section class="nha-kpis">${kpis().map(([label, value]) => `<div><strong>${value}</strong>${label}</div>`).join('')}</section>${issueSummary()}<section class="nha-grid"><div class="nha-panel"><table class="nha-table"><tr><th>Imagem</th><th>Produto</th><th>SKU</th><th>Fábrica</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Issues</th><th>Ações</th></tr>${state.loading ? '<tr><td colspan="10" class="nha-state">Carregando...</td></tr>' : rows || '<tr><td colspan="10" class="nha-state">Nenhum produto com problema encontrado.</td></tr>'}</table>${pager}</div><aside class="nha-panel">${state.selected ? `<h3>${state.selected.nome || '-'}</h3><div>Issues: ${issueBadges(state.selected.issues || []) || '-'}</div><pre style="white-space:pre-wrap">${JSON.stringify(state.selected, null, 2)}</pre>` : '<div class="nha-state">Selecione um produto para ver os detalhes da auditoria.</div>'}</aside></section>${renderModal()}`;

    root.querySelector('#nha-search').oninput = (e) => { state.filters.search = e.target.value || ''; state.filters.page = 1; load(); };
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
