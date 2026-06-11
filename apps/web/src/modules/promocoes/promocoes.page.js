import { createPromocoesState } from './promocoes.state.js';
import { calculatePrecoPromocional, mapPromocoesData, resolveVariacaoPrecoBase } from './promocoes.mapper.js';
import { deletePromocao, fetchPromocoesData, savePromocao } from './promocoes.service.js';
import { compareDateOnly, formatDateOnlyPtBr } from './promocoes.date.js';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  return formatDateOnlyPtBr(value);
}

function isPromocaoAtivaLocal(item = {}) {
  const status = normalizeStatus(item?.status, item?.ativaAgora);
  if (status !== 'ativa') return false;
  const today = item?.todayDateOnly || '';
  const inicio = item?.data_inicio || '';
  const fim = item?.data_fim || '';
  return compareDateOnly(inicio, today) <= 0 && compareDateOnly(today, fim) <= 0;
}

function normalizeStatus(status, ativaAgora) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'agendada' || raw === 'scheduled') return 'agendada';
  if (raw === 'encerrada' || raw === 'finalizada' || raw === 'expired') return 'encerrada';
  if (raw === 'inativa' || raw === 'inactive' || ativaAgora === false) return 'inativa';
  if (raw === 'ativa' || raw === 'active' || ativaAgora === true) return 'ativa';
  return raw || 'inativa';
}

function statusLabel(status, ativaAgora) {
  const normalized = normalizeStatus(status, ativaAgora);
  if (normalized === 'ativa') return 'Ativa';
  if (normalized === 'agendada') return 'Agendada';
  if (normalized === 'encerrada') return 'Encerrada';
  return 'Inativa';
}

function statusClass(status, ativaAgora) {
  const normalized = normalizeStatus(status, ativaAgora);
  if (normalized === 'ativa') return 'is-active';
  if (normalized === 'agendada') return 'is-scheduled';
  if (normalized === 'encerrada') return 'is-finished';
  return 'is-inactive';
}

function scopeLabel(item) {
  return item?.aplicar_em_todas_variacoes === false ? 'Variações específicas' : 'Todas as variações';
}

function scopeClass(item) {
  return item?.aplicar_em_todas_variacoes === false ? 'is-specific' : 'is-all';
}

function toPercent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function computeStats(items) {
  const list = Array.isArray(items) ? items : [];
  const stats = { ativa: 0, agendada: 0, encerrada: 0, inativa: 0, descontoTotal: 0, descontoCount: 0 };
  list.forEach((item) => {
    const activeNow = isPromocaoAtivaLocal(item);
    const normalized = normalizeStatus(item?.status, activeNow);
    if (stats[normalized] !== undefined) stats[normalized] += 1;
    const desconto = Number(item?.percentual_desconto);
    if (Number.isFinite(desconto)) {
      stats.descontoTotal += desconto;
      stats.descontoCount += 1;
    }
  });
  return { ...stats, descontoMedio: stats.descontoCount ? stats.descontoTotal / stats.descontoCount : 0 };
}

function injectStyles() {
  if (document.getElementById('nh-promocoes-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-promocoes-style';
  style.textContent = `
  .nhp-wrap{max-width:1320px;width:100%;margin:0 auto;display:grid;gap:16px}
  .nhp-panel{background:#fff;border:1px solid #dbe4f2;border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
  .nhp-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .nhp-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhp-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  .nhp-btn,.nhp-input,.nhp-select,.nhp-textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#fff;color:#16284a}
  .nhp-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  .nhp-btn.secondary{background:#fff;color:#1f56dc}
  .nhp-btn[disabled]{opacity:.6;cursor:not-allowed}
  .nhp-grid-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .nhp-kpi{padding:16px;border:1px solid #e5ecf8;border-radius:16px;background:linear-gradient(180deg,#fff,#f9fbff)}
  .nhp-kpi small{display:block;color:#61708f;font-size:12px}
  .nhp-kpi strong{display:block;margin-top:8px;font-size:26px;color:#0f172a;letter-spacing:-.02em}
  .nhp-kpi span{display:block;margin-top:6px;color:#61708f;font-size:13px}
  .nhp-table-wrap{overflow:auto}
  .nhp-table{width:100%;border-collapse:collapse;min-width:980px}
  .nhp-table th,.nhp-table td{padding:12px 10px;border-bottom:1px solid #edf2f8;text-align:left;vertical-align:top;font-size:13px}
  .nhp-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#61708f;background:#f8fbff}
  .nhp-row:hover td{background:#f8fbff}
  .nhp-badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
  .nhp-badge.is-active{background:#ecfdf3;color:#047857}
  .nhp-badge.is-scheduled{background:#eff6ff;color:#1d4ed8}
  .nhp-badge.is-finished{background:#fff7ed;color:#b45309}
  .nhp-badge.is-inactive{background:#f1f5f9;color:#475569}
  .nhp-badge.is-all{background:#eaf1ff;color:#1d4ed8}
  .nhp-badge.is-specific{background:#eef2ff;color:#4338ca}
  .nhp-badge.is-product-count{background:#f1f5f9;color:#334155}
  .nhp-actions{display:flex;gap:8px;flex-wrap:wrap}
  .nhp-item-stack{display:grid;gap:4px}
  .nhp-item-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .nhp-ellipsis{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .nhp-state{padding:28px;text-align:center;color:#607091}
  .nhp-state-card{display:grid;gap:12px;place-items:center;min-height:260px}
  .nhp-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:nhp-sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes nhp-sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nhp-error{padding:24px;text-align:center;color:#607091}
  .nhp-form{display:grid;gap:16px}
  .nhp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .nhp-form-card{border:1px solid #e5ecf8;border-radius:16px;padding:16px;background:#fff;display:grid;gap:12px}
  .nhp-form-card h3{margin:0;font-size:18px}
  .nhp-field{display:grid;gap:6px}
  .nhp-field small{color:#61708f}
  .nhp-field .nhp-input,.nhp-field .nhp-select,.nhp-field .nhp-textarea{width:100%}
  .nhp-field .nhp-textarea{height:88px;padding:10px;resize:vertical}
  .nhp-radio-group{display:grid;gap:10px}
  .nhp-radio{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #dbe4f2;border-radius:12px;background:#f8fbff;cursor:pointer}
  .nhp-radio input{margin-top:3px}
  .nhp-variation-box{display:grid;gap:10px;padding:12px;border:1px dashed #cbd7ea;border-radius:14px;background:#fbfdff}
  .nhp-variation-list{display:grid;gap:8px}
  .nhp-variation-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e5ecf8;border-radius:12px;background:#fff}
  .nhp-variation-meta{display:grid;gap:2px}
  .nhp-variation-meta strong{font-size:13px}
  .nhp-variation-meta small{color:#61708f}
  .nhp-modal-backdrop{position:fixed;inset:0;background:rgba(9,18,38,.48);display:grid;place-items:center;z-index:50;padding:20px}
  .nhp-modal{width:min(920px,100%);max-height:84vh;overflow:auto;background:#fff;border-radius:20px;border:1px solid #dbe4f2;box-shadow:0 24px 70px rgba(10,20,40,.24);padding:18px;display:grid;gap:12px}
  .nhp-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
  .nhp-product-list{display:grid;gap:8px}
  .nhp-product-row{border:1px solid #dbe4f2;border-radius:14px;background:#f8fbff;padding:12px;text-align:left;cursor:pointer;display:grid;gap:4px}
  .nhp-product-row strong{font-size:14px}
  .nhp-product-row span{font-size:12px;color:#61708f}
  .nhp-form-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
  .nhp-muted{color:#61708f}
  @media (max-width:1280px){.nhp-grid-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.nhp-title{font-size:28px}}
  @media (max-width:1024px){.nhp-form-grid{grid-template-columns:1fr}.nhp-table{min-width:860px}}
  `;
  document.head.appendChild(style);
}

function renderBadge(text, className) {
  return `<span class="nhp-badge ${className}">${text}</span>`;
}

function renderEmptyState(onCreate) {
  return `<section class="nhp-panel nhp-state-card"><div class="nhp-state">Nenhuma promoção cadastrada.</div><button id="nhp-create-first" class="nhp-btn">Criar primeira promoção</button></section>`;
}

function formatProductLabel(product = {}) {
  return String(product?.nome || product?.produto_nome || product?.descricao || '').trim() || 'Produto';
}

function normalizeFormProducts(form = {}) {
  const products = Array.isArray(form.produtos) ? form.produtos : [];
  if (products.length) return products;
  return form.produto ? [{ ...form.produto, produto_id: form.produto.id || form.produto_id || '' }] : [];
}

function getItemEditor(form = {}) {
  return form.itemEditor || {
    produto: null,
    produto_id: '',
    aplicar_em_todas_variacoes: true,
    percentual_desconto: '',
    variacoes_disponiveis: [],
    variacao_ids: [],
    variacoesSelecionadas: [],
    error: ''
  };
}

function normalizeProductItem(product = {}, defaults = {}) {
  const variacoesDisponiveis = Array.isArray(product.variacoes_disponiveis) ? product.variacoes_disponiveis : [];
  const selectedIds = new Set(
    variacoesDisponiveis.filter((variacao) => variacao.selecionada !== false && hasEstoqueDisponivel(variacao)).map((variacao) => String(variacao.id))
  );
  return {
    ...product,
    id: product.id || product.produto_id || '',
    produto_id: product.produto_id || product.id || '',
    aplicar_em_todas_variacoes: product.aplicar_em_todas_variacoes !== false,
    percentual_desconto: product.percentual_desconto ?? defaults.percentual_desconto ?? '',
    variacoes_disponiveis: variacoesDisponiveis.filter(hasEstoqueDisponivel).map((variacao) => ({
      ...variacao,
      selecionada: selectedIds.size ? selectedIds.has(String(variacao.id)) : variacao.selecionada !== false,
      percentualDesconto: variacao.percentualDesconto ?? variacao.percentual_desconto ?? ''
    })),
    variacoesSelecionadas: Array.isArray(product.variacoesSelecionadas) ? product.variacoesSelecionadas : [],
    variacao_ids: variacoesDisponiveis.filter((variacao) => variacao.selecionada !== false && hasEstoqueDisponivel(variacao)).map((variacao) => variacao.id)
  };
}

function getProductDiscountValue(product = {}, fallback = '') {
  const value = product.percentual_desconto ?? product.percentualDesconto ?? fallback;
  return value === null || value === undefined ? '' : value;
}

function getProductVariations(product = {}) {
  return product && Array.isArray(product.variacoes_disponiveis) ? product.variacoes_disponiveis : [];
}

function getActiveProduct(form = {}) {
  const products = normalizeFormProducts(form);
  if (!products.length) return null;
  const activeId = form.produto_ativo_id || form.produto_id || products[0].id;
  return products.find((item) => String(item.id) === String(activeId)) || products[0];
}

function upsertProduct(form, product) {
  const list = Array.isArray(form.produtos) ? form.produtos.slice() : [];
  const normalized = normalizeProductItem(product, form);
  const idx = list.findIndex((item) => String(item.id) === String(normalized.id));
  if (idx >= 0) list[idx] = { ...list[idx], ...normalized };
  else list.push(normalized);
  form.produtos = list;
  if (!form.produto_ativo_id) form.produto_ativo_id = normalized.id;
  form.produto = list.find((item) => String(item.id) === String(form.produto_ativo_id)) || list[0] || null;
}

function removeProduct(form, productId) {
  form.produtos = (Array.isArray(form.produtos) ? form.produtos : []).filter((produto) => String(produto.id) !== String(productId));
  if (String(form.produto_ativo_id) === String(productId)) form.produto_ativo_id = form.produtos[0]?.id || '';
  form.produto = form.produtos[0] || null;
}

function getPromocaoProdutos(item = {}) {
  if (Array.isArray(item?.produtos) && item.produtos.length) return item.produtos;
  if (item?.produto) return [item.produto];
  if (item?.produto_id || item?.produto_nome || item?.produto_descricao) {
    return [{
      id: item?.produto_id || null,
      nome: item?.produto_nome || item?.produto || null,
      descricao: item?.produto_descricao || null
    }];
  }
  return [];
}

function renderProdutosCell(item = {}) {
  const produtos = getPromocaoProdutos(item);
  const primary = produtos[0] || {};
  const label = formatProductLabel(primary);
  const countLabel = `${produtos.length || 0} produto${produtos.length === 1 ? '' : 's'}`;
  return `<div class="nhp-item-stack">
    <strong>${label}</strong>
    ${primary.descricao ? `<div class="nhp-muted nhp-ellipsis">${primary.descricao}</div>` : ''}
    <div class="nhp-item-meta">
      ${renderBadge(countLabel, 'is-product-count')}
    </div>
  </div>`;
}

function normalizeDiscount(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 && numeric <= 100 ? numeric : null;
}

function normalizeEstoque(value) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function hasEstoqueDisponivel(variacao = {}) {
  const hasField = ['estoque', 'stock', 'quantidade', 'qtd_estoque'].some((key) => Object.prototype.hasOwnProperty.call(variacao || {}, key));
  if (!hasField) return true;
  const estoque = normalizeEstoque(variacao.estoque ?? variacao.stock ?? variacao.quantidade ?? variacao.qtd_estoque);
  return Number.isFinite(estoque) && estoque > 0;
}

function formatPercentValue(value) {
  if (value === null || value === undefined || value === '') return '-%';
  return typeof value === 'string' ? `${value}%` : `${Number(value)}%`;
}

function getItemResumoDesconto(produto = {}, globalPercentual = null) {
  const itemPercentual = normalizeDiscount(produto.percentual_desconto);
  if (produto.aplicar_em_todas_variacoes !== false) {
    return itemPercentual ?? normalizeDiscount(globalPercentual);
  }
  const variacoes = Array.isArray(produto.variacoes_disponiveis) ? produto.variacoes_disponiveis : [];
  const selected = variacoes
    .filter((variacao) => variacao.selecionada)
    .map((variacao) => normalizeDiscount(variacao.percentualDesconto))
    .filter((value) => Number.isFinite(value));
  if (!selected.length) return null;
  return selected.length === 1 ? selected[0] : `${Math.min(...selected)}-${Math.max(...selected)}`;
}

function validateItemDiscount(editor, globalPercentual) {
  if (editor.aplicar_em_todas_variacoes !== false) {
    const discount = normalizeDiscount(editor.percentual_desconto ?? globalPercentual);
    return { valid: Number.isFinite(discount), discount, message: 'Informe um desconto válido para o item da promoção.' };
  }
  const variacoes = Array.isArray(editor.variacoes_disponiveis) ? editor.variacoes_disponiveis : [];
  const selected = variacoes.filter((variacao) => variacao.selecionada);
  if (!selected.length) {
    return { valid: false, discount: null, message: 'Selecione ao menos uma variação para o produto.' };
  }
  const invalid = selected.find((variacao) => !Number.isFinite(normalizeDiscount(variacao.percentualDesconto)));
  if (invalid) {
    return { valid: false, discount: null, message: 'Informe um desconto válido para todas as variações selecionadas.' };
  }
  return { valid: true, discount: selected.map((variacao) => normalizeDiscount(variacao.percentualDesconto)), message: '' };
}

function getInvalidSelectedVariationIds(editor = {}) {
  const variacoes = Array.isArray(editor.variacoes_disponiveis) ? editor.variacoes_disponiveis : [];
  return variacoes
    .filter((variacao) => variacao.selecionada && !Number.isFinite(normalizeDiscount(variacao.percentualDesconto)))
    .map((variacao) => String(variacao.id));
}

function buildVariacaoState(variacoes = [], selectedMap = new Map(), defaultPercentual = null) {
  return variacoes.map((variacao) => {
    const existing = selectedMap.get(String(variacao.id));
    const percentualDesconto = existing?.percentualDesconto ?? existing?.percentual_desconto ?? defaultPercentual ?? null;
    return {
      ...variacao,
      selecionada: existing ? existing.selecionada !== false : true,
      percentualDesconto: percentualDesconto === '' ? null : percentualDesconto
    };
  });
}

function getProductById(form, productId) {
  return normalizeFormProducts(form).find((item) => String(item.id) === String(productId)) || null;
}

function normalizePromotionItem(item = {}) {
  const variacoes = Array.isArray(item.variacoes_disponiveis) && item.variacoes_disponiveis.length
    ? item.variacoes_disponiveis
    : Array.isArray(item.variacoes)
      ? item.variacoes
      : [];
  const variacoesComEstoque = variacoes.filter(hasEstoqueDisponivel);
  return {
    produto_id: item.produto_id || item.id || '',
    id: item.produto_id || item.id || '',
    nome: item.nome || item.produto_nome || item.produto || '',
    descricao: item.descricao || item.produto_descricao || '',
    aplicar_em_todas_variacoes: item.aplicar_em_todas_variacoes !== false,
    percentual_desconto: item.percentual_desconto ?? '',
    variacoes_disponiveis: variacoesComEstoque.map((variacao) => ({
      ...variacao,
      selecionada: true,
      percentualDesconto: variacao.percentual_desconto ?? variacao.percentualDesconto ?? ''
    })),
    variacao_ids: variacoesComEstoque.map((variacao) => variacao.variacao_id || variacao.variacaoId || variacao.id).filter(Boolean),
    variacoesSelecionadas: variacoesComEstoque.map((variacao) => ({
      variacaoId: variacao.variacao_id || variacao.variacaoId || variacao.id,
      percentualDesconto: variacao.percentual_desconto ?? variacao.percentualDesconto ?? null
    }))
  };
}

function clearItemEditor(form = {}) {
  form.itemEditor = {
    produto: null,
    produto_id: '',
    aplicar_em_todas_variacoes: true,
    painel_variacoes_aberto: true,
    percentual_desconto: '',
    variacoes_disponiveis: [],
    variacao_ids: [],
    variacoesSelecionadas: [],
    error: ''
  };
}

function updateItemEditorFromProduct(form, product, productDetails = null, variacoes = []) {
  const resolvedProduct = { ...(product || {}), ...(productDetails?.item || productDetails || {}) };
  const mappedVariacoes = variacoes.filter(hasEstoqueDisponivel).map((variacao) => ({
    ...variacao,
    selecionada: false,
    percentualDesconto: ''
  }));
  const previous = getItemEditor(form);
  form.itemEditor = {
    ...previous,
    produto: resolvedProduct,
    produto_id: resolvedProduct.id || product?.id || '',
    aplicar_em_todas_variacoes: previous.aplicar_em_todas_variacoes !== false ? true : false,
    painel_variacoes_aberto: true,
    percentual_desconto: previous.percentual_desconto ?? '',
    variacoes_disponiveis: mappedVariacoes,
    variacao_ids: mappedVariacoes.map((variacao) => variacao.id),
    variacoesSelecionadas: [],
    error: previous.error || ''
  };
}

function renderProductSearchModal(state) {
  if (!state.productSearchOpen) return '';
  return `<div class="nhp-modal-backdrop" id="nhp-product-modal">
    <div class="nhp-modal">
      <div class="nhp-modal-head">
        <div>
          <strong>Selecionar produto</strong>
          <div class="nhp-muted">Busque por SKU, nome, referência, categoria ou fabricante.</div>
        </div>
        <button id="nhp-product-modal-close" class="nhp-btn secondary">Fechar</button>
      </div>
      <label class="nhp-field">Buscar<input id="nhp-product-search" class="nhp-input" value="${state.productSearchTerm || ''}" placeholder="Digite para buscar" autocomplete="off"></label>
      ${state.productSearchLoading ? '<div class="nhp-state">Buscando produtos...</div>' : ''}
      ${state.productSearchError ? `<div class="nhp-state" role="alert">${state.productSearchError}</div>` : ''}
      <div class="nhp-product-list">
        ${(state.productSearchItems || []).map((item) => `<button type="button" class="nhp-product-row nhp-product-search-item" data-product-id="${item.id}" data-product-name="${formatProductLabel(item)}">
          <strong>${item.nome || '-'}</strong>
          <span>${item.sku || '-'}${item.fabricante_nome ? ` • ${item.fabricante_nome}` : ''}${item.categoria_nome || item.categoria ? ` • ${item.categoria_nome || item.categoria}` : ''}</span>
        </button>`).join('')}
      </div>
    </div>
  </div>`;
}

function renderForm(state) {
  const editor = getItemEditor(state.form);
  const produtosSelecionados = Array.isArray(state.form.produtos) ? state.form.produtos : [];
  const produtoAtivo = editor.produto || null;
  const variacoes = Array.isArray(editor.variacoes_disponiveis) ? editor.variacoes_disponiveis : [];
  const showSpecific = editor.aplicar_em_todas_variacoes === false;
  const globalPercentual = state.form.percentual_desconto ?? '';
  const itemPercentual = editor.percentual_desconto ?? '';
  const selectedCount = variacoes.filter((variacao) => variacao.selecionada).length;
  const canAdd = Boolean(produtoAtivo?.id);
  const hasInvalidItem = produtosSelecionados.some((produto) => getItemResumoDesconto(produto, globalPercentual) === null);
  const invalidSelectedVariationIds = getInvalidSelectedVariationIds(editor);
  const variationError = editor.error || (showSpecific && invalidSelectedVariationIds.length ? 'Informe um desconto válido para todas as variações selecionadas.' : '');
  const saveDisabled = !produtosSelecionados.length || hasInvalidItem || !String(state.form.nome || '').trim() || !state.form.data_inicio || !state.form.data_fim || !String(state.form.status || '').trim();
  return `<section class="nhp-panel nhp-form">
    <div>
      <h2 style="margin:0;font-size:20px">Formulário</h2>
      <div class="nhp-sub">Organize a promoção, o período e o escopo de variações em blocos claros.</div>
    </div>
    <div class="nhp-form-grid">
      <article class="nhp-form-card">
        <h3>Dados da promoção</h3>
        <label class="nhp-field">Nome da promoção<input id="nhp-nome" class="nhp-input" value="${state.form.nome || ''}"></label>
        <label class="nhp-field">Descrição<textarea id="nhp-descricao" class="nhp-textarea">${state.form.descricao || ''}</textarea></label>
        <label class="nhp-field">Status<select id="nhp-status" class="nhp-select"><option value="ativa" ${String(state.form.status || 'ativa') === 'ativa' ? 'selected' : ''}>Ativa</option><option value="agendada" ${String(state.form.status || '') === 'agendada' ? 'selected' : ''}>Agendada</option><option value="encerrada" ${String(state.form.status || '') === 'encerrada' ? 'selected' : ''}>Encerrada</option><option value="inativa" ${String(state.form.status || '') === 'inativa' ? 'selected' : ''}>Inativa</option></select></label>
      </article>
      <article class="nhp-form-card">
        <h3>Período e desconto</h3>
        <div class="nhp-form-grid" style="grid-template-columns:1fr 1fr">
          <label class="nhp-field">Data inicial<input id="nhp-data_inicio" type="date" class="nhp-input" value="${state.form.data_inicio || ''}"></label>
          <label class="nhp-field">Data final<input id="nhp-data_fim" type="date" class="nhp-input" value="${state.form.data_fim || ''}"></label>
        </div>
        <label class="nhp-field">Desconto da promoção<input id="nhp-percentual_desconto" type="number" min="0" max="100" class="nhp-input" value="${globalPercentual}"><small>Desconto geral da promoção, usado como fallback para itens sem valor próprio.</small></label>
      </article>
      <article class="nhp-form-card">
        <h3>Adicionar item à promoção</h3>
        <label class="nhp-field">Produto
          <div style="display:flex;gap:8px">
            <input id="nhp-produto_display" class="nhp-input" value="${produtoAtivo ? formatProductLabel(produtoAtivo) : ''}" readonly placeholder="Escolha um produto">
            <button id="nhp-produto-search-open" class="nhp-btn secondary" type="button" aria-label="Abrir busca de produtos">🔍</button>
          </div>
        </label>
        ${editor.error ? `<div class="nhp-error" role="alert">${editor.error}</div>` : ''}
        <div class="nhp-radio-group" role="radiogroup" aria-label="Escopo da promoção">
          <label class="nhp-radio"><input type="radio" name="nhp-escopo" id="nhp-escopo-all" value="all" ${!showSpecific ? 'checked' : ''}><span><strong>Todas as variações</strong><br/><small class="nhp-muted">Aplica o desconto automaticamente em toda a grade do item.</small></span></label>
          <label class="nhp-radio"><input type="radio" name="nhp-escopo" id="nhp-escopo-specific" value="specific" ${showSpecific ? 'checked' : ''}><span><strong>Variações específicas</strong><br/><small class="nhp-muted">Escolha as variações que entram neste item da promoção.</small></span></label>
        </div>
        ${showSpecific ? `<div class="nhp-variation-box" id="nhp-variacoes">
          <strong>Variações específicas${produtoAtivo ? ` - ${formatProductLabel(produtoAtivo)}` : ''}</strong>
          <div class="nhp-muted">${produtoAtivo ? `${selectedCount} variação(ões) selecionada(s) neste item.` : 'Nenhum produto selecionado.'}</div>
          ${variationError ? `<div class="nhp-error" role="alert">${variationError}</div>` : ''}
          ${produtoAtivo && variacoes.length ? `<div class="nhp-table-wrap"><table class="nhp-table" style="min-width:100%"><thead><tr><th></th><th>SKU</th><th>Cor</th><th>Grade</th><th>Preço base</th><th>Desconto %</th><th>Preço promocional</th></tr></thead><tbody>${variacoes.map((variacao) => {
            const basePrice = resolveVariacaoPrecoBase(variacao, produtoAtivo);
            const desconto = normalizeDiscount(variacao.percentualDesconto);
            const promoPrice = desconto !== null ? calculatePrecoPromocional(basePrice, desconto) : null;
            const invalid = variacao.selecionada && desconto === null;
            return `<tr>
              <td><input type="checkbox" class="nhp-variacao-check" data-variacao-id="${variacao.id || ''}" ${variacao.selecionada ? 'checked' : ''}></td>
              <td>${variacao.sku || '-'}</td>
              <td>${variacao.cor || '-'}</td>
              <td>${variacao.grade || variacao.tamanho || '-'}</td>
              <td>${brl(basePrice)}</td>
              <td><input class="nhp-input nhp-variacao-percentual ${invalid ? 'is-invalid' : ''}" data-variacao-id="${variacao.id || ''}" type="number" min="0" max="100" value="${variacao.percentualDesconto ?? ''}" placeholder="${itemPercentual || globalPercentual || ''}"></td>
              <td>${promoPrice !== null ? brl(promoPrice) : '-'}</td>
            </tr>`;
          }).join('')}</tbody></table></div>` : `<div class="nhp-state">${produtoAtivo ? 'Nenhuma variação com estoque disponível para promoção.' : 'Escolha um produto para listar suas variações.'}</div>`}
        </div>` : `<div class="nhp-variation-box" id="nhp-variacoes"><strong>Todas as variações</strong><div class="nhp-muted">Nenhuma seleção manual necessária.</div></div>`}
        <div class="nhp-form-actions" style="justify-content:flex-start">
          <button id="nhp-add-item" class="nhp-btn" ${canAdd ? '' : 'disabled'} type="button">Adicionar à promoção</button>
        </div>
      </article>
    </div>
    <article class="nhp-form-card">
      <h3>Itens da promoção</h3>
      <div class="nhp-muted">Itens adicionados: ${produtosSelecionados.length}</div>
      <div class="nhp-item-stack">
        ${produtosSelecionados.map((produto) => {
          const vars = Array.isArray(produto.variacoes_disponiveis) ? produto.variacoes_disponiveis : [];
          const scope = produto.aplicar_em_todas_variacoes ? 'Todas as variações' : 'Variações específicas';
          const desconto = getItemResumoDesconto(produto, globalPercentual);
          return `<div class="nhp-product-row" data-product-id="${produto.id}">
            <div class="nhp-item-stack">
              <strong>${formatProductLabel(produto)}</strong>
              <span>${scope} • ${vars.filter((v) => v.selecionada).length} variação(ões) • ${formatPercentValue(desconto ?? globalPercentual)}</span>
            </div>
            <div class="nhp-actions">
              <button type="button" class="nhp-btn secondary nhp-edit-item" data-product-id="${produto.id}">Editar</button>
              <button type="button" class="nhp-btn secondary nhp-remove-item" data-product-id="${produto.id}">Remover</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </article>
    <div class="nhp-form-actions"><button id="nhp-cancel" class="nhp-btn secondary">Cancelar</button><button id="nhp-save" class="nhp-btn" ${saveDisabled ? 'disabled' : ''}>Salvar</button></div>
  </section>`;
}

function renderList(items) {
  const rows = items.map((item) => {
    const scope = scopeLabel(item);
    const desconto = toPercent(item?.percentual_desconto);
    const price = Number(item?.preco_base || item?.preco || 0);
    const promoPrice = calculatePrecoPromocional(price, desconto);
    const activeNow = isPromocaoAtivaLocal(item);
    const status = normalizeStatus(item?.status, activeNow);
    const active = status === 'ativa';
    return `<tr class="nhp-row" data-id="${item?.id || ''}">
      <td><strong>${item?.nome || '-'}</strong></td>
      <td>${renderProdutosCell(item)}</td>
      <td><strong>${desconto}%</strong><div class="nhp-muted">${brl(price)} -> ${brl(promoPrice)}</div></td>
      <td>${formatDate(item?.data_inicio)} a ${formatDate(item?.data_fim)}</td>
      <td>${renderBadge(statusLabel(status, activeNow), statusClass(status, activeNow))}</td>
      <td>${renderBadge(scope, scopeClass(item))}</td>
      <td>
        <div class="nhp-actions">
          <button class="nhp-btn secondary" data-action="edit" data-id="${item?.id || ''}">Editar</button>
          <button class="nhp-btn secondary" data-action="${active ? 'disable' : 'enable'}" data-id="${item?.id || ''}">${active ? 'Inativar' : 'Ativar'}</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `<section class="nhp-panel"><div class="nhp-table-wrap"><table class="nhp-table"><thead><tr><th>Promoção</th><th>Produtos</th><th>Desconto</th><th>Período</th><th>Status</th><th>Escopo</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function renderPromocoesPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createPromocoesState();
  let productSearchTimer = null;
  let variacaoRenderTimer = null;

  function syncFormFromRadio() {
    const specific = root.querySelector('#nhp-escopo-specific');
    state.form.aplicar_em_todas_variacoes = !specific || !specific.checked ? true : false;
  }

  function syncTextFieldsToState() {
    const nome = root.querySelector('#nhp-nome');
    const descricao = root.querySelector('#nhp-descricao');
    const dataInicio = root.querySelector('#nhp-data_inicio');
    const dataFim = root.querySelector('#nhp-data_fim');
    const status = root.querySelector('#nhp-status');
    const percentual = root.querySelector('#nhp-percentual_desconto');
    if (nome) state.form.nome = nome.value || '';
    if (descricao) state.form.descricao = descricao.value || '';
    if (dataInicio) state.form.data_inicio = dataInicio.value || '';
    if (dataFim) state.form.data_fim = dataFim.value || '';
    if (status) state.form.status = status.value || 'ativa';
    if (percentual) state.form.percentual_desconto = percentual.value || '';
  }

  function captureFocusState() {
    const active = document.activeElement;
    if (!active || !root.contains(active)) return null;
    const focusId = active.getAttribute('id');
    const focusVariationId = active.getAttribute('data-variacao-id');
    return {
      id: focusId,
      variationId: focusVariationId,
      selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
    };
  }

  function restoreFocusState(snapshot) {
    if (!snapshot) return;
    let target = null;
    if (snapshot.id) target = root.querySelector(`[id="${snapshot.id.replace(/"/g, '\\"')}"]`);
    if (!target && snapshot.variationId) target = root.querySelector(`.nhp-variacao-percentual[data-variacao-id="${snapshot.variationId}"]`);
    if (!target || typeof target.focus !== 'function') return;
    target.focus();
    if (typeof target.setSelectionRange === 'function' && snapshot.selectionStart !== null && snapshot.selectionEnd !== null) {
      try {
        target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
      } catch {}
    }
  }

  async function searchProducts(term = '') {
    state.productSearchLoading = true;
    state.productSearchError = '';
    render();
    try {
      const result = await apiClient.get('/produtos/search', { q: term, search: term });
      state.productSearchItems = Array.isArray(result?.items) ? result.items : [];
    } catch (error) {
      state.productSearchError = error?.body?.error?.message || error?.message || 'Não foi possível buscar produtos.';
      state.productSearchItems = [];
    } finally {
      state.productSearchLoading = false;
      render();
    }
  }

  function activateProduct(productId) {
    const item = getProductById(state.form, productId);
    if (!item) return;
    state.form.itemEditor.produto = item;
    render();
  }

  function syncProductScope(scopeSpecific) {
    state.form.itemEditor.aplicar_em_todas_variacoes = scopeSpecific === true ? false : true;
  }

  function scheduleProductSearch(term = '') {
    clearTimeout(productSearchTimer);
    const normalizedTerm = String(term || '').trim();
    state.productSearchTerm = normalizedTerm;
    if (normalizedTerm.length < 3) {
      return;
    }
    productSearchTimer = setTimeout(() => {
      searchProducts(normalizedTerm);
    }, 650);
  }

  function scheduleVariacaoRender() {
    clearTimeout(variacaoRenderTimer);
    variacaoRenderTimer = setTimeout(() => {
      render();
    }, 300);
  }

  async function loadVariationsForProduct(product) {
    state.form.itemEditor.error = '';
    state.form.itemEditor.produto = product;
    state.form.itemEditor.produto_id = product?.id || '';
    state.form.itemEditor.painel_variacoes_aberto = true;
    state.productSearchOpen = false;
    render();
    try {
      const productDetails = await apiClient.get(`/produtos/${product.id}`);
      const result = await apiClient.get(`/produtos/${product.id}/variacoes`);
      const variacoes = Array.isArray(result?.items) ? result.items : [];
      updateItemEditorFromProduct(state.form, product, productDetails, variacoes);
      state.form.itemEditor.painel_variacoes_aberto = true;
    } catch {
      updateItemEditorFromProduct(state.form, product, null, []);
      state.form.itemEditor.painel_variacoes_aberto = true;
    }
    render();
  }

  function resetEditorAfterAdd() {
    clearItemEditor(state.form);
    state.form.produto = null;
    state.form.produto_id = '';
    state.productSearchTerm = '';
    state.productSearchItems = [];
    state.productSearchError = '';
  }

  function render() {
    const focusSnapshot = captureFocusState();
    const items = Array.isArray(state.items) ? state.items : [];
    const stats = computeStats(items);
    const formSection = state.formOpen ? renderForm(state) : '';
    const listing = items.length ? renderList(items) : renderEmptyState();
    root.innerHTML = `
      <section class="nhp-wrap">
        <header class="nhp-panel nhp-header">
          <div>
            <div class="nhp-title">Promoções</div>
            <div class="nhp-sub">Gerencie descontos por período para produtos e variações.</div>
          </div>
          <div>
            <button id="nhp-new" class="nhp-btn">Nova promoção</button>
          </div>
        </header>
        <section class="nhp-grid-kpi" aria-label="Resumo de promoções">
          <article class="nhp-kpi"><small>Promoções ativas</small><strong>${stats.ativa}</strong><span>Em vigor no momento</span></article>
          <article class="nhp-kpi"><small>Agendadas</small><strong>${stats.agendada}</strong><span>Programadas para iniciar</span></article>
          <article class="nhp-kpi"><small>Encerradas/Inativas</small><strong>${stats.encerrada + stats.inativa}</strong><span>Fora do ar</span></article>
          <article class="nhp-kpi"><small>Desconto médio</small><strong>${stats.descontoMedio.toFixed(1)}%</strong><span>Baseado nas promoções carregadas</span></article>
        </section>
        ${state.loading ? '<section class="nhp-panel nhp-loading" aria-busy="true"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></section>' : ''}
        ${state.error ? `<section class="nhp-panel nhp-error" role="alert" aria-live="assertive">Não foi possível carregar as promoções.<br/><br/><button id="nhp-retry" class="nhp-btn">Tentar novamente</button></section>` : ''}
        ${!state.loading && !state.error ? listing : ''}
        ${formSection}
        ${renderProductSearchModal(state)}
      </section>
    `;

    root.querySelector('#nhp-new')?.addEventListener('click', () => { state.formOpen = true; render(); });
    root.querySelector('#nhp-create-first')?.addEventListener('click', () => { state.formOpen = true; render(); });
    root.querySelector('#nhp-retry')?.addEventListener('click', load);
    root.querySelector('#nhp-produto-search-open')?.addEventListener('click', async () => {
      state.productSearchOpen = true;
      render();
      await searchProducts(state.productSearchTerm || '');
    });
    root.querySelector('#nhp-product-modal-close')?.addEventListener('click', () => { state.productSearchOpen = false; render(); });
    root.querySelector('#nhp-product-search')?.addEventListener('input', (event) => {
      scheduleProductSearch(event.target.value || '');
    });
    root.querySelectorAll('.nhp-product-search-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-product-id');
        const name = btn.getAttribute('data-product-name');
        if (!id) return;
        await loadVariationsForProduct({ id, nome: name });
      });
    });
    root.querySelector('#nhp-add-item')?.addEventListener('click', () => {
      const editor = getItemEditor(state.form);
      const produto = editor.produto;
      if (!produto?.id) return;
      const variacoes = Array.isArray(editor.variacoes_disponiveis) ? editor.variacoes_disponiveis : [];
      const validation = validateItemDiscount(editor, state.form.percentual_desconto);
      if (!validation.valid) {
        editor.error = validation.message;
        render();
        return;
      }
      const item = normalizePromotionItem({
        produto_id: produto.id,
        nome: produto.nome || formatProductLabel(produto),
        descricao: produto.descricao || '',
        aplicar_em_todas_variacoes: editor.aplicar_em_todas_variacoes,
        percentual_desconto: editor.aplicar_em_todas_variacoes !== false ? normalizeDiscount(editor.percentual_desconto ?? state.form.percentual_desconto) : null,
        variacoes_disponiveis: variacoes.filter((variacao) => variacao.selecionada && hasEstoqueDisponivel(variacao)).map((variacao) => ({
          ...variacao,
          selecionada: true,
          percentualDesconto: normalizeDiscount(variacao.percentualDesconto)
        })),
        variacoes: variacoes.filter((variacao) => variacao.selecionada && hasEstoqueDisponivel(variacao)).map((variacao) => ({
          variacao_id: variacao.id,
          estoque: variacao.estoque,
          percentual_desconto: normalizeDiscount(variacao.percentualDesconto)
        }))
      });
      const existingIndex = state.form.produtos.findIndex((itemAtual) => String(itemAtual.produto_id) === String(item.produto_id));
      if (existingIndex >= 0) state.form.produtos.splice(existingIndex, 1);
      state.form.produtos = [...state.form.produtos, item];
      resetEditorAfterAdd();
      render();
    });
    root.querySelectorAll('.nhp-edit-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-product-id');
        const selected = state.form.produtos.find((item) => String(item.produto_id) === String(id));
        if (!selected) return;
        state.form.itemEditor = {
          produto: { id: selected.produto_id, nome: selected.nome, descricao: selected.descricao },
          produto_id: selected.produto_id,
          aplicar_em_todas_variacoes: selected.aplicar_em_todas_variacoes !== false,
          percentual_desconto: selected.percentual_desconto ?? '',
          variacoes_disponiveis: (selected.variacoes_disponiveis || []).filter(hasEstoqueDisponivel).map((variacao) => ({
            ...variacao,
            selecionada: true,
            percentualDesconto: variacao.percentualDesconto ?? variacao.percentual_desconto ?? ''
          })),
          variacao_ids: Array.isArray(selected.variacao_ids) ? selected.variacao_ids : [],
          variacoesSelecionadas: Array.isArray(selected.variacoesSelecionadas) ? selected.variacoesSelecionadas : [],
          error: ''
        };
        state.productSearchOpen = false;
        render();
      });
    });
    root.querySelectorAll('.nhp-remove-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-product-id');
        state.form.produtos = state.form.produtos.filter((item) => String(item.produto_id) !== String(id));
        render();
      });
    });
    root.querySelectorAll('[data-action="disable"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        await deletePromocao(apiClient, id);
        await load();
      });
    });
    root.querySelectorAll('[data-action="enable"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        await savePromocao(apiClient, { status: 'ativa' }, id);
        await load();
      });
    });
    root.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const selected = items.find((item) => String(item.id) === String(id));
        if (!selected) return;
        state.formOpen = true;
        state.form = {
          ...state.form,
          id: selected.id,
          nome: selected.nome || '',
          descricao: selected.descricao || '',
          produtos: Array.isArray(selected.produtos) ? selected.produtos.map(normalizePromotionItem) : [],
          percentual_desconto: selected.percentual_desconto ?? '',
          data_inicio: selected.data_inicio || '',
          data_fim: selected.data_fim || '',
          status: normalizeStatus(selected.status, selected.ativaAgora),
          aplicar_em_todas_variacoes: selected.aplicar_em_todas_variacoes !== false
        };
        clearItemEditor(state.form);
        render();
      });
    });

    if (state.formOpen) {
      root.querySelector('#nhp-cancel')?.addEventListener('click', () => { state.formOpen = false; render(); });
      root.querySelector('#nhp-save')?.addEventListener('click', async () => {
        syncTextFieldsToState();
        const globalPercentual = normalizeDiscount(state.form.percentual_desconto);
        if (!state.form.produtos.length) {
          state.form.itemEditor.error = 'Adicione ao menos um item à promoção.';
          render();
          return;
        }
        const invalidItem = state.form.produtos.find((produto) => getItemResumoDesconto(produto, globalPercentual) === null);
        if (invalidItem) {
          state.form.itemEditor.error = 'Informe um desconto válido para o item da promoção.';
          render();
          return;
        }
        const payload = {
          nome: state.form.nome || '',
          descricao: state.form.descricao || '',
          produtos: state.form.produtos.map((produto) => ({
            produto_id: produto.produto_id || produto.id,
            nome: produto.nome || '',
            descricao: produto.descricao || '',
            aplicar_em_todas_variacoes: produto.aplicar_em_todas_variacoes !== false,
            percentual_desconto: produto.aplicar_em_todas_variacoes !== false ? normalizeDiscount(produto.percentual_desconto ?? globalPercentual) : null,
            variacoes: (Array.isArray(produto.variacoes_disponiveis) ? produto.variacoes_disponiveis : [])
              .filter((variacao) => variacao.selecionada)
              .map((variacao) => ({
                variacao_id: variacao.id || variacao.variacao_id || variacao.variacaoId,
                percentual_desconto: normalizeDiscount(variacao.percentualDesconto)
              }))
          })),
          data_inicio: state.form.data_inicio || '',
          data_fim: state.form.data_fim || '',
          status: state.form.status || 'ativa',
          aplicar_em_todas_variacoes: true
        };
        if (Number.isFinite(globalPercentual)) payload.percentual_desconto = globalPercentual;
        await savePromocao(apiClient, payload, state.form.id || null);
        state.formOpen = false;
        await load();
      });
    root.querySelector('#nhp-escopo-all')?.addEventListener('change', () => { state.form.itemEditor.aplicar_em_todas_variacoes = true; render(); });
    root.querySelector('#nhp-escopo-specific')?.addEventListener('change', () => { state.form.itemEditor.aplicar_em_todas_variacoes = false; render(); });
      root.querySelector('#nhp-nome')?.addEventListener('input', (event) => {
        state.form.nome = event.target.value || '';
        render();
      });
      root.querySelector('#nhp-descricao')?.addEventListener('input', (event) => {
        state.form.descricao = event.target.value || '';
        render();
      });
      root.querySelector('#nhp-data_inicio')?.addEventListener('input', (event) => {
        state.form.data_inicio = event.target.value || '';
        render();
      });
      root.querySelector('#nhp-data_fim')?.addEventListener('input', (event) => {
        state.form.data_fim = event.target.value || '';
        render();
      });
      root.querySelector('#nhp-status')?.addEventListener('change', (event) => {
        state.form.status = event.target.value || 'ativa';
        render();
      });
      root.querySelector('#nhp-percentual_desconto')?.addEventListener('input', (event) => {
        state.form.percentual_desconto = event.target.value || '';
        scheduleVariacaoRender();
      });
      root.querySelectorAll('.nhp-variacao-check').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
          const variacaoId = event.target.getAttribute('data-variacao-id');
          state.form.itemEditor.variacoes_disponiveis = (state.form.itemEditor.variacoes_disponiveis || []).filter(hasEstoqueDisponivel).map((variacao) => (
            String(variacao.id) === String(variacaoId) ? { ...variacao, selecionada: event.target.checked } : variacao
          ));
          state.form.itemEditor.variacao_ids = state.form.itemEditor.variacoes_disponiveis.filter((variacao) => variacao.selecionada).map((variacao) => variacao.id);
          state.form.itemEditor.variacoesSelecionadas = state.form.itemEditor.variacoes_disponiveis.filter((variacao) => variacao.selecionada).map((variacao) => ({ variacaoId: variacao.id, percentualDesconto: normalizeDiscount(variacao.percentualDesconto) }));
          render();
        });
      });
      root.querySelectorAll('.nhp-variacao-percentual').forEach((input) => {
        input.addEventListener('input', (event) => {
          const variacaoId = event.target.getAttribute('data-variacao-id');
          const nextValue = event.target.value || '';
          const nextDiscount = normalizeDiscount(nextValue);
          state.form.itemEditor.variacoes_disponiveis = (state.form.itemEditor.variacoes_disponiveis || []).filter(hasEstoqueDisponivel).map((variacao) => (
            String(variacao.id) === String(variacaoId)
              ? { ...variacao, percentualDesconto: nextValue, selecionada: nextDiscount !== null ? true : false }
              : variacao
          ));
          state.form.itemEditor.variacao_ids = state.form.itemEditor.variacoes_disponiveis.filter((variacao) => variacao.selecionada).map((variacao) => variacao.id);
          state.form.itemEditor.variacoesSelecionadas = state.form.itemEditor.variacoes_disponiveis
            .filter((variacao) => variacao.selecionada)
            .map((variacao) => ({ variacaoId: variacao.id, percentualDesconto: normalizeDiscount(variacao.percentualDesconto) }))
            .filter((variacao) => Number.isFinite(variacao.percentualDesconto));
          scheduleVariacaoRender();
        });
        input.addEventListener('blur', () => {
          render();
        });
      });
    }
    restoreFocusState(focusSnapshot);
  }

  async function load() {
    state.loading = true;
    state.error = '';
    render();
    try {
      state.items = mapPromocoesData(await fetchPromocoesData(apiClient)).items;
    } catch {
      state.error = 'error';
    } finally {
      state.loading = false;
      render();
    }
  }

  render();
  load();
}
