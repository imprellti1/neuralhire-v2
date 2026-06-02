import { createProductAuditState } from './product-audit.state.js';
import { fetchProductAuditDetail, fetchProductAuditFabricantes, fetchProductAuditProducts, fetchProductAuditSummary, saveProductAuditFabricante, saveProductAuditFix } from './product-audit.service.js';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function injectStyles() {
  if (document.getElementById('nha-style')) return;
  const style = document.createElement('style');
  style.id = 'nha-style';
  style.textContent = `.nha-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06)}.nha-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nha-title{font-size:30px;font-weight:700}.nha-sub{color:#61708f}.nha-grid{display:grid;grid-template-columns:1fr 320px;gap:14px}.nha-tools{display:grid;grid-template-columns:minmax(220px,1fr) 150px 120px 120px;gap:10px}.nha-input,.nha-btn,.nha-select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nha-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;cursor:pointer}.nha-kpis{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin-bottom:14px}.nha-kpis div{padding:10px;border:1px solid #e5ecf8;border-radius:12px;background:#fff}.nha-kpis strong{display:block;font-size:18px}.nha-table{width:100%;border-collapse:collapse;font-size:13px}.nha-table td,.nha-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nha-row:hover td{background:#f7faff}.nha-state{padding:24px;text-align:center;color:#61708f}.nha-modal{position:fixed;inset:0;background:rgba(10,20,40,.35);display:grid;place-items:center;padding:16px}.nha-modal-card{width:min(720px,100%);background:#fff;border-radius:18px;padding:18px;max-height:90vh;overflow:auto}.nha-field{display:grid;gap:6px;margin-bottom:10px}.nha-field input,.nha-field textarea,.nha-field select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nha-field textarea{height:90px;padding:10px}.nha-badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#edf3ff;color:#1f56dc}@media (max-width:1200px){.nha-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.nha-grid,.nha-tools{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

export function renderProductAuditPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createProductAuditState();

  function kpis() {
    const s = state.summary || {};
    return [
      ['Total produtos', s.totalProducts || 0],
      ['Sem fábrica', s.withoutFabricante || 0],
      ['Sem imagem', s.withoutImage || 0],
      ['Sem categoria', s.withoutCategory || 0],
      ['Duplicados', s.duplicates || 0],
      ['Inativos', s.inactive || 0],
      ['Estoque zerado', s.zeroStock || 0]
    ];
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
    const rows = (state.items || []).map((item) => `<tr class="nha-row" data-id="${item.id}"><td>${item.imagemUrl || item.imagem_url ? 'Imagem' : '-'}</td><td>${item.produtoExibicao}</td><td>${item.skuExibicao}</td><td>${item.fabricanteExibicao}</td><td>${item.categoriaExibicao}</td><td>${brl(item.precoExibicao)}</td><td>${item.estoqueExibicao}</td><td><span class="nha-badge">${item.statusExibicao}</span></td><td>${item.issuesExibicao || '-'}</td><td><button class="nha-btn" data-link="${item.id}">Vincular fábrica</button> <button class="nha-btn" data-fix="${item.id}">Corrigir</button></td></tr>`).join('');
    root.innerHTML = `<section class="nha-head"><div><div class="nha-title">Auditoria de Produtos</div><div class="nha-sub">Diagnóstico dos produtos existentes e vínculo com fábricas</div></div><div class="nha-tools"><input id="nha-search" class="nha-input" placeholder="Busca" value="${state.filters.search || ''}"><select id="nha-issue" class="nha-select"><option value="">Issue</option><option value="missing_fabricante">missing_fabricante</option><option value="missing_image">missing_image</option><option value="missing_sku">missing_sku</option><option value="missing_name">missing_name</option><option value="missing_category">missing_category</option><option value="missing_price">missing_price</option><option value="invalid_price">invalid_price</option><option value="duplicate_sku">duplicate_sku</option><option value="duplicate_name">duplicate_name</option></select><select id="nha-fabricante-filter" class="nha-select"><option value="">Fábrica</option>${(state.fabricantes || []).map((f) => `<option value="${f.id}">${f.nome}</option>`).join('')}</select><select id="nha-status-filter" class="nha-select"><option value="">Status</option><option value="ativo">ativo</option><option value="inativo">inativo</option></select></div></section><section class="nha-kpis">${kpis().map(([label, value]) => `<div><strong>${value}</strong>${label}</div>`).join('')}</section><section class="nha-grid"><div class="nha-panel"><table class="nha-table"><tr><th>Imagem</th><th>Produto</th><th>SKU</th><th>Fábrica</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Issues</th><th>Ações</th></tr>${state.loading ? '<tr><td colspan="10" class="nha-state">Carregando...</td></tr>' : rows || '<tr><td colspan="10" class="nha-state">Nenhum produto encontrado.</td></tr>'}</table></div><aside class="nha-panel">${state.selected ? `<h3>${state.selected.nome || '-'}</h3><div>Issues: ${(state.selected.issues || []).join(', ') || '-'}</div><pre style="white-space:pre-wrap">${JSON.stringify(state.selected, null, 2)}</pre>` : '<div class="nha-state">Selecione um produto para ver os detalhes da auditoria.</div>'}</aside></section>${renderModal()}`;

    root.querySelector('#nha-search').oninput = (e) => { state.filters.search = e.target.value || ''; load(); };
    root.querySelector('#nha-issue').onchange = (e) => { state.filters.issue = e.target.value || ''; load(); };
    root.querySelector('#nha-fabricante-filter').onchange = (e) => { state.filters.fabricanteId = e.target.value || ''; load(); };
    root.querySelector('#nha-status-filter').onchange = (e) => { state.filters.status = e.target.value || ''; load(); };
    root.querySelectorAll('.nha-row').forEach((row) => { row.onclick = () => select(row.getAttribute('data-id')); });
    root.querySelectorAll('[data-link]').forEach((btn) => { btn.onclick = async (e) => { e.stopPropagation(); await select(btn.getAttribute('data-link')); state.modal = 'fabricante'; render(); bindModal(); }; });
    root.querySelectorAll('[data-fix]').forEach((btn) => { btn.onclick = async (e) => { e.stopPropagation(); await select(btn.getAttribute('data-fix')); state.modal = 'fix'; render(); bindModal(); }; });
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
      const [summary, produtos, fabricantes] = await Promise.all([
        fetchProductAuditSummary(apiClient),
        fetchProductAuditProducts(apiClient, state.filters),
        fetchProductAuditFabricantes(apiClient)
      ]);
      state.summary = summary;
      state.items = produtos.items || [];
      state.fabricantes = fabricantes.items || [];
      state.empty = !state.items.length;
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
