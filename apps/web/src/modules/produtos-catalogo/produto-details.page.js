import { createProdutoDetailsState } from './produto-details.state.js';
import { applyProdutoUsageDrillDown, applyProdutoUsageFilters, createProdutoEditForm, mapProdutoUsageCsvContent, mapProdutoUsageCsvFilename, mapProdutoUsageCsvRows, validateProdutoEditForm } from './produto-details.mapper.js';
import { fetchProdutoDetailsData, fetchProdutoImagens, fetchProdutoUsageDataWithMetrics, updateProduto, uploadProdutoImagem, uploadProdutoVariacaoImagem } from './produto-details.service.js';
import { getProductAuditIssueLabel, getProductAuditIssueTooltip } from '../product-audit/product-audit.mapper.js';
import { calculatePrecoPromocional } from '../promocoes/promocoes.mapper.js';
import { fetchProdutoPromocoesData } from '../promocoes/promocoes.service.js';

function statusClass(status) {
  if (status === 'ativo') return 'is-ok';
  if (status === 'inativo') return 'is-off';
  return 'is-unk';
}
function brl(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatPtBrNumber(value) { return Number(value || 0).toLocaleString('pt-BR'); }
function normalizeStatusLabel(status, ativo) {
  const s = String(status || '').toLowerCase();
  if (s === 'ativo' || ativo === true) return 'Ativa';
  if (s === 'inativo' || ativo === false) return 'Inativa';
  return s || 'desconhecido';
}
function formatVariationField(value) {
  const text = String(value ?? '').trim();
  return text || '-';
}
function getVariationBasePrice(variation = {}, product = {}) {
  const variationPrice = Number(variation.preco);
  if (Number.isFinite(variationPrice) && variationPrice > 0) return variationPrice;
  const productPrice = Number(product.preco);
  return Number.isFinite(productPrice) ? productPrice : 0;
}
function getVariationPromoPrice(variation = {}, product = {}, promocoes = []) {
  const activePromocao = promocoes.find((promocao) => {
    const produtos = Array.isArray(promocao.produtos) ? promocao.produtos : [];
    const matchesProduct = produtos.some((produto) => String(produto.id) === String(product.id));
    const matchesLegacy = String(promocao.produto_id || '') === String(product.id);
    const matchesVariation = produtos.some((produto) => Array.isArray(produto.variacoes) && produto.variacoes.some((item) => String(item.variacao_id || item.variacaoId || item.id) === String(variation.id)));
    const matchesLegacyVariation = Array.isArray(promocao.variacoesSelecionadas) && promocao.variacoesSelecionadas.some((item) => String(item.id || item.variacao_id || item.variacaoId) === String(variation.id));
    return promocao.ativaAgora && (matchesProduct || matchesLegacy) && (promocao.aplicar_em_todas_variacoes || matchesVariation || matchesLegacyVariation);
  });
  if (!activePromocao) return null;
  const productLink = Array.isArray(activePromocao.produtos) ? activePromocao.produtos.find((item) => String(item.id) === String(product.id)) : null;
  const selectedVariation = productLink && Array.isArray(productLink.variacoes) ? productLink.variacoes.find((item) => String(item.variacao_id || item.variacaoId || item.id) === String(variation.id)) : (Array.isArray(activePromocao.variacoesSelecionadas) ? activePromocao.variacoesSelecionadas.find((item) => String(item.variacao_id || item.variacaoId || item.id) === String(variation.id)) : null);
  const percentual = selectedVariation?.percentual_desconto ?? productLink?.percentual_desconto ?? activePromocao.percentual_desconto;
  return calculatePrecoPromocional(getVariationBasePrice(variation, product), percentual);
}
function renderVariationImageCell(variation = {}, fallbackSrc = null) {
  const src = variation.imagemUrl || variation.imagem_url || variation.raw?.imagemUrl || variation.raw?.imagem_url || variation.raw?.imagemPrincipalUrl || variation.raw?.imagem_principal_url || fallbackSrc || null;
  return src ? `<img src="${src}" alt="Imagem da variação" class="nhpd-variation-image" />` : '<div class="nhpd-variation-image nhpd-variation-placeholder" aria-hidden="true"></div>';
}
const USAGE_STEP = 5;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export function renderProdutoDetailsPage(root, { apiClient, produtoId }) {
  const state = createProdutoDetailsState();

  function logPerf(label, startedAt) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const duration = Math.max(0, Math.round(now - startedAt));
    console.info(`[perf] ${label}`, `${duration}ms`);
  }

  async function loadFabricantes() {
    state.fabricantesLoading = true;
    state.fabricantesError = '';
    render();
    try {
      const response = await apiClient.get('/fabricantes', { status: 'ativo', limit: 100, page: 1 });
      state.fabricantes = Array.isArray(response?.items) ? response.items : [];
    } catch {
      state.fabricantes = [];
      state.fabricantesError = 'Não foi possível carregar as fábricas.';
    } finally {
      state.fabricantesLoading = false;
      render();
    }
  }

  async function loadCategorias() {
    try {
      const response = await apiClient.get('/produto-categorias', { status: 'ativo' });
      state.categorias = Array.isArray(response?.items) ? response.items : [];
    } catch {
      state.categorias = [];
    } finally {
      render();
    }
  }

  function injectStyles() {
    if (document.getElementById('nh-produto-details-style')) return;
    const style = document.createElement('style');
    style.id = 'nh-produto-details-style';
    style.textContent = `
    .nhpd-wrap{max-width:1280px;width:100%;margin:0 auto}.nhpd-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:20px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
    .nhpd-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:14px}.nhpd-title{font-size:30px;font-weight:700;letter-spacing:-.02em}.nhpd-sub{color:#61708f;font-size:14px;margin-top:6px}
    .nhpd-grid{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}.nhpd-card{border:1px solid #e5ecf8;border-radius:14px;padding:16px;background:#fff}
    .nhpd-left-col,.nhpd-right-col,.nhpd-variation-section{display:grid;gap:14px}.nhpd-variation-section{margin-top:2px}
    .nhpd-dl{display:grid;grid-template-columns:160px 1fr;gap:10px 12px;margin:0}.nhpd-dt{color:#5e6f93;font-weight:600}.nhpd-dd{margin:0}
    .nhpd-badge{display:inline-block;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700}.nhpd-badge.is-ok{background:#ecfdf3;color:#047857}.nhpd-badge.is-off{background:#fff7ed;color:#b45309}.nhpd-badge.is-unk{background:#eef2ff;color:#3730a3}
    .nhpd-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#fff;cursor:pointer}.nhpd-btn.primary{background:#1f56dc;color:#fff;border-color:#1f56dc}.nhpd-btn[disabled]{opacity:.6;cursor:not-allowed}
    .nhpd-state{padding:24px;text-align:center;color:#607091}.nhpd-field{display:grid;gap:6px;margin-bottom:10px}.nhpd-field input,.nhpd-field select,.nhpd-field textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nhpd-field textarea{height:90px;padding:10px;resize:vertical}
    .nhpd-fabricante{display:flex;align-items:center;gap:14px}.nhpd-fabricante-logo{width:78px;height:78px;border:1px solid #e5ecf8;border-radius:18px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8fbff;flex:0 0 auto}.nhpd-fabricante-logo img{width:100%;height:100%;object-fit:contain;padding:8px}.nhpd-fabricante-name{font-size:18px;font-weight:700;line-height:1.2}
    .nhpd-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.nhpd-section-head h3{margin:0;font-size:20px}.nhpd-collapse{width:36px;height:36px;border-radius:10px;border:1px solid #d4deee;background:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
    .nhpd-table-wrap{overflow:auto}.nhpd-table{width:100%;border-collapse:collapse;min-width:820px}.nhpd-table th,.nhpd-table td{padding:10px 12px;border-bottom:1px solid #edf2f8;text-align:left;vertical-align:top;font-size:13px}.nhpd-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#61708f;white-space:nowrap}.nhpd-table td{color:#1e2b44}.nhpd-table .is-center{text-align:center}
    .nhpd-footer{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px;color:#5e6f93;font-size:13px}
    .nhpd-stock{font-variant-numeric:tabular-nums;font-weight:700}
    .nhpd-usage-head{display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;margin-bottom:10px}.nhpd-filter{height:32px;border:1px solid #d4deee;border-radius:8px;padding:0 8px;background:#fff}
    .nhpd-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:10px}.nhpd-kpi div{border:1px solid #e5ecf8;border-radius:10px;padding:8px;font-size:12px;color:#61708f}.nhpd-kpi strong{display:block;font-size:16px;color:#0f172a}
    .nhpd-kpi small{display:block;margin-top:4px;font-size:11px}.nhpd-kpi small.positive{color:#047857}.nhpd-kpi small.negative{color:#b42318}.nhpd-kpi small.neutral,.nhpd-kpi small.new{color:#61708f}
    .nhpd-kpi-legend{display:flex;gap:8px;flex-wrap:wrap;margin:-2px 0 10px}.nhpd-kpi-legend span{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#61708f;border:1px solid #e5ecf8;border-radius:999px;padding:3px 8px;background:#f8fbff}
    .nhpd-kpi-dot{width:8px;height:8px;border-radius:999px;display:inline-block}.nhpd-kpi-dot.positive{background:#16a34a}.nhpd-kpi-dot.negative{background:#dc2626}.nhpd-kpi-dot.neutral{background:#64748b}.nhpd-kpi-dot.new{background:#2563eb}
    .nhpd-usage-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
    .nhpd-drill-message{font-size:12px;color:#1f56dc;margin-bottom:8px}
    .nhpd-chart-hit{cursor:pointer}.nhpd-chart-hit.active{fill:#1f56dc;opacity:.18}.nhpd-chart-hit{fill:transparent}
    .nhpd-chart-tip{font-size:12px;color:#334155;margin:-2px 0 8px}
    .nhpd-ferr{font-size:12px;color:#b42318}.nhpd-msg{padding:10px;border-radius:10px;font-size:13px;margin-bottom:10px;background:#ecfdf3;color:#047857}
    .nhpd-variation-image{width:60px;height:60px;object-fit:cover;border-radius:12px;border:1px solid #dbe4f2;background:#f8fbff}
    .nhpd-variation-placeholder{display:block;background:linear-gradient(135deg,#f8fbff,#eef4ff)}
    .nhpd-image-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .nhpd-product-image{width:100%;max-height:280px;object-fit:cover;border-radius:14px;border:1px solid #e5ecf8;background:#f8fbff}
    .nhpd-audit-issues{display:flex;flex-wrap:wrap;gap:6px}.nhpd-audit-issue{display:inline-flex;align-items:center;max-width:100%;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;line-height:1.2;white-space:normal;overflow:visible;word-break:break-word;background:#eff6ff;color:#1d4ed8}.nhpd-audit-issue.is-high{background:#fff1f2;color:#b42318}.nhpd-audit-issue.is-medium{background:#fff7ed;color:#c2410c}.nhpd-audit-issue.is-low{background:#eff6ff;color:#1d4ed8}
    @media (max-width:1024px){.nhpd-grid{grid-template-columns:1fr}.nhpd-title{font-size:24px}.nhpd-dl{grid-template-columns:1fr}.nhpd-kpi{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderEditForm() {
    return `<article class="nhpd-card"><h3>Resumo do Produto (Edição)</h3>
      ${state.feedbackMessage ? `<div class="nhpd-msg" role="status" aria-live="polite">${state.feedbackMessage}</div>` : ''}
      <label class="nhpd-field">Nome<input id="nhpd-nome" value="${state.form.nome || ''}" ${state.saving ? 'disabled' : ''}/>${state.fieldErrors.nome ? `<span class="nhpd-ferr">${state.fieldErrors.nome}</span>` : ''}</label>
      <label class="nhpd-field">SKU<input id="nhpd-sku" value="${state.form.sku || ''}" ${state.saving ? 'disabled' : ''}/></label>
      <label class="nhpd-field">Categoria<select id="nhpd-categoria_id" ${state.saving ? 'disabled' : ''}><option value="">Selecione...</option>${(state.categorias || []).map((cat) => `<option value="${cat.id}" ${String(state.form.categoria_id || '') === String(cat.id) ? 'selected' : ''}>${cat.parent_id ? `↳ ${cat.nome}` : cat.nome}</option>`).join('')}</select></label>
      <label class="nhpd-field">Fábrica<select id="nhpd-fabricante_id" ${state.saving ? 'disabled' : ''}><option value="">Sem fábrica vinculada</option>${(state.fabricantes || []).map((fab) => `<option value="${fab.id}" ${String(state.form.fabricante_id || '') === String(fab.id) ? 'selected' : ''}>${fab.nome || '-'}</option>`).join('')}</select>${state.fabricantesError ? `<span class="nhpd-ferr">${state.fabricantesError}</span>` : ''}</label>
      <label class="nhpd-field">Preço à vista<input id="nhpd-preco" value="${state.form.preco || ''}" ${state.saving ? 'disabled' : ''}/>${state.fieldErrors.preco ? `<span class="nhpd-ferr">${state.fieldErrors.preco}</span>` : ''}</label>
      <label class="nhpd-field">Múltiplo de venda<input id="nhpd-multiplo_venda" type="number" min="1" step="1" value="${state.form.multiplo_venda || '1'}" ${state.saving ? 'disabled' : ''}/><small>Quantidade obrigatória por variação/cor. Ex.: 3 = vender 3, 6, 9, 12...</small>${state.fieldErrors.multiplo_venda ? `<span class="nhpd-ferr">${state.fieldErrors.multiplo_venda}</span>` : ''}</label>
      <label class="nhpd-field">Preço promocional<input id="nhpd-preco_promocional" value="${state.form.preco_promocional || ''}" ${state.saving ? 'disabled' : ''}/></label>
      <label class="nhpd-field">ICMS %<input id="nhpd-icms_percentual" value="${state.form.icms_percentual || ''}" ${state.saving ? 'disabled' : ''}/></label>
      <label class="nhpd-field">Video URL<input id="nhpd-video_url" value="${state.form.video_url || ''}" ${state.saving ? 'disabled' : ''}/></label>
      <label class="nhpd-field">Status<select id="nhpd-status" ${state.saving ? 'disabled' : ''}><option value="ativo" ${state.form.status === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${state.form.status === 'inativo' ? 'selected' : ''}>inativo</option></select>${state.fieldErrors.status ? `<span class="nhpd-ferr">${state.fieldErrors.status}</span>` : ''}</label>
      <label class="nhpd-field">Descrição<textarea id="nhpd-descricao" ${state.saving ? 'disabled' : ''}>${state.form.descricao || ''}</textarea></label>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button id="nhpd-cancel-edit" class="nhpd-btn" aria-label="Cancelar edição do produto" ${state.saving ? 'disabled' : ''}>Cancelar</button><button id="nhpd-save-edit" class="nhpd-btn primary" aria-label="Salvar alterações do produto" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
    </article>`;
  }

  function renderContent() {
    if (state.loading) return '<section class="nhpd-panel nhp-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></section>';
    if (state.error) return '<section class="nhpd-panel nhpd-state" role="alert" aria-live="assertive">Não foi possível carregar o produto.<br/><br/><button id="nhpd-retry" class="nhpd-btn" aria-label="Tentar carregar o produto novamente">Tentar novamente</button></section>';
    if (state.notFound || !state.data?.id) return '<section class="nhpd-panel nhpd-state">Produto não encontrado.</section>';
    const d = state.data;
    const variations = Array.isArray(d.variacoes) ? d.variacoes : [];
    const promocoes = Array.isArray(state.promocoes) ? state.promocoes : [];
    const stockTotal = Number.isFinite(Number(d.estoqueTotalVariacoes)) ? Number(d.estoqueTotalVariacoes) : 0;
    const productFallbackImage = state.productImages?.find((image) => image?.principal)?.url || d.imagemUrl || d.imagem_url || null;
    const variationRows = variations.map((variation) => `<tr>
      <td>${renderVariationImageCell(variation, productFallbackImage)}</td>
      <td>${formatVariationField(variation.sku)}</td>
      <td>${formatVariationField(variation.cor)}</td>
      <td>${formatVariationField(variation.tamanho)}</td>
      <td class="nhpd-stock">${formatPtBrNumber(variation.estoque)}</td>
      <td>${variation.precoFormatado}${variation.precoPromocionalFormatado ? `<div class="nhpd-sub">Promo: ${variation.precoPromocionalFormatado}</div>` : ''}${getVariationPromoPrice(variation, d, promocoes) !== null ? `<div class="nhpd-sub">Preço promo. ${brl(getVariationPromoPrice(variation, d, promocoes))}</div>` : ''}</td>
      <td><span class="nhpd-badge ${statusClass(variation.status)}">${normalizeStatusLabel(variation.status, variation.ativo)}</span></td>
      <td><div class="nhpd-image-picker"><input type="file" id="nhpd-file-${variation.id}" accept="image/jpeg,image/png,image/webp" ${state.saving ? 'disabled' : ''}/><button class="nhpd-btn primary js-variation-image-upload" data-variacao-id="${variation.id}" ${state.saving ? 'disabled' : ''}>Alterar Imagem</button></div></td>
    </tr>`).join('');
    return `<section class="nhpd-panel">
      <div class="nhpd-head">
        <div><div class="nhpd-title">${d.nomeExibicao}</div><div class="nhpd-sub">${d.categoria}</div><div style="margin-top:10px"><span class="nhpd-badge ${statusClass(d.status)}">${d.status}</span></div></div>
        <div style="display:flex;gap:8px"><button id="nhpd-back" class="nhpd-btn" aria-label="Voltar para lista de produtos">Voltar</button><button id="nhpd-edit" class="nhpd-btn primary" aria-label="Editar Produto" ${state.saving ? 'disabled' : ''}>Editar Produto</button></div>
      </div>
      <div class="nhpd-grid">
        <div class="nhpd-left-col">
          ${state.editing ? renderEditForm() : `<article class="nhpd-card"><h3>Resumo do Produto</h3><dl class="nhpd-dl"><dt class="nhpd-dt">Nome</dt><dd class="nhpd-dd">${d.nomeExibicao}</dd><dt class="nhpd-dt">SKU</dt><dd class="nhpd-dd">${d.sku}</dd><dt class="nhpd-dt">Categoria</dt><dd class="nhpd-dd">${d.categoria}</dd><dt class="nhpd-dt">Status</dt><dd class="nhpd-dd">${d.status}</dd>${d.descricao ? `<dt class="nhpd-dt">Descrição</dt><dd class="nhpd-dd">${d.descricao}</dd>` : ''}<dt class="nhpd-dt">Estoque total (todas as variações)</dt><dd class="nhpd-dd">${formatPtBrNumber(stockTotal)}</dd></dl></article>`}
          <article class="nhpd-card"><h3>Preço e Comercial</h3><dl class="nhpd-dl"><dt class="nhpd-dt">Preço atual</dt><dd class="nhpd-dd">${d.precoFormatado}</dd><dt class="nhpd-dt">Múltiplo de venda</dt><dd class="nhpd-dd">${Number.isFinite(Number(d.multiploVenda)) ? `${Number(d.multiploVenda)} ${Number(d.multiploVenda) === 1 ? 'unidade por variação' : 'unidades por variação'}` : '1 unidade por variação'}</dd><dt class="nhpd-dt">Status comercial</dt><dd class="nhpd-dd">${d.status}</dd></dl></article>
        </div>
        <div class="nhpd-right-col">
          <article class="nhpd-card"><h3>Fábrica vinculada</h3>${d.fabricanteId ? `<div class="nhpd-fabricante">${d.fabricanteLogoUrl ? `<div class="nhpd-fabricante-logo"><img src="${d.fabricanteLogoUrl}" alt="Logo da fábrica"/></div>` : '<div class="nhpd-fabricante-logo" aria-hidden="true"></div>'}<div class="nhpd-fabricante-name">${d.fabricanteNome || 'Sem nome'}</div></div>` : '<div class="nhpd-state">Sem fábrica vinculada.</div>'}</article>
          <article class="nhpd-card"><h3>Promoções</h3>${renderPromocoesCard(d, promocoes)}</article>
          <article class="nhpd-card"><h3>Imagem do Produto</h3>${renderProductImageBlock(d)}</article>
        </div>
        <article class="nhpd-card" style="grid-column:1 / -1"><h3>Pendências de Auditoria</h3>${renderAuditIssuesBlock()}</article>
        <article class="nhpd-card" style="grid-column:1 / -1"><h3>Uso em Pedidos / Histórico comercial</h3>${renderUsageBlock()}</article>
        <article class="nhpd-card nhpd-variation-section" style="grid-column:1 / -1">
          <div class="nhpd-section-head">
            <h3>Variações do Produto</h3>
            <button id="nhpd-variations-toggle" class="nhpd-collapse" aria-label="${state.variationsExpanded ? 'Recolher variações do produto' : 'Expandir variações do produto'}" aria-expanded="${state.variationsExpanded ? 'true' : 'false'}">${state.variationsExpanded ? '▾' : '▸'}</button>
          </div>
          ${state.variationsExpanded ? `<div class="nhpd-table-wrap">${variations.length ? `<table class="nhpd-table"><thead><tr><th>Imagem</th><th>SKU Variação</th><th>Cor</th><th>Grade</th><th>Estoque</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead><tbody>${variationRows}</tbody></table>` : '<div class="nhpd-state">Nenhuma variação cadastrada.</div>'}<div class="nhpd-footer"><div>Total de variações: ${variations.length}</div></div></div>` : `<div class="nhpd-footer"><div>Total de variações: ${variations.length}</div></div>`}
        </article>
      </div>
    </section>`;
  }

  function renderPromocoesCard(product, promocoes) {
    if (!promocoes.length) return '<div class="nhpd-state">Sem promoções cadastradas.</div>';
    const base = Number(product.preco || 0);
    return `<div class="nhpd-table-wrap"><table class="nhpd-table"><thead><tr><th>Nome</th><th>Desconto</th><th>Período</th><th>Status</th><th>Preço original</th><th>Preço promocional</th></tr></thead><tbody>${promocoes.map((p) => `<tr><td>${p.nome}</td><td>${p.percentual_desconto}%</td><td>${p.data_inicio} a ${p.data_fim}</td><td>${p.ativaAgora ? 'Ativa' : p.status}</td><td>${brl(base)}</td><td>${brl(calculatePrecoPromocional(base, p.percentual_desconto))}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderProductImageBlock(product) {
    const primary = state.productImages?.find((image) => image?.principal) || state.productImages?.[0] || null;
    const primaryUrl = primary?.url || product.imagemUrl || product.imagem_url || null;
    return `<div style="display:grid;gap:10px"><div>${primaryUrl ? `<img src="${primaryUrl}" alt="Imagem principal do produto" class="nhpd-product-image" />` : '<div class="nhpd-state">Sem imagem cadastrada.</div>'}</div><div class="nhpd-image-picker"><input type="file" id="nhpd-product-file" accept="image/jpeg,image/png,image/webp" ${state.saving ? 'disabled' : ''}/><button class="nhpd-btn primary js-product-image-upload" ${state.saving ? 'disabled' : ''}>Alterar Imagem do Produto</button></div><div class="nhpd-sub">Imagem exclusiva do produto pai. Não é preenchida a partir de variações.</div></div>`;
  }

  function renderAuditIssuesBlock() {
    const issues = Array.isArray(state.auditIssues) ? state.auditIssues : [];
    if (!issues.length) return '<div class="nhpd-state">Sem pendências de auditoria.</div>';
    return `<div class="nhpd-audit-issues">${issues.map((issue) => {
      const tooltip = getProductAuditIssueTooltip(issue);
      const label = getProductAuditIssueLabel(issue);
      const severity = ['duplicate_sku', 'missing_factory', 'missing_fabricante', 'missing_variation', 'missing_variations'].includes(issue) ? 'high' : ['invalid_price', 'zero_stock', 'estoque_zerado'].includes(issue) ? 'medium' : 'low';
      return `<span class="nhpd-audit-issue is-${severity}" title="${tooltip}" aria-label="${tooltip}">${label}</span>`;
    }).join(' ')}</div>`;
  }

  function renderUsageBlock() {
    if (state.usageLoading) return '<div class="nhp-loading"><div class="s"></div><div class="s"></div><div class="s"></div></div>';
    if (state.usageError) return '<div class="nhpd-state" role="alert" aria-live="assertive">Não foi possível carregar o uso comercial do produto.<br/><br/><button id="nhpd-usage-retry" class="nhpd-btn" aria-label="Tentar carregar o uso comercial novamente">Tentar novamente</button></div>';
    if (!state.usage || !Array.isArray(state.usage.allPedidos) || !state.usage.allPedidos.length) return '<p class="nhpd-state">Este produto ainda não aparece em pedidos.</p>';
    const u = applyProdutoUsageFilters(state.usage, state.usageFilters);
    const drilledRows = applyProdutoUsageDrillDown(u.pedidosRecentes || [], state.usageDrillDown, u.agrupamentoTemporal);
    const visibleRows = drilledRows.slice(0, state.usageVisibleCount);
    const rows = visibleRows.map((p) => `<tr><td><a href="#/pedidos/${p.id}">${p.numero}</a></td><td>${p.clienteNome}</td><td>${p.status}</td><td>${p.quantidade}</td><td>${brl(p.totalItem)}</td><td>${p.criadoEmFormatado}</td></tr>`).join('');
    const maxFat = Math.max(...(u.serieTemporal || []).map((i) => Number(i.faturamento || 0)), 0);
    const points = (u.serieTemporal || []).map((item, idx, arr) => {
      const x = arr.length <= 1 ? 8 : 8 + ((idx * 184) / (arr.length - 1));
      const y = 48 - ((Number(item.faturamento || 0) / (maxFat || 1)) * 40);
      return `${x},${y}`;
    }).join(' ');
    const chartWidth = 184;
    const chartHits = (u.serieTemporal || []).map((item, idx, arr) => {
      const x = arr.length <= 1 ? 8 : 8 + ((idx * chartWidth) / (arr.length - 1));
      const isActive = state.usageDrillDown?.key && state.usageDrillDown.key === item.key;
      const pedidos = applyProdutoUsageDrillDown(u.pedidosRecentes || [], { key: item.key }, u.agrupamentoTemporal).length;
      return `<rect class="nhpd-chart-hit ${isActive ? 'active' : ''}" tabindex="0" role="button" aria-label="Drill-down de ${item.label}" data-chart-key="${item.key}" data-chart-label="${item.label}" data-chart-quantidade="${item.quantidade}" data-chart-faturamento="${item.faturamento}" data-chart-pedidos="${pedidos}" x="${Math.max(0, x - 6)}" y="2" width="12" height="52" rx="4"></rect>`;
    }).join('');
    const labels = (u.serieTemporal || []).slice(-4).map((item) => `<span>${item.label}</span>`).join('');
    const hasFilteredRows = drilledRows.length > 0;
    const comp = u.comparison || {};
    const compText = (metric) => comp.enabled ? `<small class="${metric?.kind || 'neutral'}">${metric?.text || 'Sem variação'}</small>` : `<small class="neutral">${comp.message || ''}</small>`;
    return `<div class="nhpd-usage-head"><strong>Visão Comercial</strong><div style="display:flex;gap:6px;flex-wrap:wrap"><button id="nhpd-usage-export-lista" class="nhpd-btn" aria-label="Exportar CSV da lista atual">Exportar CSV da lista atual</button><button id="nhpd-usage-export-periodo" class="nhpd-btn" aria-label="Exportar CSV do período filtrado">Exportar CSV do período filtrado</button><select id="nhpd-usage-period" class="nhpd-filter"><option value="7d" ${state.usageFilters.period === '7d' ? 'selected' : ''}>últimos 7 dias</option><option value="30d" ${state.usageFilters.period === '30d' ? 'selected' : ''}>últimos 30 dias</option><option value="90d" ${state.usageFilters.period === '90d' ? 'selected' : ''}>últimos 90 dias</option><option value="todos" ${state.usageFilters.period === 'todos' ? 'selected' : ''}>todos</option></select><select id="nhpd-usage-status" class="nhpd-filter"><option value="todos" ${state.usageFilters.status === 'todos' ? 'selected' : ''}>todos</option><option value="rascunho" ${state.usageFilters.status === 'rascunho' ? 'selected' : ''}>rascunho</option><option value="aprovado" ${state.usageFilters.status === 'aprovado' ? 'selected' : ''}>aprovado</option><option value="confirmado" ${state.usageFilters.status === 'confirmado' ? 'selected' : ''}>confirmado</option><option value="faturado" ${state.usageFilters.status === 'faturado' ? 'selected' : ''}>faturado</option><option value="cancelado" ${state.usageFilters.status === 'cancelado' ? 'selected' : ''}>cancelado</option></select></div></div>
    <div class="nhpd-kpi"><div><strong>${u.totalPedidos}</strong>Pedidos com produto${compText(comp.totalPedidos)}</div><div><strong>${u.quantidadeVendida}</strong>Quantidade vendida${compText(comp.quantidadeVendida)}</div><div><strong>${brl(u.faturamentoTotal)}</strong>Faturamento${compText(comp.faturamento)}</div><div><strong>${brl(u.ticketMedioProduto)}</strong>Ticket médio${compText(comp.ticketMedioProduto)}</div><div><strong>${u.ultimaVendaFormatada}</strong>Última venda</div></div>
    <div class="nhpd-kpi-legend" aria-label="Legenda de tendência dos indicadores">
      <span><i class="nhpd-kpi-dot positive"></i>alta</span>
      <span><i class="nhpd-kpi-dot negative"></i>queda</span>
      <span><i class="nhpd-kpi-dot neutral"></i>estável</span>
      <span><i class="nhpd-kpi-dot new"></i>novo movimento</span>
    </div>
    ${u.serieTemporal?.length ? `<div style="border:1px solid #e5ecf8;border-radius:10px;padding:8px;margin-bottom:10px"><svg width="100%" viewBox="0 0 200 56" preserveAspectRatio="none">${chartHits}<polyline fill="none" stroke="#1f56dc" stroke-width="2" points="${points}"/></svg><div style="display:flex;justify-content:space-between;font-size:11px;color:#61708f">${labels}</div></div>` : ''}
    <div id="nhpd-chart-tooltip" class="nhpd-chart-tip" aria-live="polite"></div>
    ${state.usageDrillDown ? `<div class="nhpd-drill-message">Exibindo pedidos de ${state.usageDrillDown.label}. <button id="nhpd-drill-clear" class="nhpd-btn" aria-label="Limpar seleção do drill-down" style="height:28px">Limpar seleção do drill-down</button></div>` : ''}
    ${hasFilteredRows ? `<div style="overflow:auto"><table class="nhp-table"><tr><th>Pedido</th><th>Cliente</th><th>Status</th><th>Quantidade</th><th>Valor do item</th><th>Data</th></tr>${rows}</table></div><div class="nhpd-usage-actions">${drilledRows.length > state.usageVisibleCount ? '<button id="nhpd-usage-more" class="nhpd-btn">Ver mais</button>' : ''}${state.usageVisibleCount > USAGE_STEP ? '<button id="nhpd-usage-less" class="nhpd-btn">Ver menos</button>' : ''}</div>` : '<p class="nhpd-state">Nenhum pedido encontrado para o período selecionado no gráfico.</p>'}`;
  }

  function bindEditHandlers() {
    const fields = ['nome', 'sku', 'preco', 'multiplo_venda', 'preco_promocional', 'icms_percentual', 'video_url', 'descricao'];
    fields.forEach((field) => {
      const el = root.querySelector(`#nhpd-${field}`);
      if (el) el.oninput = (e) => { state.form[field] = e.target.value || ''; };
    });
    const status = root.querySelector('#nhpd-status');
    if (status) status.onchange = (e) => { state.form.status = e.target.value || 'ativo'; };
    const categoria = root.querySelector('#nhpd-categoria_id');
    if (categoria) categoria.onchange = (e) => { state.form.categoria_id = e.target.value || ''; };
    const fabricante = root.querySelector('#nhpd-fabricante_id');
    if (fabricante) fabricante.onchange = (e) => { state.form.fabricante_id = e.target.value || ''; };

    const cancel = root.querySelector('#nhpd-cancel-edit');
    if (cancel) cancel.onclick = () => { state.editing = false; state.form = createProdutoEditForm(state.data); state.fieldErrors = {}; state.feedbackMessage = ''; render(); };

    const save = root.querySelector('#nhpd-save-edit');
    if (save) save.onclick = async () => {
      if (state.saving) return;
      state.fieldErrors = validateProdutoEditForm(state.form);
      if (Object.keys(state.fieldErrors).length) { render(); return; }
      state.saving = true; render();
      try {
        await updateProduto(apiClient, produtoId, state.form);
        state.editing = false;
        await refreshPostSave('Produto atualizado com sucesso.');
      } catch (error) {
        state.error = error?.body?.error?.message || error?.message || 'Não foi possível atualizar o produto.';
      } finally {
        state.saving = false;
        render();
      }
    };
  }

  function render() {
    injectStyles();
    root.innerHTML = `<div class="nhpd-wrap">${renderContent()}</div>`;
    const retry = root.querySelector('#nhpd-retry');
    if (retry) retry.onclick = () => load();
    const back = root.querySelector('#nhpd-back');
    if (back) back.onclick = () => { window.location.hash = '#/produtos'; };
    const edit = root.querySelector('#nhpd-edit');
    if (edit) edit.onclick = () => { state.editing = true; state.fieldErrors = {}; state.feedbackMessage = ''; state.form = createProdutoEditForm(state.data); render(); };
    const variationsToggle = root.querySelector('#nhpd-variations-toggle');
    if (variationsToggle) variationsToggle.onclick = () => { state.variationsExpanded = !state.variationsExpanded; render(); };
    const usageRetry = root.querySelector('#nhpd-usage-retry');
    if (usageRetry) usageRetry.onclick = () => loadUsage();
    const usagePeriod = root.querySelector('#nhpd-usage-period');
    if (usagePeriod) usagePeriod.onchange = (e) => { state.usageFilters.period = e.target.value || 'todos'; state.usageVisibleCount = USAGE_STEP; render(); };
    const usageStatus = root.querySelector('#nhpd-usage-status');
    if (usageStatus) usageStatus.onchange = (e) => { state.usageFilters.status = e.target.value || 'todos'; state.usageVisibleCount = USAGE_STEP; state.usageDrillDown = null; render(); };
    const usageMore = root.querySelector('#nhpd-usage-more');
    if (usageMore) usageMore.onclick = () => { state.usageVisibleCount += USAGE_STEP; render(); };
    const usageLess = root.querySelector('#nhpd-usage-less');
    if (usageLess) usageLess.onclick = () => { state.usageVisibleCount = USAGE_STEP; render(); };
    root.querySelectorAll('.js-variation-image-upload').forEach((btn) => btn.onclick = async () => {
      const variacaoId = btn.dataset.variacaoId;
      const file = root.querySelector(`#nhpd-file-${variacaoId}`)?.files?.[0];
      if (!file || !variacaoId) return;
      if (file.size > MAX_IMAGE_BYTES) {
        state.feedbackMessage = 'A imagem ultrapassa o limite de 25MB.';
        render();
        return;
      }
      state.saving = true;
      state.feedbackMessage = '';
      render();
      try {
        const formData = new FormData();
        formData.append('upload', file, file.name);
        await uploadProdutoVariacaoImagem(apiClient, variacaoId, formData);
        await refreshPostSave('Imagem da variação atualizada com sucesso.');
      } catch (error) {
        const code = error?.body?.error?.code || error?.code;
        state.feedbackMessage = code === 'PAYLOAD_TOO_LARGE' ? 'A imagem ultrapassa o limite de 25MB.' : error?.body?.error?.message || error?.message || 'Não foi possível enviar a imagem.';
      } finally {
        state.saving = false;
        render();
      }
    });
    root.querySelectorAll('.js-product-image-upload').forEach((btn) => btn.onclick = async () => {
      const file = root.querySelector('#nhpd-product-file')?.files?.[0];
      if (!file) return;
      if (file.size > MAX_IMAGE_BYTES) {
        state.feedbackMessage = 'A imagem ultrapassa o limite de 25MB.';
        render();
        return;
      }
      state.saving = true;
      state.feedbackMessage = '';
      render();
      try {
        const formData = new FormData();
        formData.append('upload', file, file.name);
        formData.append('principal', 'true');
        await uploadProdutoImagem(apiClient, produtoId, formData);
        await refreshPostSave('Imagem do produto atualizada com sucesso.');
      } catch (error) {
        const code = error?.body?.error?.code || error?.code;
        state.feedbackMessage = code === 'PAYLOAD_TOO_LARGE' ? 'A imagem ultrapassa o limite de 25MB.' : error?.body?.error?.message || error?.message || 'Não foi possível enviar a imagem.';
      } finally {
        state.saving = false;
        render();
      }
    });
    function exportUsageCsv(mode) {
      const u = applyProdutoUsageFilters(state.usage, state.usageFilters);
      const baseRows = applyProdutoUsageDrillDown(u.pedidosRecentes || [], state.usageDrillDown, u.agrupamentoTemporal);
      const rows = mode === 'periodo' ? baseRows : baseRows.slice(0, state.usageVisibleCount);
      const csv = mapProdutoUsageCsvContent(mapProdutoUsageCsvRows(rows));
      const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mapProdutoUsageCsvFilename(state.data, mode);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
    const usageExportLista = root.querySelector('#nhpd-usage-export-lista');
    if (usageExportLista) usageExportLista.onclick = () => exportUsageCsv('lista');
    const usageExportPeriodo = root.querySelector('#nhpd-usage-export-periodo');
    if (usageExportPeriodo) usageExportPeriodo.onclick = () => exportUsageCsv('periodo');
    const drillClear = root.querySelector('#nhpd-drill-clear');
    if (drillClear) drillClear.onclick = () => { state.usageDrillDown = null; state.usageVisibleCount = USAGE_STEP; render(); };
    const chartHits = root.querySelectorAll('.nhpd-chart-hit');
    const chartTooltip = root.querySelector('#nhpd-chart-tooltip');
    function showTooltip(hit) {
      if (!chartTooltip || !hit) return;
      const label = hit.getAttribute('data-chart-label') || '-';
      const quantidade = Number(hit.getAttribute('data-chart-quantidade') || 0);
      const faturamento = Number(hit.getAttribute('data-chart-faturamento') || 0);
      const pedidos = Number(hit.getAttribute('data-chart-pedidos') || 0);
      chartTooltip.textContent = `${label} • Qtd: ${quantidade} • Faturamento: ${brl(faturamento)} • Pedidos: ${pedidos}`;
    }
    function clearTooltip() {
      if (chartTooltip) chartTooltip.textContent = '';
    }
    chartHits.forEach((hit) => {
      hit.addEventListener('mouseenter', () => showTooltip(hit));
      hit.addEventListener('focus', () => showTooltip(hit));
      hit.addEventListener('mouseleave', clearTooltip);
      hit.addEventListener('blur', clearTooltip);
      hit.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          hit.dispatchEvent(new Event('click', { bubbles: true }));
        }
      });
      hit.addEventListener('click', () => {
        const key = hit.getAttribute('data-chart-key');
        const label = hit.getAttribute('data-chart-label');
        if (!key || !label) return;
        state.usageDrillDown = (state.usageDrillDown?.key === key) ? null : { key, label };
        state.usageVisibleCount = USAGE_STEP;
        render();
      });
    });
    if (state.editing) bindEditHandlers();
  }

  async function load(options = {}) {
    state.loading = true; state.error = false; state.notFound = false;
    if (!options.preserveMessages) state.feedbackMessage = '';
    render();
    try {
      const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
      console.info('[perf] product_details_load_started', { produtoId });
      const detailsPromise = fetchProdutoDetailsData(apiClient, produtoId);
      const auditPromise = apiClient.get(`/product-audit/products/${produtoId}`).catch(() => null);
      const imagesPromise = fetchProdutoImagens(apiClient, produtoId).catch(() => []);
      const promocoesPromise = fetchProdutoPromocoesData(apiClient, produtoId).catch(() => ({ items: [] }));
      const [details, audit, images, promocoes] = await Promise.allSettled([detailsPromise, auditPromise, imagesPromise, promocoesPromise]);
      state.data = details.status === 'fulfilled' ? details.value : null;
      state.auditIssues = audit.status === 'fulfilled' && Array.isArray(audit.value?.issues) ? audit.value.issues : [];
      state.productImages = images.status === 'fulfilled' ? images.value : [];
      state.promocoes = promocoes.status === 'fulfilled' ? (promocoes.value?.items || []) : [];
      state.form = createProdutoEditForm(state.data);
      if (!state?.data?.id) state.notFound = true;
      if (options.feedbackMessage) state.feedbackMessage = options.feedbackMessage;
      logPerf('product_details_fetch_produto_ms', started);
      if (audit.status === 'fulfilled') logPerf('product_details_fetch_audit_ms', started);
      if (images.status === 'fulfilled') logPerf('product_details_fetch_imagens_ms', started);
      loadFabricantes();
      loadCategorias();
      loadUsage();
    } catch (error) {
      if (error?.status === 404) state.notFound = true;
      else state.error = true;
    } finally {
      state.loading = false;
      console.info('[perf] product_details_load_finished', { produtoId });
      render();
    }
  }

  async function loadUsage() {
    state.usageLoading = true; state.usageError = false; render();
    try { state.usage = await fetchProdutoUsageDataWithMetrics(apiClient, produtoId); state.usageDrillDown = null; }
    catch { state.usageError = true; }
    finally { state.usageLoading = false; render(); }
  }

  async function refreshPostSave(message) {
    const previousData = state.data;
    const [details, audit, images] = await Promise.allSettled([
      fetchProdutoDetailsData(apiClient, produtoId),
      apiClient.get(`/product-audit/products/${produtoId}`).catch(() => null),
      fetchProdutoImagens(apiClient, produtoId).catch(() => [])
    ]);
    if (details.status === 'fulfilled') {
      const nextData = details.value || {};
      const previousVariations = Array.isArray(previousData?.variacoes) ? previousData.variacoes : [];
      const nextVariations = Array.isArray(nextData.variacoes) ? nextData.variacoes : [];
      state.data = (!nextVariations.length && previousVariations.length)
        ? { ...nextData, variacoes: previousVariations, estoqueTotalVariacoes: previousData.estoqueTotalVariacoes }
        : nextData;
      state.form = createProdutoEditForm(state.data);
    }
    if (audit.status === 'fulfilled' && Array.isArray(audit.value?.issues)) state.auditIssues = audit.value.issues;
    if (images.status === 'fulfilled') state.productImages = images.value;
    if (message) state.feedbackMessage = message;
    render();
  }

  render();
  load();
}
