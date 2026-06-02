import { createProductEditorState } from './product-editor.state.js';
import { createProductEditorVariation, fetchProductEditorProduct, fetchProductEditorProducts, fetchProductEditorVariations, saveProductEditorImages, saveProductEditorProduct, updateProductEditorVariation, updateProductEditorVariationImage } from './product-editor.service.js';

function injectStyles() {
  if (document.getElementById('nh-pe-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-pe-style';
  style.textContent = `.npe{display:grid;grid-template-columns:360px minmax(0,1fr);gap:14px}.npe-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(16,34,68,.06)}.npe-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.npe-title{font-size:30px;font-weight:700}.npe-sub{color:#61708f}.npe-list{display:grid;gap:10px;max-height:72vh;overflow:auto}.npe-card{padding:12px;border:1px solid #e5ecf8;border-radius:14px;cursor:pointer}.npe-card.is-active{background:#eef4ff;border-color:#bcd0ff}.npe-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.npe-field{display:grid;gap:6px}.npe-field input,.npe-field select,.npe-field textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.npe-field textarea{height:84px;padding:10px}.npe-btn{height:38px;border:1px solid #1f56dc;border-radius:10px;background:#1f56dc;color:#fff;padding:0 12px;cursor:pointer;font-weight:700}.npe-btn.secondary{background:#fff;color:#1f56dc}.npe-img{width:100%;max-width:180px;height:120px;object-fit:cover;border-radius:12px;border:1px solid #dbe4f2;background:#f7faff}.npe-variations{width:100%;border-collapse:collapse}.npe-variations td,.npe-variations th{padding:8px;border-bottom:1px solid #ebf0f8;text-align:left;font-size:13px}.npe-meta{color:#61708f;font-size:13px}.npe-state{padding:24px;text-align:center;color:#61708f}@media (max-width:1100px){.npe{grid-template-columns:1fr}.npe-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}
function currency(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export function renderProductEditorPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createProductEditorState();

  async function loadList() {
    state.loading = true; render();
    try { const data = await fetchProductEditorProducts(apiClient, state.filters); state.items = data.items || []; state.empty = !state.items.length; state.error = false; } catch { state.error = true; }
    state.loading = false; render();
  }

  async function selectProduct(id) {
    state.selected = await fetchProductEditorProduct(apiClient, id);
    state.form = { ...state.form, ...state.selected, precoUnitario: state.selected.precoUnitario ?? state.selected.preco_unitario ?? '', galeria: state.selected.galeria || [] };
    state.variations = (await fetchProductEditorVariations(apiClient, id)).items || [];
    state.dirty = false; render();
  }

  function renderList() {
    if (state.loading) return '<div class="npe-panel npe-state">Carregando...</div>';
    if (state.error) return '<div class="npe-panel npe-state">Erro ao carregar <button id="npe-retry" class="npe-btn">Tentar novamente</button></div>';
    if (state.empty) return '<div class="npe-panel npe-state">Nenhum produto encontrado.</div>';
    return `<div class="npe-list">${state.items.map((item) => `<div class="npe-card ${state.selected?.id === item.id ? 'is-active' : ''}" data-id="${item.id}"><strong>${item.nome || '-'}</strong><div class="npe-meta">${item.sku || '-'} · ${item.categoria || '-'}</div><div class="npe-meta">${item.fabricante?.nome || 'Sem fábrica'} · ${item.status || ''}</div></div>`).join('')}</div>`;
  }

  function renderEditor() {
    const f = state.form;
    return `<div class="npe-grid">
      <label class="npe-field">Nome<input id="pe-nome" value="${f.nome || ''}"></label>
      <label class="npe-field">SKU<input id="pe-sku" value="${f.sku || ''}"></label>
      <label class="npe-field" style="grid-column:1/-1">Descrição<textarea id="pe-descricao">${f.descricao || ''}</textarea></label>
      <label class="npe-field">Fabricante<input id="pe-fabricanteId" value="${f.fabricanteId || ''}"></label>
      <label class="npe-field">Status<select id="pe-status"><option value="ativo" ${f.status === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${f.status === 'inativo' ? 'selected' : ''}>inativo</option></select></label>
      <label class="npe-field">Categoria<input id="pe-categoria" value="${f.categoria || ''}"></label>
      <label class="npe-field">Subcategoria<input id="pe-subcategoria" value="${f.subcategoria || ''}"></label>
      <label class="npe-field">Família<input id="pe-familia" value="${f.familia || ''}"></label>
      <label class="npe-field">Coleção<input id="pe-colecao" value="${f.colecao || ''}"></label>
      <label class="npe-field">Preço<input id="pe-preco" value="${f.preco || ''}"></label>
      <label class="npe-field">Preço Unitário<input id="pe-precoUnitario" value="${f.precoUnitario || ''}"></label>
      <label class="npe-field" style="grid-column:1/-1">Imagem principal<input id="pe-imagemUrl" value="${f.imagemUrl || ''}"></label>
      <img class="npe-img" alt="preview" src="${f.imagemUrl || 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIvPg=='}">
      <div><div class="npe-meta">${state.dirty ? 'Existem alterações não salvas.' : 'Sem alterações pendentes.'}</div><button id="pe-save" class="npe-btn">Salvar Produto</button> <button id="pe-discard" class="npe-btn secondary">Descartar Alterações</button><div class="npe-meta">${state.error ? 'Erro ao salvar.' : ''}</div></div>
    </div>
    <hr/>
    <h3>Variações</h3>
    <table class="npe-variations"><tr><th>SKU</th><th>Cor</th><th>Tamanho</th><th>Estoque</th><th>Preço</th><th>Imagem</th><th>Ativo</th></tr>${state.variations.map((v) => `<tr data-var="${v.id}"><td>${v.sku}</td><td>${v.cor}</td><td>${v.tamanho}</td><td>${v.estoque}</td><td>${currency(v.preco)}</td><td>${v.imagemUrl ? 'sim' : '-'}</td><td>${v.ativo ? 'Sim' : 'Não'}</td></tr>`).join('')}</table>
    <div class="npe-grid" style="margin-top:12px"><label class="npe-field">Nova SKU<input id="pv-sku"></label><label class="npe-field">Cor<input id="pv-cor"></label><label class="npe-field">Tamanho<input id="pv-tamanho"></label><label class="npe-field">Estoque<input id="pv-estoque" value="0"></label><label class="npe-field">Preço<input id="pv-preco" value="0"></label><label class="npe-field">Imagem<input id="pv-imagemUrl"></label><button id="pv-create" class="npe-btn" style="grid-column:1/-1">Nova variação</button></div>`;
  }

  function bindEditor() {
    if (!state.selected) return;
    for (const key of ['nome', 'sku', 'descricao', 'fabricanteId', 'categoria', 'subcategoria', 'familia', 'colecao', 'preco', 'precoUnitario', 'imagemUrl']) {
      const el = root.querySelector(`#pe-${key}`);
      if (el) el.oninput = (e) => { state.form[key] = e.target.value; state.dirty = true; };
    }
    const status = root.querySelector('#pe-status'); if (status) status.onchange = (e) => { state.form.status = e.target.value; state.dirty = true; };
    const save = root.querySelector('#pe-save'); if (save) save.onclick = saveProduct;
    const discard = root.querySelector('#pe-discard'); if (discard) discard.onclick = () => selectProduct(state.selected.id);
    const create = root.querySelector('#pv-create'); if (create) create.onclick = createVariation;
    root.querySelectorAll('tr[data-var]').forEach((row) => { row.onclick = () => editVariation(row.getAttribute('data-var')); });
  }

  function render() {
    root.innerHTML = `<section class="npe-head"><div><div class="npe-title">Editor de Produtos</div><div class="npe-sub">Correção controlada de dados, imagens, fábrica e variações.</div></div><div><input id="npe-search" placeholder="Buscar" value="${state.filters.search}" style="height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px"></div></section><section class="npe">${renderList()}<div class="npe-panel">${state.selected ? renderEditor() : '<div class="npe-state">Selecione um produto.</div>'}</div></section>`;
    root.querySelectorAll('.npe-card').forEach((card) => card.onclick = () => selectProduct(card.getAttribute('data-id')));
    const retry = root.querySelector('#npe-retry'); if (retry) retry.onclick = loadList;
    const search = root.querySelector('#npe-search'); if (search) search.oninput = (e) => { state.filters.search = e.target.value; loadList(); };
    bindEditor();
  }

  async function saveProduct() {
    state.saving = true; render();
    try { await saveProductEditorProduct(apiClient, state.selected.id, state.form); await saveProductEditorImages(apiClient, state.selected.id, { imagemUrl: state.form.imagemUrl, galeria: state.form.galeria || [] }); await selectProduct(state.selected.id); } catch { state.error = true; }
    state.saving = false; render();
  }
  async function createVariation() { await createProductEditorVariation(apiClient, state.selected.id, { sku: root.querySelector('#pv-sku').value, cor: root.querySelector('#pv-cor').value, tamanho: root.querySelector('#pv-tamanho').value, estoque: Number(root.querySelector('#pv-estoque').value || 0), preco: Number(root.querySelector('#pv-preco').value || 0), imagemUrl: root.querySelector('#pv-imagemUrl').value, ativo: true }); await selectProduct(state.selected.id); }
  async function editVariation(variationId) { const variation = state.variations.find((v) => v.id === variationId); if (!variation) return; await updateProductEditorVariation(apiClient, state.selected.id, variationId, { ...variation, sku: `${variation.sku}-EDIT` }); await updateProductEditorVariationImage(apiClient, state.selected.id, variationId, { imagemUrl: variation.imagemUrl || 'https://example.com/variation.jpg' }); await selectProduct(state.selected.id); }

  render();
  loadList();
}
