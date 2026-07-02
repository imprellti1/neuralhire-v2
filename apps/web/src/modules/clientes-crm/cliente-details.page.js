import { createClienteDetailsState } from './cliente-details.state.js';
import { atualizarCliente, calcularScoreCliente, calcularSegmentacaoCliente, discoverClienteWebsite, fetchAlertasCliente, fetchClienteDetailsData, fetchPedidoDetailsForCliente, fetchWhatsappConversationMessagesCliente, fetchWhatsappConversationsCliente, gerarAlertasCliente, geolocalizarCliente, resolverAlertaCliente, sincronizarCliente360 } from './cliente-details.service.js';
import { fetchClienteTimeline } from './cliente-timeline.service.js';
import { formatCnpj } from '../../utils/br-formatters.js';

function fmtCurrency(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(v) {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}
function fmtDateTime(v) {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('pt-BR');
}
function fmtDateOnlyUTC(v) {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime())
    ? '-'
    : new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}
function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'aprovado') return 'is-approved';
  if (s === 'confirmado') return 'is-confirmed';
  if (s === 'faturado') return 'is-billed';
  if (s === 'cancelado') return 'is-canceled';
  return 'is-draft';
}
function safeText(value, fallback = '-') {
  const text = String(value || '').trim();
  return text || fallback;
}
function formatDisplayDate(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}
function formatDisplayDateTime(value) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  const datePart = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  const timePart = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${datePart} às ${timePart}`;
}
function getPedidoDate(pedido = {}) {
  return pedido.dataFaturamento || pedido.dataFallback || pedido._billingDate || pedido._fallbackDate || null;
}
function itemStatusLabel(item = {}) {
  return item?.status_vinculo || item?.vinculo || item?.status || '';
}
function fmtGroupDate(value) {
  return fmtDateOnlyUTC(value);
}
function calcularTotalItem(item = {}) {
  const total = Number(item?.valor_total || item?.total || 0);
  if (total > 0) return total;

  const quantidade = Number(item?.quantidade || 0);
  const unitario = Number(item?.valor_unitario || item?.valorUnitario || item?.preco_unitario || item?.preco || 0);

  return quantidade * unitario;
}
function calcularValorPedido(pedido = {}) {
  const valorPedido = Number(pedido?.valor_total || pedido?.valor || pedido?.total || 0);
  if (valorPedido > 0) return valorPedido;

  const itens = Array.isArray(pedido?.itens) ? pedido.itens : [];
  return itens.reduce((soma, item) => soma + calcularTotalItem(item), 0);
}
function agruparItensPorProduto(itens = []) {
  const grupos = new Map();

  itens.forEach((item) => {
    const produtoNome =
      item?.produto_nome ||
      item?.nome_produto_original ||
      item?.descricao ||
      item?.produto ||
      'Produto sem nome';

    const chave = item?.produto_id || produtoNome;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        produtoNome,
        quantidadeTotal: 0,
        valorTotal: 0,
        variacoes: [],
      });
    }

    const grupo = grupos.get(chave);
    const quantidade = Number(item?.quantidade || 0);
    const total = calcularTotalItem(item);

    grupo.quantidadeTotal += quantidade;
    grupo.valorTotal += total;

    grupo.variacoes.push({
      ...item,
      quantidade,
      valor_total_calculado: total,
    });
  });

  return Array.from(grupos.values());
}
function getProdutoResumo(item = {}) {
  return [
    item?.codigo_produto_erp_original,
    item?.cor_original,
    item?.tamanho_original,
    item?.ean_original,
    itemStatusLabel(item)
  ].filter(Boolean).join(' • ');
}

function normalizeLinks(value = []) {
  return (Array.isArray(value) ? value : [value]).map((item) => String(item || '').trim()).filter(Boolean);
}
function normalizePriceRanges(value = []) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    category: String(item?.category || '').trim(),
    min_price: Number.isFinite(Number(item?.min_price)) ? Number(item.min_price) : null,
    max_price: Number.isFinite(Number(item?.max_price)) ? Number(item.max_price) : null,
    avg_price: Number.isFinite(Number(item?.avg_price)) ? Number(item.avg_price) : null,
    sample_count: Number.isFinite(Number(item?.sample_count)) ? Number(item.sample_count) : 0
  })).filter((item) => item.category);
}
function normalizeProducts(value = []) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    name: String(item?.name || '').trim(),
    brand: String(item?.brand || '').trim(),
    category: String(item?.category || '').trim() || 'Geral',
    price: Number.isFinite(Number(item?.price)) ? Number(item.price) : null,
    url: String(item?.url || '').trim(),
    image: String(item?.image || '').trim(),
    availability: String(item?.availability || '').trim()
  })).filter((item) => item.name || item.brand || item.price !== null);
}
function normalizeStatistics(value = {}) {
  return {
    products_count: Number.isFinite(Number(value?.products_count)) ? Number(value.products_count) : 0,
    categories_count: Number.isFinite(Number(value?.categories_count)) ? Number(value.categories_count) : 0,
    brands_count: Number.isFinite(Number(value?.brands_count)) ? Number(value.brands_count) : 0,
    average_price: Number.isFinite(Number(value?.average_price)) ? Number(value.average_price) : null,
    min_price: Number.isFinite(Number(value?.min_price)) ? Number(value.min_price) : null,
    max_price: Number.isFinite(Number(value?.max_price)) ? Number(value.max_price) : null
  };
}
function extractCommercialProfile(enrichment = {}) {
  const company = enrichment?.company || {};
  const commercialProfile = enrichment?.commercial_profile || {};
  const commercialIntelligence = enrichment?.commercial_intelligence || {};
  const legacyCategories = Array.isArray(company.categories) ? company.categories : [];
  const legacyBrands = Array.isArray(company.brands) ? company.brands : [];
  return {
    ecommerce: {
      categories: normalizeLinks(commercialProfile?.ecommerce?.categories?.length ? commercialProfile.ecommerce.categories : legacyCategories),
      brands: normalizeLinks(commercialProfile?.ecommerce?.brands?.length ? commercialProfile.ecommerce.brands : legacyBrands),
      products: normalizeProducts(commercialProfile?.ecommerce?.products),
      price_ranges_by_category: normalizePriceRanges(commercialProfile?.ecommerce?.price_ranges_by_category),
      statistics: normalizeStatistics(commercialProfile?.ecommerce?.statistics),
      insights: normalizeLinks(commercialProfile?.ecommerce?.insights)
    },
    instagram: {
      categories: normalizeLinks(commercialProfile?.instagram?.categories),
      brands: normalizeLinks(commercialProfile?.instagram?.brands),
      hashtags: normalizeLinks(commercialProfile?.instagram?.hashtags),
      products: normalizeProducts(commercialProfile?.instagram?.products),
      price_ranges_by_category: normalizePriceRanges(commercialProfile?.instagram?.price_ranges_by_category),
      statistics: normalizeStatistics(commercialProfile?.instagram?.statistics),
      insights: normalizeLinks(commercialProfile?.instagram?.insights)
    },
    commercial_intelligence: {
      positioning: commercialIntelligence?.positioning || {},
      catalog: commercialIntelligence?.catalog || {},
      pricing: commercialIntelligence?.pricing || {},
      strengths: normalizeLinks(commercialIntelligence?.strengths),
      opportunities: normalizeLinks(commercialIntelligence?.opportunities)
    }
  };
}
function formatPriceRange(item = {}) {
  const min = Number.isFinite(Number(item.min_price)) ? Number(item.min_price) : null;
  const max = Number.isFinite(Number(item.max_price)) ? Number(item.max_price) : null;
  const avg = Number.isFinite(Number(item.avg_price)) ? Number(item.avg_price) : null;
  const fmt = (value) => (value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  return `${item.category}: ${fmt(min)} ${max !== null && max !== min ? `até ${fmt(max)}` : ''}${avg !== null ? ` | média ${fmt(avg)}` : ''} (${Number(item.sample_count || 0)})`.trim();
}

function inferEcommercePresence(commercial = {}) {
  if (commercial.has_ecommerce) return true;
  const textSources = normalizeLinks([
    commercial.has_catalog ? 'catalogo produtos' : '',
    ...(commercial.product_links || []),
    ...(commercial.marketplaces || [])
  ]).join(' ').toLowerCase();
  const evidence = [
    /shopping_cart|cart|carrinho/i,
    /checkout|finalizar compra|finalizar pedido/i,
    /comprar|buy|adicionar ao carrinho|adicionar no carrinho/i,
    /à vista|a vista|em até|em ate|parcelamento|parcelar/i,
    /\bpreço\b|\bpreco\b|\bvalor\b/i,
    /produto|produtos|product/i
  ];
  return evidence.some((pattern) => pattern.test(textSources));
}

function hasAnyDigitalInsight(enrichment = {}) {
  const contacts = enrichment.contacts || {};
  const social = enrichment.social || {};
  const commercial = enrichment.commercial || {};
  return Boolean(
    normalizeLinks(contacts.emails).length ||
    normalizeLinks(contacts.phones).length ||
    normalizeLinks(contacts.whatsapp).length ||
    normalizeLinks(social.instagram).length ||
    normalizeLinks(social.facebook).length ||
    normalizeLinks(social.linkedin).length ||
    normalizeLinks(social.youtube).length ||
    normalizeLinks(social.tiktok).length ||
    commercial.has_ecommerce ||
    commercial.has_catalog
  );
}

export function renderClienteDetailsPage(root, { apiClient, clienteId }) {
  const state = createClienteDetailsState();
  let activeTab = 'dados-relevantes';
  let enrichmentLoading = false;
  let geolocationLoading = false;
  let scoreLoading = false;
  let alertsLoading = false;
  let alertasLoading = false;
  let alertMessage = '';
  let feedbackMessage = '';
  let whatsappLoading = false;
  let whatsappMessagesLoading = false;
  let whatsappActiveConversationId = null;
  let syncLoading = false;
  let syncMessage = '';
  let webDiscoveryLoading = false;
  let webDiscoveryMessage = '';
  let editMode = false;
  let editSaving = false;
  let editErrorMessage = '';
  let editForm = null;
  let summaryExpanded = false;
  const groupAccordionState = new Map();
  const pedidoAccordionState = new Map();
  const pedidoItemDetails = new Map();
  const pedidoItemLoading = new Set();
  const whatsappMessagesCache = new Map();

  function injectStyles() {
    if (document.getElementById('nh-cliente-details-style')) return;
    const style = document.createElement('style');
    style.id = 'nh-cliente-details-style';
    style.textContent = `
    .nho2d-wrap{max-width:100%;width:100%;margin:0 auto;color:#e9eef8}
    .nho2d-shell{background:linear-gradient(180deg,#11172a 0%,#0b1220 100%);border:1px solid #1f2a44;border-radius:20px;padding:20px;box-shadow:0 22px 48px rgba(0,0,0,.35)}
    .nho2d-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:16px}
    .nho2d-hero{display:grid;gap:16px;padding:22px;border:1px solid rgba(148,163,184,.16);border-radius:22px;background:linear-gradient(135deg,rgba(16,25,45,.96),rgba(9,16,29,.98));box-shadow:0 18px 42px rgba(0,0,0,.24)}
    .nho2d-hero-top{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;flex-wrap:wrap}
    .nho2d-title{font-size:32px;font-weight:750;letter-spacing:-.03em;color:#f5f7fb}
    .nho2d-sub{margin-top:4px;color:#93a4c7;font-size:14px}
    .nho2d-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:#bfd0f4;font-size:14px}
    .nho2d-hero-meta{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .nho2d-hero-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .nho2d-hero-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .nho2d-hero-stat{padding:14px 16px;border-radius:16px;border:1px solid rgba(148,163,184,.14);background:rgba(255,255,255,.02);display:grid;gap:4px}
    .nho2d-hero-stat-label{color:#93a4c7;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
    .nho2d-hero-stat-value{font-size:17px;font-weight:700;color:#f5f7fb;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nho2d-hero-stat-value.is-wrap{white-space:normal;overflow:visible}
    .nho2d-tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #22304d;margin:10px 0 18px;padding-bottom:2px}
    .nho2d-tab{border:1px solid #243253;background:#10192d;color:#a7b6d4;border-radius:999px;padding:10px 14px;font-weight:700;cursor:pointer}
    .nho2d-tab.is-active{background:#2f6dff;color:#fff;box-shadow:0 10px 22px rgba(47,109,255,.28)}
    .nho2d-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);gap:16px}
    .nho2d-dados-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
    .nho2d-dados-grid.nho2d-digital-layout{grid-template-columns:minmax(320px,1fr) minmax(0,1.55fr) minmax(320px,.95fr)}
    .nho2d-digital-main{display:grid;gap:16px;grid-column:2}
    .nho2d-digital-side{display:grid;gap:16px;grid-column:3}
    .cliente360-relevant-grid{display:flex;flex-direction:column;gap:16px}
    .cliente360-card-primary,.cliente360-card-enrichment,.cliente360-card-address,.cliente360-card-summary,.nho2d-card{min-width:0}
    .cliente360-card-primary{min-height:100%;display:flex;flex-direction:column}
    .cliente360-card-primary .cliente360-card-body{flex:1}
    .cliente360-column-right{display:flex;flex-direction:column;gap:24px;height:100%;grid-column:3;grid-row:1}
    .cliente360-card-enrichment{grid-column:2;grid-row:1}
    .cliente360-card-address,.cliente360-card-summary{width:100%}
    .cliente360-card-primary{grid-column:1;grid-row:1}
    .cliente360-card-map{display:grid;grid-column:1 / -1;grid-template-columns:minmax(0,1fr) minmax(360px,1.2fr);gap:18px;min-width:0;align-items:stretch}
    .cliente360-map-left{display:grid;align-content:start;gap:12px}
    .cliente360-map-frame{width:100%;height:240px;border:0;border-radius:12px;overflow:hidden;display:block;min-height:220px}
    .nho2d-single-col{display:grid;grid-template-columns:1fr;gap:10px}
    .nho2d-stack{display:grid;gap:14px}
    .nho2d-card{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,.22)}
    .nho2d-card h3{margin:0 0 10px;font-size:16px;color:#f5f7fb}
    .nho2d-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
    .nho2d-card-title{display:grid;gap:4px}
    .nho2d-card-title h3{margin:0;font-size:18px}
    .nho2d-card-title p{margin:0;color:#93a4c7;font-size:13px;line-height:1.4}
    .nho2d-badge-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .nho2d-chip-row{display:flex;flex-wrap:wrap;gap:8px}
    .nho2d-chip-row.is-tight{gap:7px}
    .nho2d-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;border:1px solid rgba(79,140,255,.2);background:rgba(47,109,255,.12);color:#dbe7ff;font-size:12px;font-weight:700}
    .nho2d-chip.is-muted{background:rgba(255,255,255,.03);border-color:rgba(148,163,184,.16);color:#b8c6e0}
    .nho2d-chip.is-link{cursor:pointer}
    .nho2d-status-dot{width:9px;height:9px;border-radius:999px;display:inline-block}
    .nho2d-status-dot.is-on{background:#4fd16f;box-shadow:0 0 0 4px rgba(79,209,111,.13)}
    .nho2d-status-dot.is-off{background:#66738d}
    .nho2d-enrichment-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .nho2d-enrichment-col{border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:14px;background:rgba(255,255,255,.015);display:grid;gap:10px}
    .nho2d-enrichment-col h4{margin:0;font-size:14px;color:#f5f7fb}
    .nho2d-link-list{display:grid;gap:8px}
    .nho2d-link-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.02);border:1px solid rgba(148,163,184,.12);color:#dfe8fb;text-decoration:none;overflow-wrap:anywhere;min-width:0}
    .nho2d-link-item:hover{border-color:rgba(79,140,255,.3);background:rgba(47,109,255,.1)}
    .nho2d-link-meta{display:flex;align-items:center;gap:8px}
    .nho2d-circle-chart{width:132px;height:132px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#4fd16f 0 338.4deg,#24324f 338.4deg 360deg);box-shadow:inset 0 0 0 12px rgba(12,20,34,.88)}
    .nho2d-circle-chart-inner{width:106px;height:106px;border-radius:50%;background:radial-gradient(circle at 30% 30%, rgba(255,255,255,.04), rgba(255,255,255,0));display:grid;place-items:center;text-align:center}
    .nho2d-circle-chart-value{font-size:28px;font-weight:800;color:#f7fbff;line-height:1}
    .nho2d-circle-chart-label{font-size:12px;color:#92a4c7;margin-top:4px}
    .nho2d-checklist{display:grid;gap:8px}
    .nho2d-checklist-item{display:flex;align-items:center;gap:10px;color:#dce7fb;font-size:13px}
    .nho2d-checkmark{width:20px;height:20px;border-radius:999px;background:rgba(148,163,184,.14);display:inline-grid;place-items:center;color:#93a4c7;font-weight:900}
    .nho2d-checkmark.is-on{background:rgba(79,209,111,.15);color:#4fd16f}
    .nho2d-checkmark.is-off{background:rgba(148,163,184,.14);color:#93a4c7}
    .nho2d-timeline-horizontal{display:grid;grid-template-columns:1.1fr repeat(5,minmax(130px,1fr)) auto;gap:14px;align-items:stretch}
    .nho2d-timeline-head{display:grid;gap:10px;align-content:start}
    .nho2d-timeline-event{display:grid;gap:8px;padding:14px;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:rgba(255,255,255,.02)}
    .nho2d-timeline-event-icon{width:34px;height:34px;border-radius:999px;background:rgba(47,109,255,.18);display:grid;place-items:center;font-weight:800;color:#cfe0ff}
    .nho2d-timeline-event-title{font-weight:700;color:#f5f7fb;font-size:14px}
    .nho2d-timeline-event-date{color:#93a4c7;font-size:12px}
    .nho2d-dl{display:grid;grid-template-columns:160px minmax(0,1fr);gap:10px 14px;margin:0}
    .nho2d-dl-single{grid-template-columns:170px minmax(0,1fr)}
    .nho2d-dt{color:#93a4c7;font-weight:600}
    .nho2d-dd{margin:0;color:#e7eefb;overflow-wrap:anywhere;min-width:0}
    .nho2d-dd.is-nowrap{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nho2d-dd.is-clip{overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical}
    .nho2d-dd.is-clamped{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden;max-height:7.2em}
    .nho2d-right{text-align:right}
    .nho2d-panel-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px;align-items:start;grid-auto-flow:dense}
    .nho2d-panel-grid--single{grid-template-columns:1fr}
    .nho2d-panel-grid--map{grid-template-columns:repeat(auto-fit,minmax(360px,1fr))}
    .nho2d-panel-stack{display:grid;gap:16px}
    .nho2d-inline-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .nho2d-icon-pill{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:rgba(47,109,255,.14);color:#dbe7ff}
    .nho2d-link-row{display:flex;justify-content:space-between;gap:10px;align-items:center;width:100%;min-width:0}
    .nho2d-link-main{display:grid;gap:2px;min-width:0}
    .nho2d-link-main strong{font-size:13px;color:#f5f7fb}
    .nho2d-link-main span{font-size:12px;color:#93a4c7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .nho2d-pill-quiet{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.04);border:1px solid rgba(148,163,184,.12);color:#b8c6e0;font-size:12px;font-weight:700}
    .nho2d-hero-channel{display:flex;align-items:center;gap:8px;white-space:nowrap}
    .nho2d-table-wrap{overflow:auto}
    .nho2d-table{width:100%;border-collapse:separate;border-spacing:0}
    .nho2d-table th{background:rgba(255,255,255,.03);color:#a9bbd8;text-align:left;font-size:13px;padding:10px 12px}
    .nho2d-table td{padding:12px;border-top:1px solid rgba(148,163,184,.12);color:#e7eefb;vertical-align:top}
    .nho2d-table tbody tr:nth-child(even){background:rgba(255,255,255,.015)}
    .nho2d-table tbody tr:hover{background:rgba(79,140,255,.08)}
    .nho2d-empty{padding:16px 6px;color:#93a4c7}
    .nho2d-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .nho2d-kpi{border:1px solid rgba(148,163,184,.16);border-radius:12px;padding:12px;background:rgba(255,255,255,.03)}
    .nho2d-kpi-label{color:#93a4c7;font-size:12px}
    .nho2d-kpi-value{margin-top:4px;color:#f5f7fb;font-size:18px;font-weight:700}
    .nho2d-section{display:grid;gap:14px}
    .nho2d-accordion{border:1px solid rgba(148,163,184,.16);border-radius:14px;overflow:hidden;background:rgba(255,255,255,.02)}
    .nho2d-accordion-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:transparent;border:0;cursor:pointer;text-align:left}
    .nho2d-accordion-head:hover{background:rgba(79,140,255,.08)}
    .nho2d-accordion-title{display:grid;gap:4px;min-width:0}
    .nho2d-accordion-title strong{font-size:15px;color:#f5f7fb}
    .nho2d-accordion-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#93a4c7;font-size:13px}
    .nho2d-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(47,109,255,.18);color:#cfe0ff;border:1px solid rgba(79,140,255,.24)}
    .nho2d-accordion-body{padding:0 18px 16px}
    .nho2d-chevron{transition:transform .2s ease;color:#5e6f93}
    .nho2d-accordion.is-open .nho2d-chevron{transform:rotate(180deg)}
    .nho2d-item-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .nho2d-item-note{font-size:12px;color:#93a4c7}
    .nho2d-mini-loading{padding:10px 0;color:#93a4c7;font-size:13px}
    .nho2d-crm-empty{padding:18px;border:1px dashed rgba(148,163,184,.2);border-radius:12px;color:#b8c6e0;background:rgba(255,255,255,.02)}
    .nho2d-actions{display:flex;gap:8px;flex-wrap:wrap}
    .nho2d-edit-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .nho2d-edit-field{display:grid;gap:6px}
    .nho2d-edit-label{font-size:12px;font-weight:700;color:#93a4c7}
    .nho2d-edit-input{width:100%;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:10px 12px;font:inherit;color:#e7eefb;background:#0b1628}
    .nho2d-edit-input:focus{outline:2px solid rgba(79,140,255,.28);outline-offset:1px;border-color:#5b8cff}
    .nho2d-whatsapp{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:14px;min-height:520px}
    .nho2d-whatsapp-list{display:grid;gap:10px}
    .nho2d-whatsapp-item{border:1px solid rgba(148,163,184,.16);border-radius:12px;padding:14px;background:rgba(255,255,255,.02);cursor:pointer;display:grid;gap:6px;text-align:left}
    .nho2d-whatsapp-item.is-active{border-color:rgba(79,140,255,.5);background:rgba(47,109,255,.14)}
    .nho2d-whatsapp-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
    .nho2d-whatsapp-title{font-weight:700;color:#f5f7fb}
    .nho2d-whatsapp-meta{color:#93a4c7;font-size:12px;display:flex;flex-wrap:wrap;gap:8px}
    .nho2d-whatsapp-preview{color:#c0cce3;font-size:13px;line-height:1.4}
    .nho2d-whatsapp-thread{display:grid;gap:10px}
    .nho2d-whatsapp-msg{max-width:78%;padding:12px 14px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:rgba(255,255,255,.03);display:grid;gap:4px}
    .nho2d-whatsapp-msg.is-inbound{margin-right:auto;background:rgba(255,255,255,.02)}
    .nho2d-whatsapp-msg.is-outbound{margin-left:auto;background:rgba(47,109,255,.12);border-color:rgba(79,140,255,.24)}
    .nho2d-whatsapp-msg-meta{color:#93a4c7;font-size:12px}
    .nho2d-alert-card{display:grid;gap:12px}
    .nho2d-alert-list{display:grid;gap:10px}
    .nho2d-alert-item{border:1px solid rgba(148,163,184,.16);border-radius:12px;padding:14px;background:rgba(255,255,255,.02);display:grid;gap:8px}
    .nho2d-alert-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}
    .nho2d-alert-title{font-weight:700;color:#f5f7fb}
    .nho2d-alert-desc{color:#b8c6e0;font-size:13px;line-height:1.45}
    .nho2d-alert-actions{display:flex;gap:8px;flex-wrap:wrap}
    .nho2d-timeline-list{display:grid;gap:12px}
    .nho2d-timeline-item{display:flex;gap:12px;padding:14px;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:rgba(255,255,255,.02)}
    .nho2d-timeline-icon{width:34px;height:34px;border-radius:999px;background:rgba(47,109,255,.18);color:#cfe0ff;display:flex;align-items:center;justify-content:center;font-weight:800;flex:0 0 auto}
    .nho2d-timeline-body{min-width:0;display:grid;gap:4px}
    .nho2d-timeline-title{font-weight:700;color:#f5f7fb}
    .nho2d-timeline-desc{color:#b8c6e0;font-size:13px;line-height:1.45}
    .nho2d-timeline-meta{color:#93a4c7;font-size:12px}
    .nho2d-group-summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .nho2d-group-body{padding:0 18px 16px}
    .nho2d-group-empty{padding:0 18px 16px;color:#62759a}
    .nho2d-product-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:transparent;border:0;cursor:pointer;text-align:left}
    .nho2d-product-row:hover{background:#f7faff}
    .nho2d-product-name{min-width:0;font-weight:700;color:#f5f7fb}
    .nho2d-product-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#93a4c7;font-size:13px}
    .nho2d-variation-panel{padding:0 18px 16px}
    .nho2d-variation-note{font-size:12px;color:#62759a;margin-top:4px}
    .nho2d-sync{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;background:#15213a;border:1px solid #253556;color:#b9c8e6;font-size:12px;font-weight:700}
    .nho2d-sync-dot{width:8px;height:8px;border-radius:999px;background:#5fb3ff;box-shadow:0 0 0 4px rgba(95,179,255,.14)}
    .nho2d-shell .nho2d-badge{background:#18243d;color:#dbe6ff;border-color:#273454}
    .nho2d-shell .nho2-btn{background:#2f6dff;color:#fff;border:1px solid #366fff;box-shadow:0 10px 20px rgba(47,109,255,.20)}
    .nho2d-shell .nho2-btn.secondary{background:#111a2e;color:#d9e4f7;border-color:#263655;box-shadow:none}
    .nho2d-shell .nho2-btn.ghost{background:transparent;color:#d9e4f7;border-color:rgba(148,163,184,.22);box-shadow:none}
    @media (max-width:1440px){.nho2d-dados-grid.nho2d-digital-layout{grid-template-columns:minmax(300px,1fr) minmax(0,1.3fr) minmax(280px,.95fr)}}
    @media (max-width:1280px){.nho2d-title{font-size:28px}.nho2d-hero-grid,.nho2d-dados-grid,.nho2d-dados-grid.nho2d-digital-layout{grid-template-columns:repeat(2,minmax(0,1fr))}.nho2d-digital-main,.nho2d-digital-side{grid-column:auto}.cliente360-card-primary{min-height:0}.cliente360-column-right{grid-column:auto;grid-row:auto;gap:16px;height:auto}.cliente360-card-enrichment,.cliente360-card-address,.cliente360-card-summary{grid-column:auto;grid-row:auto}.cliente360-card-map{grid-template-columns:1fr}.cliente360-map-frame{height:240px}.nho2d-enrichment-grid,.nho2d-timeline-horizontal{grid-template-columns:1fr}}
    @media (max-width:900px){.nho2d-hero-grid,.nho2d-panel-grid,.nho2d-panel-grid--map,.nho2d-dl,.nho2d-edit-grid,.nho2d-enrichment-grid,.nho2d-dados-grid,.nho2d-dados-grid.nho2d-digital-layout{grid-template-columns:1fr}.nho2d-circle-chart{margin:0 auto}.nho2d-timeline-horizontal{grid-template-columns:1fr}.nho2d-hero-top{flex-direction:column}.nho2d-hero-actions{justify-content:flex-start}}
    @media (max-width:1024px){.nho2d-grid{grid-template-columns:1fr}.nho2d-dados-grid,.nho2d-dados-grid.nho2d-digital-layout{grid-template-columns:1fr}.nho2d-title{font-size:24px}.nho2d-dl{grid-template-columns:1fr}.nho2d-kpi-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getTabLabel(key) {
    if (key === 'geral') return 'Visão geral';
    if (key === 'dados-relevantes') return 'Dados relevantes';
    if (key === 'comercial') return 'Comercial';
    if (key === 'alertas') return 'Alertas';
    if (key === 'timeline') return 'Timeline';
    if (key === 'radar') return 'Radar';
    return 'Visão geral';
  }

  function getTimelineIcon(categoria) {
    const value = String(categoria || '').toLowerCase();
    if (value === 'cadastro') return '●';
    if (value === 'enriquecimento') return '✦';
    if (value === 'geolocalizacao') return '⌖';
    if (value === 'score') return '⇅';
    if (value === 'alerta') return '!';
    if (value === 'pedido') return '◫';
    if (value === 'visita') return '⌂';
    if (value === 'diretor_ia') return 'AI';
    return '•';
  }

  function getSegmentBadge(segmento) {
    const value = String(segmento || '').toUpperCase();
    const map = {
      VIP: 'background:#e8f9ef;color:#19723b;border-color:#bfeccc',
      RECORRENTE: 'background:#e8f1ff;color:#2450b8;border-color:#c8dafc',
      POTENCIAL: 'background:#f2eafe;color:#6f35c7;border-color:#dcc6fb',
      RECUPERACAO: 'background:#fff2e7;color:#c96a10;border-color:#f8d0ae',
      EM_RISCO: 'background:#ffe8e8;color:#bb1f1f;border-color:#f6bcbc',
      NOVO: 'background:#e7fbfb;color:#0f7f84;border-color:#bceff0',
      INATIVO: 'background:#eef1f5;color:#667085;border-color:#d7dee8'
    };
    return map[value] || map.INATIVO;
  }

  function renderEditField(id, label, value, type = 'text', extra = '') {
    return `<label class="nho2d-edit-field" for="${id}"><span class="nho2d-edit-label">${label}</span><input id="${id}" class="nho2d-edit-input" type="${type}" value="${safeText(value, '')}" ${extra}></label>`;
  }

  function renderEditSelect(id, label, value, options) {
    return `<label class="nho2d-edit-field" for="${id}"><span class="nho2d-edit-label">${label}</span><select id="${id}" class="nho2d-edit-input">${options.map((option) => `<option value="${option.value}" ${String(value || '') === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}</select></label>`;
  }

  function renderEditForm(d) {
    if (!editForm) editForm = buildEditForm(d);
    return `
      <div class="nho2d-edit-grid">
        ${renderEditField('nho2d-edit-nome', 'Nome / Razão social', editForm.nome)}
        ${renderEditField('nho2d-edit-cidade', 'Cidade', editForm.cidade)}
        ${renderEditField('nho2d-edit-estado', 'Estado', editForm.estado, 'text', 'maxlength="2"')}
        <label class="nho2d-edit-field" for="nho2d-edit-status"><span class="nho2d-edit-label">Status</span>
          <select id="nho2d-edit-status" class="nho2d-edit-input">
            ${['ativo', 'inativo', 'prospect'].map((option) => `<option value="${option}" ${String(editForm.status || 'ativo') === option ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
        </label>
        ${renderEditField('nho2d-edit-vendedor', 'vendedor_id', editForm.vendedor_id)}
        ${renderEditField('nho2d-edit-documento', 'Documento', editForm.documento)}
        ${renderEditField('nho2d-edit-telefone', 'Telefone', editForm.telefone)}
        ${renderEditField('nho2d-edit-email', 'Email', editForm.email, 'email')}
        ${renderEditField('nho2d-edit-razao-social', 'Razão social', editForm.razao_social)}
      </div>
    `;
  }

  function safeValue(value) {
    const text = String(value || '').trim();
    return text || 'Não informado';
  }

  function buildEditForm(data) {
    return {
      nome: String(data?.razao_social || data?.nomeEmpresa || '').trim(),
      cidade: String(data?.cidade || '').trim(),
      estado: String(data?.uf || data?.estado || '').trim(),
      status: String(data?.status_raw || data?.status_editavel || data?.status || '').trim() || 'ativo',
      vendedor_id: String(data?.dadosCliente?.vendedor_id || data?.vendedor_id || '').trim(),
      documento: String(data?.dadosCliente?.documento || data?.documento || '').trim(),
      telefone: String(data?.dadosCliente?.telefone || data?.telefone || '').trim(),
      telefone2: String(data?.telefone2 || data?.telefone_secundario || '').trim(),
      email: String(data?.dadosCliente?.email || data?.email || '').trim(),
      site: String(data?.site || '').trim(),
      razao_social: String(data?.razao_social || data?.nomeEmpresa || '').trim()
    };
  }

  function startEditMode() {
    editForm = buildEditForm(state.data);
    editErrorMessage = '';
    editMode = true;
    render();
  }

  function cancelEditMode() {
    editForm = null;
    editErrorMessage = '';
    editMode = false;
    render();
  }

  function formatDateFriendly(value) {
    return formatDisplayDateTime(value);
  }

  function getPedidoItems(pedido) {
    const cached = pedidoItemDetails.get(pedido.id);
    if (cached) return cached;
    if (Array.isArray(pedido.itens)) return pedido.itens;
    return [];
  }

  function renderHeader(d) {
    const hasSite = Boolean(String(d?.site || '').trim());
    const digitalScore = Number.isFinite(Number(d?.cliente_score)) ? `${Number(d.cliente_score).toFixed(0)}%` : '94%';
    const locationLabel = [d?.cidade, d?.uf].filter(Boolean).join(' / ') || 'Não informado';
    const enrichmentLabel = d?.digital_enrichment_updated_at ? `Atualizado ${formatDateFriendly(d.digital_enrichment_updated_at)}` : 'Enriquecimento pendente';
    return `
      <div class="nho2d-hero">
        <div class="nho2d-hero-top">
          <div style="min-width:0">
            <div class="nho2d-title">${safeText(d?.nomeEmpresa, 'Cliente não identificado')}</div>
            <div class="nho2d-meta nho2d-hero-meta">
              <span class="nho2-badge ${statusClass(d?.status)}">${safeText(d?.status, '-')}</span>
              <span class="nho2d-pill-quiet">${locationLabel}</span>
              ${d?.dataCadastro ? `<span class="nho2d-pill-quiet">Cadastrado em ${fmtDate(d.dataCadastro)}</span>` : ''}
            </div>
            ${syncLoading ? `<div class="nho2d-sync" role="status" aria-live="polite"><span class="nho2d-sync-dot"></span>Atualizando dados do cliente...</div>` : syncMessage ? `<div class="nho2d-sync" role="status" aria-live="polite"><span class="nho2d-sync-dot"></span>${safeText(syncMessage, '')}</div>` : `<div class="nho2d-sub">Cliente 360°</div>`}
          </div>
          <div class="nho2d-hero-actions">
            <button id="nhcd-back" class="nho2-btn ghost">Voltar</button>
          </div>
        </div>
        <div class="nho2d-hero-grid">
          <div class="nho2d-hero-stat">
            <div class="nho2d-hero-stat-label">Identidade</div>
            <div class="nho2d-hero-stat-value">${safeText(d?.nomeEmpresa, 'Cliente não identificado')}</div>
          </div>
          <div class="nho2d-hero-stat">
            <div class="nho2d-hero-stat-label">Contato</div>
            <div class="nho2d-hero-stat-value is-wrap">${safeText(d?.dadosCliente?.telefone || d?.telefone || '-', '-')}</div>
          </div>
          <div class="nho2d-hero-stat">
            <div class="nho2d-hero-stat-label">Score digital</div>
            <div class="nho2d-hero-stat-value">${digitalScore}</div>
          </div>
          <div class="nho2d-hero-stat">
            <div class="nho2d-hero-stat-label">Enriquecimento</div>
            <div class="nho2d-hero-stat-value is-wrap">${enrichmentLabel}</div>
          </div>
        </div>
        <div class="nho2d-hero-top">
          <div class="nho2d-hero-meta">
            <button id="nho2d-edit-start" class="nho2-btn">Editar</button>
            ${hasSite ? `<button id="nho2d-open-site" class="nho2-btn secondary" data-open-url="${encodeURIComponent(String(d.site || ''))}">Abrir site</button>` : `<button id="nho2d-web-discovery" class="nho2-btn secondary" ${webDiscoveryLoading ? 'disabled' : ''}>${webDiscoveryLoading ? 'Descobrindo...' : 'Descobrir site'}</button>`}
            <button id="nho2d-enrich" class="nho2-btn secondary" ${enrichmentLoading ? 'disabled' : ''}>${enrichmentLoading ? 'Atualizando...' : 'Atualizar'}</button>
          </div>
          <div class="nho2d-sub">Leitura executiva com foco em identidade, contato, presença digital, negócio e contexto.</div>
        </div>
        ${(webDiscoveryMessage || feedbackMessage) ? `<div class="nho2d-crm-empty" role="status">${safeText(webDiscoveryMessage || feedbackMessage, '')}</div>` : ''}
      </div>
      <div class="nho2d-tabs" role="tablist" aria-label="Detalhes do cliente">
        ${['dados-relevantes', 'geral', 'comercial', 'alertas', 'timeline', 'radar'].map((tab) => `<button class="nho2d-tab ${activeTab === tab ? 'is-active' : ''}" data-tab="${tab}" role="tab" aria-selected="${activeTab === tab ? 'true' : 'false'}">${getTabLabel(tab)}</button>`).join('')}
      </div>
    `;
  }

  function renderGeral(d) {
    const score = Number(d?.cliente_score);
    const scoreClassificacao = safeValue(d?.cliente_classificacao);
    const scorePotencial = safeValue(d?.cliente_potencial);
    const segmento = safeValue(d?.segmento_comercial || 'INATIVO');
    const segmentoMotivos = Array.isArray(d?.segmento_motivos) ? d.segmento_motivos : [];
    const scoreFatores = d?.cliente_score_fatores && typeof d.cliente_score_fatores === 'object' ? d.cliente_score_fatores : {};
    const scoreFactorsList = [
      ['Faturamento total', fmtCurrency(scoreFatores.faturamento_total)],
      ['Total de pedidos', scoreFatores.total_pedidos ?? 0],
      ['Ticket médio', fmtCurrency(scoreFatores.ticket_medio)],
      ['Última compra', scoreFatores.ultima_compra ? fmtDate(scoreFatores.ultima_compra) : 'Sem compras'],
      ['Dias sem compra', scoreFatores.dias_sem_compra ?? '-'],
      ['Produtos distintos', scoreFatores.produtos_distintos ?? 0]
    ];
    const fields = [
      ['Faturamento total', fmtCurrency(d?.kpis?.faturamentoTotal)],
      ['Total de pedidos', d?.kpis?.totalPedidos ?? 0],
      ['Ticket médio', fmtCurrency(d?.kpis?.ticketMedio)],
      ['Última compra', d?.kpis?.ultimaCompra ? fmtDate(d.kpis.ultimaCompra) : 'Sem compras'],
      ['Cidade/UF', [d?.cidade, d?.uf].filter(Boolean).join(' / ') || '-'],
      ['Status do cliente', d?.status || '-'],
      ['Vendedor', d?.dadosCliente?.vendedor || '-'],
      ['Documento', d?.dadosCliente?.documento || '-'],
      ['Telefone', d?.dadosCliente?.telefone || '-'],
      ['Email', d?.dadosCliente?.email || '-']
    ];
    const relevantFields = editMode
      ? null
      : fields.slice(4);
    const editLabel = editMode ? 'Visualizando' : 'Editar dados';
    return `
      <div class="nho2d-grid">
        <div class="nho2d-stack">
          <article class="nho2d-card">
      <div class="nho2d-header" style="margin-bottom:12px">
        <div>
          <h3 style="margin:0 0 4px">Score Comercial</h3>
          <div class="nho2d-sub">Cálculo manual com base em pedidos válidos, frequência, ticket, recência e diversidade.</div>
        </div>
              <button id="nho2d-score" class="nho2-btn secondary" ${scoreLoading ? 'disabled' : ''}>${scoreLoading ? 'Calculando score...' : 'Recalcular agora'}</button>
            </div>
            ${feedbackMessage ? `<div class="nho2d-crm-empty" style="margin-bottom:12px">${safeText(feedbackMessage, '')}</div>` : ''}
            <dl class="nho2d-dl">
              <dt class="nho2d-dt">Pontuação</dt><dd class="nho2d-dd">${Number.isFinite(score) ? score : 'Não calculado'}</dd>
              <dt class="nho2d-dt">Classificação</dt><dd class="nho2d-dd">${scoreClassificacao}</dd>
              <dt class="nho2d-dt">Potencial</dt><dd class="nho2d-dd">${scorePotencial}</dd>
              <dt class="nho2d-dt">Última atualização</dt><dd class="nho2d-dd">${formatDateFriendly(d?.cliente_score_ultima_execucao)}</dd>
            </dl>
            <div style="margin-top:12px">
              <div class="nho2d-dt" style="margin-bottom:8px">Principais fatores</div>
              ${scoreFatores && Object.keys(scoreFatores).length ? `<div class="nho2d-kpi-grid">${scoreFactorsList.map(([label, value]) => `<div class="nho2d-kpi"><div class="nho2d-kpi-label">${label}</div><div class="nho2d-kpi-value">${value}</div></div>`).join('')}</div>` : '<p class="nho2d-empty">O score ainda não foi calculado.</p>'}
            </div>
          </article>
          <article class="nho2d-card">
            <h3>Resumo gerencial</h3>
            <div class="nho2d-kpi-grid">
              ${fields.slice(0, 4).map(([label, value]) => `<div class="nho2d-kpi"><div class="nho2d-kpi-label">${label}</div><div class="nho2d-kpi-value">${value}</div></div>`).join('')}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-header" style="margin-bottom:12px">
              <div>
                <h3 style="margin:0 0 4px">Segmentação Comercial</h3>
                <div class="nho2d-sub">Camada estratégica acima do score comercial para priorização da equipe.</div>
              </div>
              <button id="nho2d-segmentacao" class="nho2-btn secondary" ${scoreLoading ? 'disabled' : ''}>${scoreLoading ? 'Calculando...' : 'Recalcular segmentação'}</button>
            </div>
            <dl class="nho2d-dl">
              <dt class="nho2d-dt">Segmento</dt>
              <dd class="nho2d-dd"><span class="nho2-badge" style="${getSegmentBadge(segmento)}">${segmento}</span></dd>
              <dt class="nho2d-dt">Última atualização</dt>
              <dd class="nho2d-dd">${formatDateFriendly(d?.segmento_ultima_atualizacao)}</dd>
              <dt class="nho2d-dt">Motivos</dt>
              <dd class="nho2d-dd">${segmentoMotivos.length ? `<ul style="margin:0;padding-left:18px">${segmentoMotivos.map((motivo) => `<li>${safeText(motivo, '')}</li>`).join('')}</ul>` : 'Sem motivos registrados.'}</dd>
            </dl>
          </article>
          <article class="nho2d-card nho2d-alert-card">
            <div class="nho2d-header" style="margin-bottom:0">
              <div>
                <h3 style="margin:0 0 4px">Alertas Comerciais</h3>
                <div class="nho2d-sub">Riscos, oportunidades e ações recomendadas.</div>
              </div>
              <button id="nho2d-alerts-generate" class="nho2-btn secondary" ${alertsLoading ? 'disabled' : ''}>${alertsLoading ? 'Gerando...' : 'Gerar Alertas'}</button>
            </div>
            ${alertMessage ? `<div class="nho2d-crm-empty">${safeText(alertMessage, '')}</div>` : ''}
            ${(Array.isArray(d?.cliente_alertas) ? d.cliente_alertas.filter((item) => String(item?.status || '') === 'ativo') : []).length
              ? `<div class="nho2d-alert-list">${d.cliente_alertas.filter((item) => String(item?.status || '') === 'ativo').map((alerta) => `
                <div class="nho2d-alert-item" data-alerta-id="${alerta.id}">
                  <div class="nho2d-alert-top">
                    <div>
                      <div class="nho2d-alert-title">${safeText(alerta.titulo, 'Alerta')}</div>
                      <div class="nho2d-alert-desc">${safeText(alerta.descricao, '')}</div>
                    </div>
                    <span class="nho2-badge">${safeText(alerta.severidade, '-')}</span>
                  </div>
                  <div class="nho2d-alert-actions">
                  <button class="nho2-btn secondary" data-resolver-alerta="${alerta.id}">Marcar como resolvido</button>
                  </div>
                </div>`).join('')}</div>`
              : '<div class="nho2d-crm-empty">Nenhum alerta ativo para este cliente.</div>'}
          </article>
          <article class="nho2d-card">
            <h3>Dados relevantes</h3>
            <div class="nho2d-header" style="margin-bottom:12px">
              <div class="nho2d-sub">Controle explícito de edição para os dados principais do cliente.</div>
              ${editMode ? `
                <div class="nho2d-actions">
                  <button id="nho2d-edit-cancel" class="nho2-btn secondary" ${editSaving ? 'disabled' : ''}>Cancelar</button>
                  <button id="nho2d-edit-save" class="nho2-btn" ${editSaving ? 'disabled' : ''}>${editSaving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              ` : `<button id="nho2d-edit-start" class="nho2-btn">${editLabel}</button>`}
            </div>
            ${editErrorMessage ? `<div class="nho2d-crm-empty" role="alert" style="margin-bottom:12px">${safeText(editErrorMessage, '')}</div>` : ''}
            ${editMode ? renderEditForm(d) : `<dl class="nho2d-dl">${relevantFields.map(([label, value]) => `<dt class="nho2d-dt">${label}</dt><dd class="nho2d-dd">${value}</dd>`).join('')}</dl>`}
          </article>
        </div>
        <div class="nho2d-stack">
          <article class="nho2d-card">
            <h3>Indicadores atuais</h3>
            <dl class="nho2d-dl">
              <dt class="nho2d-dt">Data de cadastro</dt><dd class="nho2d-dd">${fmtDate(d?.dataCadastro)}</dd>
              <dt class="nho2d-dt">Cidade/UF</dt><dd class="nho2d-dd">${[d?.cidade, d?.uf].filter(Boolean).join(' / ') || '-'}</dd>
              <dt class="nho2d-dt">Status</dt><dd class="nho2d-dd"><span class="nho2-badge ${statusClass(d?.status)}">${d?.status || '-'}</span></dd>
            </dl>
          </article>
          <article class="nho2d-card">
            <h3>Produtos Comprados</h3>
            ${(d?.produtosComprados || []).length
              ? `<div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Produto</th><th>Quantidade</th><th class="nho2d-right">Faturamento</th></tr></thead><tbody>${d.produtosComprados.map((p) => `<tr><td>${p.produto || '-'}</td><td>${p.quantidade ?? 0}</td><td class="nho2d-right">${fmtCurrency(p.faturamento)}</td></tr>`).join('')}</tbody></table></div>`
              : '<p class="nho2d-empty">Este cliente ainda não possui produtos comprados.</p>'}
          </article>
          ${renderGruposComerciais(d)}
        </div>
      </div>
    `;
  }

  function renderPedidoItens(pedido) {
    const items = getPedidoItems(pedido);
    if (!items.length) return '<p class="nho2d-empty" style="padding:12px 0">Sem itens para exibir.</p>';
    const grupos = agruparItensPorProduto(items);
    return `<div class="nho2d-stack">${grupos.map((grupo, index) => {
      const groupId = `${pedido.id || 'pedido'}-${index}`;
      const open = pedidoAccordionState.get(groupId) ?? false;
      return `<section class="nho2d-accordion ${open ? 'is-open' : ''}" data-variation-group="${groupId}">
        <button class="nho2d-product-row" data-toggle-variation-group="${groupId}" aria-expanded="${open ? 'true' : 'false'}">
          <span class="nho2d-product-name">${safeText(grupo.produtoNome, 'Produto sem nome')}</span>
          <span class="nho2d-product-meta">
            <span class="nho2d-pill">${grupo.quantidadeTotal} un.</span>
            <span><strong>Total do produto:</strong> ${fmtCurrency(grupo.valorTotal)}</span>
          </span>
          <svg class="nho2d-chevron" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        ${open ? `<div class="nho2d-variation-panel">
          <div class="nho2d-table-wrap">
            <table class="nho2d-table">
              <thead>
                <tr>
                  <th>Cor</th>
                  <th>Tamanho</th>
                  <th>Quantidade</th>
                  <th class="nho2d-right">Custo unitário</th>
                </tr>
              </thead>
              <tbody>
                ${grupo.variacoes.map((item) => {
                  const quantidade = Number(item?.quantidade || 0);
                  const unitario = Number(item?.valor_unitario || item?.valorUnitario || item?.preco_unitario || item?.preco || 0);
                  const cor = item?.cor_original || item?.cor || '-';
                  const tamanho = item?.tamanho_original || item?.tamanho || item?.grade || '-';
                  const motivo = safeText(item?.motivo_vinculo, '');
                  return `<tr>
                    <td>${safeText(cor, '-')}</td>
                    <td>${safeText(tamanho, '-')}</td>
                    <td>${quantidade || 0}</td>
                    <td class="nho2d-right">
                      <div>${fmtCurrency(unitario)}</div>
                      ${motivo ? `<div class="nho2d-variation-note">${motivo}</div>` : ''}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>` : ''}
      </section>`;
    }).join('')}</div>`;
  }

  function renderPedido(pedido) {
    const open = pedidoAccordionState.get(pedido.id) ?? false;
    const items = getPedidoItems(pedido);
    const hasItems = Array.isArray(items) && items.length > 0;
    const loading = pedidoItemLoading.has(pedido.id);
    return `<section class="nho2d-accordion ${open ? 'is-open' : ''}" data-pedido-id="${pedido.id}">
      <button class="nho2d-accordion-head" data-toggle-pedido="${pedido.id}" aria-expanded="${open ? 'true' : 'false'}">
        <span class="nho2d-accordion-title">
          <strong>Pedido ${safeText(pedido.numero, '-')}</strong>
          <span class="nho2d-accordion-meta">
            <span><strong>Data:</strong> ${fmtDateOnlyUTC(getPedidoDate(pedido))}</span>
            <span class="nho2-badge ${statusClass(pedido.status)}">${safeText(pedido.status, '-')}</span>
            <span class="nho2d-pill">${pedido.itemCount ?? (Array.isArray(pedido.itens) ? pedido.itens.length : 0)} itens</span>
            <span><strong>Valor:</strong> ${fmtCurrency(calcularValorPedido(pedido))}</span>
          </span>
        </span>
        <svg class="nho2d-chevron" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${open ? `<div class="nho2d-accordion-body">${loading ? '<div class="nho2d-mini-loading">Carregando itens do pedido...</div>' : hasItems ? renderPedidoItens(pedido) : '<p class="nho2d-empty" style="padding:12px 0">Sem itens carregados para este pedido.</p>'}</div>` : ''}
    </section>`;
  }

  function renderGroup(group) {
    const summary = {
      totalPedidos: Number(group?.totalPedidos || group?.pedidos?.length || 0),
      totalValue: Array.isArray(group?.pedidos) ? group.pedidos.reduce((soma, pedido) => soma + calcularValorPedido(pedido), 0) : Number(group?.totalValue || 0),
      latestBillingDate: group?.latestBillingDate || null
    };
    const open = groupAccordionState.get(group.key) ?? false;
    return `<section class="nho2d-accordion ${open ? 'is-open' : ''}" data-group-key="${group.key}">
      <button class="nho2d-accordion-head" data-toggle-group="${group.key}" aria-expanded="${open ? 'true' : 'false'}">
        <span class="nho2d-accordion-title">
          <strong>${safeText(group.label, 'Pedidos')}</strong>
          <span class="nho2d-accordion-meta nho2d-group-summary">
            <span class="nho2d-pill">${summary.totalPedidos} pedidos</span>
            <span><strong>Valor total:</strong> ${fmtCurrency(summary.totalValue)}</span>
            <span><strong>Último faturamento:</strong> ${fmtGroupDate(summary.latestBillingDate)}</span>
          </span>
        </span>
        <svg class="nho2d-chevron" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      ${open ? `<div class="nho2d-group-body">${Array.isArray(group.pedidos) && group.pedidos.length ? group.pedidos.map((pedido) => renderPedido(pedido)).join('') : '<div class="nho2d-group-empty">Nenhum pedido neste grupo.</div>'}</div>` : ''}
    </section>`;
  }

  function renderComercial(d) {
    const grupos = Array.isArray(d?.pedidosAgrupados) ? d.pedidosAgrupados : [];
    if (!groupAccordionState.size) grupos.forEach((group) => groupAccordionState.set(group.key, false));
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <h3>Últimos Pedidos</h3>
          ${grupos.length
            ? grupos.map((group) => renderGroup(group)).join('')
            : '<p class="nho2d-empty">Sem pedidos para este cliente.</p>'}
        </article>
      </div>
    `;
  }

  function renderCrm(d) {
    const conversations = Array.isArray(d?.crmConversations) ? d.crmConversations : [];
    if (!conversations.length) {
      return `<article class="nho2d-card"><h3>CRM</h3><div class="nho2d-crm-empty">Nenhuma conversa registrada para este cliente.</div></article>`;
    }
    return `<article class="nho2d-card"><h3>CRM</h3><div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Data</th><th>Canal</th><th>Responsável</th><th>Resumo</th></tr></thead><tbody>${conversations.map((c) => `<tr><td>${fmtDateTime(c.data)}</td><td>${safeText(c.canal)}</td><td>${safeText(c.responsavel)}</td><td>${safeText(c.resumo)}</td></tr>`).join('')}</tbody></table></div></article>`;
  }

  function renderAlertas(d) {
    const alertas = Array.isArray(d?.cliente_alertas) ? d.cliente_alertas.filter((item) => String(item?.status || '') === 'ativo') : [];
    return `
      <div class="nho2d-section">
        <article class="nho2d-card nho2d-alert-card">
          <div class="nho2d-header" style="margin-bottom:0">
            <div>
              <h3 style="margin:0 0 4px">Alertas Comerciais</h3>
              <div class="nho2d-sub">Motor de alertas para risco, oportunidade e ação recomendada.</div>
            </div>
            <button id="nho2d-alerts-generate" class="nho2-btn" ${alertsLoading ? 'disabled' : ''}>${alertsLoading ? 'Gerando...' : 'Gerar Alertas'}</button>
          </div>
          ${alertMessage ? `<div class="nho2d-crm-empty">${safeText(alertMessage, '')}</div>` : ''}
          ${alertasLoading ? '<div class="nho2d-mini-loading">Carregando alertas...</div>' : ''}
          ${alertas.length ? `<div class="nho2d-alert-list">${alertas.map((alerta) => `
            <div class="nho2d-alert-item" data-alerta-id="${alerta.id}">
              <div class="nho2d-alert-top">
                <div>
                  <div class="nho2d-alert-title">${safeText(alerta.titulo, 'Alerta')}</div>
                  <div class="nho2d-alert-desc">${safeText(alerta.descricao, '')}</div>
                </div>
                <span class="nho2-badge">${safeText(alerta.severidade, '-')}</span>
              </div>
              <div class="nho2d-alert-actions">
                <button class="nho2-btn" data-resolver-alerta="${alerta.id}">Marcar como resolvido</button>
              </div>
            </div>`).join('')}</div>` : '<div class="nho2d-crm-empty">Nenhum alerta ativo para este cliente.</div>'}
        </article>
      </div>
    `;
  }

  function renderDadosRelevantes(d) {
    const enrichmentStatus = safeValue(d?.digital_enrichment_status ? String(d.digital_enrichment_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    const geolocationStatus = safeValue(d?.geolocalizacao_status ? String(d.geolocalizacao_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    const hasCoordinates = Number.isFinite(Number(d?.latitude)) && Number.isFinite(Number(d?.longitude));
    const iframeSrc = hasCoordinates ? `https://maps.google.com/maps?q=${d.latitude},${d.longitude}&z=15&output=embed` : '';
    const timelineCount = Array.isArray(d?.timeline) ? d.timeline.length : 0;
    const cardFields = (items) => `<dl class="nho2d-dl">${items.map(([label, value, className = '']) => `<dt class="nho2d-dt">${label}</dt><dd class="nho2d-dd ${className}">${safeValue(value)}</dd>`).join('')}</dl>`;
    const hasSite = Boolean(String(d?.site || '').trim());
    const enrichment = d?.digital_enrichment_payload && typeof d.digital_enrichment_payload === 'object' ? d.digital_enrichment_payload : {};
    const contacts = enrichment.contacts || {};
    const social = enrichment.social || {};
    const company = enrichment.company || {};
    const commercial = enrichment.commercial || {};
    const lastDigitalUpdate = d?.digital_enrichment_updated_at || null;
    const socialMap = [
      ['Instagram', social.instagram, 'instagram.com'],
      ['Facebook', social.facebook, 'facebook.com'],
      ['LinkedIn', social.linkedin, 'linkedin.com'],
      ['YouTube', social.youtube, 'youtube.com'],
      ['TikTok', social.tiktok, 'tiktok.com']
    ];
    const contactMap = [
      ['WhatsApp', contacts.whatsapp, 'whatsapp'],
      ['Telefone', contacts.phones, 'tel:'],
      ['E-mail', contacts.emails, 'mailto:'],
      ['Site', hasSite ? [d.site] : [], 'site']
    ];
    const socialIndicator = (items = []) => (normalizeLinks(items).length ? '<span class="nho2d-status-dot is-on" aria-hidden="true"></span>' : '<span class="nho2d-status-dot is-off" aria-hidden="true"></span>');
    const linkFor = (value, type) => {
      const text = String(value || '').trim();
      if (!text) return '#';
      if (type === 'mailto:') return text.startsWith('mailto:') ? text : `mailto:${text}`;
      if (type === 'tel:') return text.startsWith('tel:') ? text : `tel:${text.replace(/[^\d+]/g, '')}`;
      if (type === 'whatsapp') return text.startsWith('http') ? text : `https://wa.me/${text.replace(/[^\d]/g, '')}`;
      if (type === 'site') return text.startsWith('http') ? text : `https://${text}`;
      return text;
    };
    const enrichHasAny = hasAnyDigitalInsight(enrichment);
    const ecommerceConfirmed = inferEcommercePresence(commercial);
    const commercialIndicators = [
      ['Ecommerce', ecommerceConfirmed],
      ['Catálogo online', commercial.has_catalog],
      ['Loja física', true],
      ['WhatsApp comercial', normalizeLinks(contacts.whatsapp).length > 0],
      ['Redes sociais ativas', socialMap.some(([, items]) => normalizeLinks(items).length > 0)]
    ];
    const socialItems = [
      ['Instagram', social.instagram, 'instagram.com', 'Instagram'],
      ['Facebook', social.facebook, 'facebook.com', 'Facebook'],
      ['LinkedIn', social.linkedin, 'linkedin.com', 'LinkedIn'],
      ['YouTube', social.youtube, 'youtube.com', 'YouTube'],
      ['TikTok', social.tiktok, 'tiktok.com', 'TikTok'],
      ['Google Maps', (d?.geolocalizacao_status || '').toLowerCase() === 'sucesso' && d?.google_maps_link ? [d.google_maps_link] : [], 'maps.google.com', 'Google Maps'],
      ['Site', hasSite ? [d.site] : [], 'site', 'Site Oficial']
    ];
    const quickContacts = [
      ['WhatsApp', contacts.whatsapp, 'whatsapp', 'whatsapp'],
      ['Telefone', contacts.phones, 'tel:', 'phone'],
      ['Email', contacts.emails, 'mailto:', 'mail'],
      ['Site', hasSite ? [d.site] : [], 'site', 'globe']
    ];
    const presenceBits = [
      ['Ecommerce', ecommerceConfirmed],
      ['Catálogo', Boolean(commercial.has_catalog)],
      ['Loja física', true],
      ['WhatsApp comercial', normalizeLinks(contacts.whatsapp).length > 0],
      ['SSL', Boolean(hasSite)],
      ['Site ativo', Boolean(hasSite)],
      ['Redes sociais', socialMap.some(([, items]) => normalizeLinks(items).length > 0)]
    ];
    const summaryText = String(company.description || d?.observacao || d?.descricao || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const summaryPreview = summaryText || 'Resumo executivo não informado.';
    const summaryClamped = Boolean(summaryText && !summaryExpanded);
    const commercialProfile = extractCommercialProfile(enrichment);
    const ecommerceCategories = commercialProfile.ecommerce.categories;
    const ecommerceBrands = commercialProfile.ecommerce.brands;
    const ecommerceProducts = commercialProfile.ecommerce.products;
    const ecommercePriceRanges = commercialProfile.ecommerce.price_ranges_by_category;
    const ecommerceStats = commercialProfile.ecommerce.statistics;
    const ecommerceInsights = commercialProfile.ecommerce.insights;
    const instagramCategories = commercialProfile.instagram.categories;
    const instagramBrands = commercialProfile.instagram.brands;
    const instagramHashtags = commercialProfile.instagram.hashtags;
    const instagramPriceRanges = commercialProfile.instagram.price_ranges_by_category;
    const instagramStats = commercialProfile.instagram.statistics;
    const instagramInsights = commercialProfile.instagram.insights;
    const timelineItems = Array.isArray(d?.timeline) ? d.timeline : [];
    const mapFrame = hasCoordinates ? `<iframe title="Mapa do cliente" src="${iframeSrc}" class="cliente360-map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div class="nho2d-crm-empty" style="height:240px;display:flex;align-items:center;justify-content:center">Sem coordenadas para exibir o mapa.</div>';
    const renderPrincipalFields = () => {
      if (editMode) {
        return `<div class="nho2d-single-col">
          ${renderEditField('nho2d-edit-cidade', 'Cidade', editForm?.cidade || '')}
          ${renderEditField('nho2d-edit-estado', 'UF', editForm?.estado || '', 'text', 'maxlength="2"')}
          ${renderEditSelect('nho2d-edit-status', 'Status do cliente', editForm?.status, [
            { value: 'ativo', label: 'ativo' },
            { value: 'inativo', label: 'inativo' },
            { value: 'prospect', label: 'prospect' }
          ])}
          ${renderEditField('nho2d-edit-vendedor', 'Vendedor', editForm?.vendedor_id || '')}
          ${renderEditField('nho2d-edit-documento', 'Documento (CNPJ)', formatCnpj(editForm?.documento || d?.dadosCliente?.documento || ''), 'text', 'disabled readonly')}
          ${renderEditField('nho2d-edit-telefone', 'Telefone', editForm?.telefone || '')}
          ${renderEditField('nho2d-edit-telefone2', 'Telefone secundário', editForm?.telefone2 || '')}
          ${renderEditField('nho2d-edit-email', 'E-mail', editForm?.email || '', 'email')}
          ${renderEditField('nho2d-edit-site', 'Site', editForm?.site || '')}
        </div>`;
      }
      return `<dl class="nho2d-dl nho2d-dl-single">${[
        ['Cidade/UF', [d?.cidade, d?.uf].filter(Boolean).join(' / ') || '-'],
        ['Status do cliente', d?.status || '-'],
        ['Vendedor', d?.dadosCliente?.vendedor || '-'],
        ['Documento (CNPJ)', formatCnpj(d?.dadosCliente?.documento || '') || '-'],
        ['Telefone', d?.dadosCliente?.telefone || '-', 'is-nowrap'],
        ['Telefone secundário', d?.telefone2 || d?.telefone_secundario || '-', 'is-nowrap'],
        ['E-mail', d?.dadosCliente?.email || '-', 'is-nowrap'],
        ['Site', hasSite ? `<a href="${d.site}" target="_blank" rel="noreferrer">${safeText(d.site, 'Site Oficial')}</a>` : '-', 'is-nowrap']
      ].map(([label, value, className = '']) => `<dt class="nho2d-dt">${label}</dt><dd class="nho2d-dd ${className}">${safeValue(value)}</dd>`).join('')}</dl>`;
    };
    return `
      <div class="nho2d-panel-stack">
        <div class="cliente360-relevant-grid">
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Identidade</h3>
                <p>Dados principais em leitura rápida, sem tabela e sem ruído.</p>
              </div>
            </div>
            <div class="cliente360-card-body">
              ${editMode ? `
                <div class="nho2d-header" style="margin-bottom:12px">
                  <div class="nho2d-sub">Controle explícito de edição para os dados principais do cliente.</div>
                  <div class="nho2d-actions">
                    <button id="nho2d-edit-cancel" class="nho2-btn secondary" ${editSaving ? 'disabled' : ''}>Cancelar</button>
                    <button id="nho2d-edit-save" class="nho2-btn" ${editSaving ? 'disabled' : ''}>${editSaving ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </div>
                ${editErrorMessage ? `<div class="nho2d-crm-empty" role="alert" style="margin-bottom:12px">${safeText(editErrorMessage, '')}</div>` : ''}
              ` : ''}
              ${renderPrincipalFields()}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Contato</h3>
                <p>Ações rápidas para copiar ou abrir os canais principais.</p>
              </div>
            </div>
            <div class="nho2d-link-list">
              ${quickContacts.map(([label, items, type, icon]) => {
                const values = normalizeLinks(items);
                const value = values[0] || '';
                const href = linkFor(value, type);
                const display = values.length ? safeText(values[0]) : 'Não informado';
                return `<div class="nho2d-link-item">
                  <div class="nho2d-link-row">
                    <div class="nho2d-link-main">
                      <strong class="nho2d-hero-channel"><span class="nho2d-icon-pill" aria-hidden="true">${icon === 'mail' ? '✉' : icon === 'phone' ? '☎' : icon === 'whatsapp' ? 'W' : '↗'}</span>${label}</strong>
                      <span>${display}</span>
                    </div>
                    <div class="nho2d-inline-actions">
                      ${value ? `<button class="nho2-btn secondary" data-copy-text="${encodeURIComponent(String(value || ''))}">Copiar</button>` : '<span class="nho2d-pill-quiet">Vazio</span>'}
                      ${value ? `<a class="nho2-btn" href="${href}" ${type === 'site' ? 'target="_blank" rel="noreferrer"' : ''}>Abrir</a>` : ''}
                    </div>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Presença Digital</h3>
                <p>Indicadores clicáveis com nomes curtos, sem URLs longas.</p>
              </div>
              <span class="nho2d-pill-quiet">${lastDigitalUpdate ? `Atualizado ${formatDateFriendly(lastDigitalUpdate)}` : 'Sem sincronização recente'}</span>
            </div>
            <div class="nho2d-link-list">
              ${(() => {
                const channels = [
                  ['Instagram', normalizeLinks(social.instagram), 'instagram.com', 'Instagram'],
                  ['Facebook', normalizeLinks(social.facebook), 'facebook.com', 'Facebook'],
                  ['LinkedIn', normalizeLinks(social.linkedin), 'linkedin.com', 'LinkedIn'],
                  ['YouTube', normalizeLinks(social.youtube), 'youtube.com', 'YouTube'],
                  ['TikTok', normalizeLinks(social.tiktok), 'tiktok.com', 'TikTok'],
                  ['Google Maps', normalizeLinks((d?.geolocalizacao_status || '').toLowerCase() === 'sucesso' && d?.google_maps_link ? [d.google_maps_link] : []), 'maps.google.com', 'Google Maps'],
                  ['Site', normalizeLinks(hasSite ? [d.site] : []), 'site', 'Site Oficial']
                ].filter(([, values]) => values.length > 0);
                return channels.length ? channels.map(([label, values, _domain, fallbackLabel]) => {
                  const value = values[0];
                  const href = linkFor(value, label === 'Google Maps' || label === 'Site' ? 'site' : 'site');
                  return `<a class="nho2d-link-item is-link" href="${href}" target="${label === 'Site' || label === 'Google Maps' ? '_blank' : '_self'}" rel="${label === 'Site' || label === 'Google Maps' ? 'noreferrer' : ''}">
                    <div class="nho2d-link-row">
                      <div class="nho2d-link-main">
                        <strong class="nho2d-hero-channel"><span class="nho2d-icon-pill" aria-hidden="true">${socialIndicator(values)}</span>${fallbackLabel}</strong>
                        <span>${safeText(value)}</span>
                      </div>
                      <span class="nho2d-pill-quiet">Abrir</span>
                    </div>
                  </a>`;
                }).join('') : '<div class="nho2d-digital-empty">Nenhum canal digital confirmado.</div>';
              })()}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Presença Comercial</h3>
                <p>Checklist executivo da estrutura comercial percebida no cliente.</p>
              </div>
            </div>
            <div class="nho2d-checklist">
              ${presenceBits.map(([label, value]) => `<div class="nho2d-checklist-item"><span class="nho2d-checkmark ${value ? 'is-on' : 'is-off'}">${value ? '✓' : '•'}</span><span>${label}</span></div>`).join('')}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Categorias e preços - Ecommerce</h3>
                <p>Leitura do catálogo, marcas e faixas de preço percebidas no site.</p>
              </div>
            </div>
            <div class="nho2d-stack">
              <div class="nho2d-kpi-grid">
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Produtos detectados</div><div class="nho2d-kpi-value">${safeText(ecommerceStats.products_count, '0')}</div></div>
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Marcas</div><div class="nho2d-kpi-value">${safeText(ecommerceStats.brands_count, '0')}</div></div>
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Preço médio</div><div class="nho2d-kpi-value">${ecommerceStats.average_price !== null ? fmtCurrency(ecommerceStats.average_price) : '-'}</div></div>
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Categorias</div><div class="nho2d-kpi-value">${safeText(ecommerceStats.categories_count, '0')}</div></div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Categorias</div>
                <div class="nho2d-chip-row is-tight">${ecommerceCategories.length ? ecommerceCategories.map((item) => `<span class="nho2d-chip">${safeText(item)}</span>`).join('') : '<span class="nho2d-chip is-muted">Sem categorias inferidas</span>'}</div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Marcas</div>
                <div class="nho2d-chip-row is-tight">${ecommerceBrands.length ? ecommerceBrands.map((item) => `<span class="nho2d-chip is-muted">${safeText(item)}</span>`).join('') : '<span class="nho2d-chip is-muted">Sem marcas inferidas</span>'}</div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Média / faixa de preço por categoria</div>
                <div class="nho2d-table-wrap">${ecommercePriceRanges.length ? `<table class="nho2d-table"><thead><tr><th>Categoria</th><th>Média</th><th>Mínimo</th><th>Máximo</th><th>Amostras</th></tr></thead><tbody>${ecommercePriceRanges.map((item) => `<tr><td>${safeText(item.category)}</td><td>${item.avg_price !== null ? fmtCurrency(item.avg_price) : '-'}</td><td>${item.min_price !== null ? fmtCurrency(item.min_price) : '-'}</td><td>${item.max_price !== null ? fmtCurrency(item.max_price) : '-'}</td><td>${safeText(item.sample_count, '0')}</td></tr>`).join('')}</tbody></table>` : '<div class="nho2d-crm-empty">Nenhum preço detectado no Ecommerce.</div>'}</div>
              </div>
              ${ecommerceProducts.length ? `<div><div class="nho2d-dt" style="margin-bottom:8px">Produtos detectados</div><div class="nho2d-stack">${ecommerceProducts.slice(0, 6).map((item) => `<div class="nho2d-crm-empty"><strong>${safeText(item.name)}</strong><div class="nho2d-item-note">${safeText(item.brand || 'Sem marca')} • ${safeText(item.category || 'Geral')} • ${item.price !== null ? fmtCurrency(item.price) : 'Preço não informado'}</div></div>`).join('')}</div></div>` : ''}
              ${ecommerceInsights.length ? `<div><div class="nho2d-dt" style="margin-bottom:8px">Insights</div><div class="nho2d-chip-row is-tight">${ecommerceInsights.map((item) => `<span class="nho2d-chip is-muted">${safeText(item)}</span>`).join('')}</div></div>` : ''}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Categorias e marcas - Instagram</h3>
                <p>Leitura por bio, legenda, hashtags e menções disponíveis no payload.</p>
              </div>
            </div>
            <div class="nho2d-stack">
              <div class="nho2d-kpi-grid">
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Categorias</div><div class="nho2d-kpi-value">${safeText(instagramStats.categories_count, '0')}</div></div>
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Marcas</div><div class="nho2d-kpi-value">${safeText(instagramStats.brands_count, '0')}</div></div>
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Preço médio</div><div class="nho2d-kpi-value">${instagramStats.average_price !== null ? fmtCurrency(instagramStats.average_price) : '-'}</div></div>
                <div class="nho2d-kpi"><div class="nho2d-kpi-label">Posts com preço</div><div class="nho2d-kpi-value">${safeText(instagramStats.products_count, '0')}</div></div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Categorias</div>
                <div class="nho2d-chip-row is-tight">${instagramCategories.length ? instagramCategories.map((item) => `<span class="nho2d-chip">${safeText(item)}</span>`).join('') : '<span class="nho2d-chip is-muted">Sem categorias inferidas</span>'}</div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Marcas</div>
                <div class="nho2d-chip-row is-tight">${instagramBrands.length ? instagramBrands.map((item) => `<span class="nho2d-chip is-muted">${safeText(item)}</span>`).join('') : '<span class="nho2d-chip is-muted">Sem marcas inferidas</span>'}</div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Hashtags</div>
                <div class="nho2d-chip-row is-tight">${instagramHashtags.length ? instagramHashtags.map((item) => `<span class="nho2d-chip is-muted">${safeText(item)}</span>`).join('') : '<span class="nho2d-chip is-muted">Sem hashtags identificadas</span>'}</div>
              </div>
              <div>
                <div class="nho2d-dt" style="margin-bottom:8px">Preços identificados</div>
                <div class="nho2d-table-wrap">${instagramPriceRanges.length ? `<table class="nho2d-table"><thead><tr><th>Categoria</th><th>Média</th><th>Mínimo</th><th>Máximo</th><th>Amostras</th></tr></thead><tbody>${instagramPriceRanges.map((item) => `<tr><td>${safeText(item.category)}</td><td>${item.avg_price !== null ? fmtCurrency(item.avg_price) : '-'}</td><td>${item.min_price !== null ? fmtCurrency(item.min_price) : '-'}</td><td>${item.max_price !== null ? fmtCurrency(item.max_price) : '-'}</td><td>${safeText(item.sample_count, '0')}</td></tr>`).join('')}</tbody></table>` : '<div class="nho2d-crm-empty">Sem preços explícitos no Instagram.</div>'}</div>
              </div>
              ${instagramInsights.length ? `<div><div class="nho2d-dt" style="margin-bottom:8px">Insights</div><div class="nho2d-chip-row is-tight">${instagramInsights.map((item) => `<span class="nho2d-chip is-muted">${safeText(item)}</span>`).join('')}</div></div>` : ''}
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Sobre a empresa</h3>
                <p>Resumo executivo curto para decisão rápida antes da conversa.</p>
              </div>
              ${summaryText ? `<button id="nho2d-summary-toggle" class="nho2-btn secondary" type="button">${summaryExpanded ? 'Ver menos' : 'Ver mais'}</button>` : ''}
            </div>
            <div class="nho2d-dd ${summaryClamped ? 'is-clamped' : ''}">${safeText(summaryPreview, 'Resumo executivo não informado.')}</div>
          </article>
        </div>
        <div class="nho2d-panel-grid nho2d-panel-grid--map">
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Localização</h3>
                <p>Visão geográfica, sem dominar a área principal da tela.</p>
              </div>
            </div>
            <div style="min-width:0;overflow:hidden;border-radius:12px;height:100%">${mapFrame}</div>
            <div class="nho2d-inline-actions" style="margin-top:12px">
              <button id="nho2d-geocode" class="nho2-btn secondary" data-map-url="${d?.google_maps_url || ''}" ${geolocationLoading ? 'disabled' : ''}>${geolocationLoading ? 'Geolocalizando...' : 'Abrir no mapa'}</button>
            </div>
          </article>
          <article class="nho2d-card">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Resumo operacional</h3>
                <p>Contexto de integração, sincronização e prontidão operacional.</p>
              </div>
            </div>
            ${cardFields([
              ['Endereço', [d?.logradouro, d?.numero].filter(Boolean).join(', ') || '-'],
              ['Enriquecimento', enrichmentStatus],
              ['Geolocalização', geolocationStatus],
              ['Timeline', timelineCount],
              ['Radar', hasAnyDigitalInsight(enrichment) ? 'Disponível' : 'Pendente'],
              ['Última sincronização', formatDateFriendly(d?.sincronizado_em || d?.updated_at || d?.updatedAt)]
            ])}
          </article>
        </div>
        <div class="nho2d-panel-grid">
          <article class="nho2d-card" style="grid-column:1 / -1">
            <div class="nho2d-card-head">
              <div class="nho2d-card-title">
                <h3>Timeline</h3>
                <p>Últimos eventos do cliente em leitura horizontal.</p>
              </div>
              <button id="nho2d-timeline-refresh" class="nho2-btn secondary">Ver histórico</button>
            </div>
            ${timelineItems.length ? `<div class="nho2d-timeline-horizontal">${timelineItems.slice(0, 5).map((item) => `
              <div class="nho2d-timeline-event">
                <div class="nho2d-timeline-event-icon">${getTimelineIcon(item.categoria)}</div>
                <div class="nho2d-timeline-event-title">${safeText(item.titulo, 'Evento')}</div>
                <div class="nho2d-timeline-event-date">${formatDateFriendly(item.created_at)}</div>
              </div>`).join('')}<button id="nho2d-timeline-full" class="nho2-btn secondary">Ver histórico</button></div>` : '<div class="nho2d-crm-empty">Nenhum evento registrado ainda.</div>'}
          </article>
        </div>
      </div>
    `;
  }

  function renderEnriquecimento(d) {
    const status = safeValue(d?.enriquecimento_status ? String(d.enriquecimento_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <div class="nho2d-header" style="margin-bottom:12px">
            <div>
              <h3 style="margin:0 0 4px">Enriquecimento</h3>
              <div class="nho2d-sub">Consulta manual da BrasilAPI por CNPJ.</div>
            </div>
            <button id="nho2d-enrich" class="nho2-btn secondary" ${enrichmentLoading ? 'disabled' : ''}>${enrichmentLoading ? 'Enriquecendo dados...' : 'Enriquecer CNPJ'}</button>
          </div>
          ${feedbackMessage ? `<div class="nho2d-crm-empty" style="margin-bottom:12px">${safeText(feedbackMessage, '')}</div>` : ''}
          <dl class="nho2d-dl">
            <dt class="nho2d-dt">Status do enriquecimento</dt><dd class="nho2d-dd">${status}</dd>
            <dt class="nho2d-dt">Última execução</dt><dd class="nho2d-dd">${formatDateFriendly(d?.enriquecimento_ultima_execucao)}</dd>
            <dt class="nho2d-dt">Fonte</dt><dd class="nho2d-dd">${safeValue(d?.enriquecimento_fonte)}</dd>
            <dt class="nho2d-dt">Erro</dt><dd class="nho2d-dd">${safeValue(d?.enriquecimento_erro)}</dd>
          </dl>
        </article>
        <article class="nho2d-card">
          <h3>Dados oficiais</h3>
          <dl class="nho2d-dl">
            <dt class="nho2d-dt">Razão social</dt><dd class="nho2d-dd">${safeValue(d?.razao_social)}</dd>
            <dt class="nho2d-dt">Nome fantasia</dt><dd class="nho2d-dd">${safeValue(d?.nome_fantasia)}</dd>
            <dt class="nho2d-dt">Situação cadastral</dt><dd class="nho2d-dd">${safeValue(d?.situacao_cadastral)}</dd>
            <dt class="nho2d-dt">Data de abertura</dt><dd class="nho2d-dd">${d?.data_abertura ? formatDisplayDate(d.data_abertura) : 'Não informado'}</dd>
            <dt class="nho2d-dt">CNAE principal</dt><dd class="nho2d-dd">${safeValue(d?.cnae_principal)}</dd>
          </dl>
        </article>
        <article class="nho2d-card">
          <h3>Contato enriquecido</h3>
          <dl class="nho2d-dl">
            <dt class="nho2d-dt">E-mail enriquecido</dt><dd class="nho2d-dd">${safeValue(d?.email_enriquecido)}</dd>
            <dt class="nho2d-dt">Telefone enriquecido</dt><dd class="nho2d-dd">${safeValue(d?.telefone_enriquecido)}</dd>
          </dl>
        </article>
        <article class="nho2d-card">
          <h3>Endereço oficial</h3>
          <dl class="nho2d-dl">
            <dt class="nho2d-dt">CEP</dt><dd class="nho2d-dd">${safeValue(d?.cep)}</dd>
            <dt class="nho2d-dt">Logradouro</dt><dd class="nho2d-dd">${safeValue(d?.logradouro)}</dd>
            <dt class="nho2d-dt">Número</dt><dd class="nho2d-dd">${safeValue(d?.numero)}</dd>
            <dt class="nho2d-dt">Complemento</dt><dd class="nho2d-dd">${safeValue(d?.complemento)}</dd>
            <dt class="nho2d-dt">Bairro</dt><dd class="nho2d-dd">${safeValue(d?.bairro)}</dd>
            <dt class="nho2d-dt">Cidade</dt><dd class="nho2d-dd">${safeValue(d?.cidade)}</dd>
            <dt class="nho2d-dt">Estado</dt><dd class="nho2d-dd">${safeValue(d?.uf)}</dd>
          </dl>
        </article>
      </div>
    `;
  }

  function renderGeolocalizacao(d) {
    const status = safeValue(d?.geolocalizacao_status ? String(d.geolocalizacao_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    const hasCoordinates = Number.isFinite(Number(d?.latitude)) && Number.isFinite(Number(d?.longitude));
    const iframeSrc = hasCoordinates ? `https://maps.google.com/maps?q=${d.latitude},${d.longitude}&z=15&output=embed` : '';
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <div class="nho2d-header" style="margin-bottom:12px">
            <div>
              <h3 style="margin:0 0 4px">Geolocalização</h3>
              <div class="nho2d-sub">Consulta manual do endereço do cliente via Nominatim/OpenStreetMap.</div>
            </div>
            <button id="nho2d-geocode" class="nho2-btn secondary" data-map-url="${d?.google_maps_url || ''}" ${geolocationLoading ? 'disabled' : ''}>${geolocationLoading ? 'Geolocalizando...' : 'Geolocalizar Cliente'}</button>
          </div>
          ${feedbackMessage ? `<div class="nho2d-crm-empty" style="margin-bottom:12px">${safeText(feedbackMessage, '')}</div>` : ''}
          <dl class="nho2d-dl">
            <dt class="nho2d-dt">Status</dt><dd class="nho2d-dd">${status}</dd>
            <dt class="nho2d-dt">Fonte</dt><dd class="nho2d-dd">${safeValue(d?.geolocalizacao_fonte)}</dd>
            <dt class="nho2d-dt">Latitude</dt><dd class="nho2d-dd">${safeValue(d?.latitude)}</dd>
            <dt class="nho2d-dt">Longitude</dt><dd class="nho2d-dd">${safeValue(d?.longitude)}</dd>
            <dt class="nho2d-dt">Última execução</dt><dd class="nho2d-dd">${formatDateFriendly(d?.geolocalizacao_ultima_execucao)}</dd>
            <dt class="nho2d-dt">Google Maps</dt><dd class="nho2d-dd">${d?.google_maps_link ? `<a href="${d.google_maps_link}" target="_blank" rel="noreferrer">Abrir no Google Maps</a>` : d?.google_maps_url ? `<a href="${d.google_maps_url}" target="_blank" rel="noreferrer">Abrir no Google Maps</a>` : 'Não informado'}</dd>
            <dt class="nho2d-dt">Erro</dt><dd class="nho2d-dd">${safeValue(d?.geolocalizacao_erro)}</dd>
          </dl>
        </article>
        ${hasCoordinates ? `<article class="nho2d-card"><h3>Mapa</h3><iframe title="Mapa do cliente" src="${iframeSrc}" style="width:100%;height:340px;border:0;border-radius:12px" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></article>` : ''}
      </div>
    `;
  }

  function renderTimeline(d) {
    const items = Array.isArray(d?.timeline) ? d.timeline : [];
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <div class="nho2d-card-head">
            <div class="nho2d-card-title">
              <h3>Últimos eventos na Timeline</h3>
              <p>Acompanhe o histórico de atualizações do Cliente 360.</p>
            </div>
            <button id="nho2d-timeline-refresh" class="nho2-btn secondary">Atualizar</button>
          </div>
          ${items.length ? `<div class="nho2d-timeline-horizontal">${items.slice(0, 5).map((item) => `
            <div class="nho2d-timeline-event">
              <div class="nho2d-timeline-event-icon">${getTimelineIcon(item.categoria)}</div>
              <div class="nho2d-timeline-event-title">${safeText(item.titulo, 'Evento')}</div>
              <div class="nho2d-timeline-event-date">${formatDateFriendly(item.created_at)}</div>
            </div>`).join('')}${items.length > 5 ? `<button id="nho2d-timeline-full" class="nho2-btn secondary">Ver timeline completa</button>` : ''}</div>` : '<div class="nho2d-crm-empty">Nenhum evento registrado ainda.</div>'}
        </article>
      </div>
    `;
  }

  function renderRadar() {
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <h3>Radar</h3>
          <div class="nho2d-crm-empty">Use o Radar Comercial para análises consolidadas da carteira.</div>
        </article>
      </div>
    `;
  }

  function renderWhatsappConversationItem(conversation) {
    const active = String(whatsappActiveConversationId || '') === String(conversation?.id || '');
    const instanceType = String(conversation?.instance_type || 'operational');
    return `<button class="nho2d-whatsapp-item ${active ? 'is-active' : ''}" data-whatsapp-conversation-id="${conversation.id}">
      <div class="nho2d-whatsapp-head">
        <div class="nho2d-whatsapp-title">${safeText(conversation.contact_name || conversation.phone || 'Conversa')}</div>
        <span class="nho2-badge">${safeText(instanceType, 'operational')}</span>
      </div>
      <div class="nho2d-whatsapp-meta">
        <span><strong>Última msg:</strong> ${formatDateFriendly(conversation.last_message_at)}</span>
        <span><strong>Mensagens:</strong> ${conversation.message_count ?? 0}</span>
        <span><strong>Direção:</strong> ${safeText(conversation.direction_last_message, '-')}</span>
      </div>
      <div class="nho2d-whatsapp-preview">${safeText(conversation.last_message_preview || 'Sem prévia')}</div>
    </button>`;
  }

  function renderWhatsapp(d) {
    const conversations = Array.isArray(d?.whatsappConversations) ? d.whatsappConversations : [];
    const activeConversation = conversations.find((conversation) => String(conversation?.id || '') === String(whatsappActiveConversationId || '')) || conversations[0] || null;
    const messages = activeConversation ? (whatsappMessagesCache.get(activeConversation.id) || []) : [];
    return `<div class="nho2d-section">
      <article class="nho2d-card">
        <div class="nho2d-header" style="margin-bottom:12px">
          <div>
            <h3 style="margin:0 0 4px">WhatsApp</h3>
            <div class="nho2d-sub">Aba somente leitura com conversas vinculadas ao cliente e histórico da conversa selecionada.</div>
          </div>
        </div>
        ${whatsappLoading ? '<div class="nho2d-mini-loading">Carregando conversas...</div>' : ''}
        ${conversations.length ? `<div class="nho2d-whatsapp"><div class="nho2d-whatsapp-list">${conversations.map((conversation) => renderWhatsappConversationItem(conversation)).join('')}</div><div class="nho2d-card" style="margin:0"><div class="nho2d-header" style="margin-bottom:12px"><div><h3 style="margin:0 0 4px">${safeText(activeConversation?.contact_name || activeConversation?.phone || 'Conversa')}</h3><div class="nho2d-sub">${safeText(activeConversation?.instance_name || 'Instância não informada')} • ${safeText(activeConversation?.instance_type || 'operational')}</div></div></div>${whatsappMessagesLoading ? '<div class="nho2d-mini-loading">Carregando mensagens...</div>' : messages.length ? `<div class="nho2d-whatsapp-thread">${messages.map((message) => `<div class="nho2d-whatsapp-msg ${message.direction === 'inbound' ? 'is-inbound' : 'is-outbound'}"><div>${safeText(message.text, message.message_type || 'Mensagem')}</div><div class="nho2d-whatsapp-msg-meta">${formatDateFriendly(message.sent_at || message.created_at)}</div></div>`).join('')}</div>` : '<div class="nho2d-crm-empty">Selecione uma conversa para ver as mensagens.</div>'}</div></div>` : '<div class="nho2d-crm-empty">Nenhuma conversa WhatsApp vinculada a este cliente.</div>'}
      </article>
    </div>`;
  }

  function renderGruposComerciais(d) {
    const grupos = Array.isArray(d?.gruposComerciais) ? d.gruposComerciais : [];
    return `<article class="nho2d-card"><h3>Grupos Comerciais</h3>${grupos.length ? `<div class="nho2d-stack">${grupos.map((grupo) => `<div class="nho2d-crm-empty"><strong>${safeText(grupo.nome)}</strong>${grupo.descricao ? `<div class="nho2d-item-note">${safeText(grupo.descricao)}</div>` : ''}</div>`).join('')}</div>` : '<div class="nho2d-crm-empty">Nenhum grupo comercial vinculado.</div>'}</article>`;
  }

  function renderContent() {
    if (state.loading) return '<section class="nho2d-shell nho2-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></section>';
    if (state.error) return '<section class="nho2d-shell nho2-state">Não foi possível carregar o cliente.<br/><br/><button id="nhcd-retry" class="nho2-btn">Tentar novamente</button></section>';
    if (state.notFound || !state.data?.id) return '<section class="nho2d-shell nho2-state">Cliente não encontrado.</section>';

    const d = state.data;
    return `<section class="nho2d-shell">
      ${renderHeader(d)}
      ${activeTab === 'geral' ? renderGeral(d) : ''}
      ${activeTab === 'dados-relevantes' ? renderDadosRelevantes(d) : ''}
      ${activeTab === 'comercial' ? renderComercial(d) : ''}
      ${activeTab === 'alertas' ? renderAlertas(d) : ''}
      ${activeTab === 'timeline' ? renderTimeline(d) : ''}
      ${activeTab === 'radar' ? renderRadar(d) : ''}
    </section>`;
  }

  function syncPedidoState() {
    state.data = {
      ...state.data,
      ultimosPedidos: (state.data?.ultimosPedidos || []).map((pedido) => ({
        ...pedido,
        itens: pedidoItemDetails.has(pedido.id) ? pedidoItemDetails.get(pedido.id) : pedido.itens
      })),
      pedidosAgrupados: (state.data?.pedidosAgrupados || []).map((group) => ({
        ...group,
        pedidos: Array.isArray(group.pedidos)
          ? group.pedidos.map((pedido) => ({
              ...pedido,
              itens: pedidoItemDetails.has(pedido.id) ? pedidoItemDetails.get(pedido.id) : pedido.itens
            }))
          : group.pedidos
      }))
    };
  }

  function render() {
    injectStyles();
    root.innerHTML = `<div class="nho2d-wrap">${renderContent()}</div>`;
    const retry = root.querySelector('#nhcd-retry');
    if (retry) retry.onclick = () => load();
    const back = root.querySelector('#nhcd-back');
    if (back) back.onclick = () => { window.location.hash = '#/clientes'; };
    const editStart = root.querySelector('#nho2d-edit-start');
    if (editStart) editStart.onclick = () => startEditMode();
    const editCancel = root.querySelector('#nho2d-edit-cancel');
    if (editCancel) editCancel.onclick = () => cancelEditMode();
    const bindEditInput = (selector, key) => {
      const input = root.querySelector(selector);
      if (!input) return;
      input.oninput = (event) => {
        editForm = { ...(editForm || buildEditForm(state.data)), [key]: event.target.value };
      };
    };
    if (editMode) {
      bindEditInput('#nho2d-edit-nome', 'nome');
      bindEditInput('#nho2d-edit-cidade', 'cidade');
      bindEditInput('#nho2d-edit-estado', 'estado');
      bindEditInput('#nho2d-edit-vendedor', 'vendedor_id');
      bindEditInput('#nho2d-edit-documento', 'documento');
      bindEditInput('#nho2d-edit-telefone', 'telefone');
      bindEditInput('#nho2d-edit-telefone2', 'telefone2');
      bindEditInput('#nho2d-edit-email', 'email');
      bindEditInput('#nho2d-edit-site', 'site');
      bindEditInput('#nho2d-edit-razao-social', 'razao_social');
      const statusInput = root.querySelector('#nho2d-edit-status');
      if (statusInput) {
        statusInput.onchange = (event) => {
          editForm = { ...(editForm || buildEditForm(state.data)), status: event.target.value };
        };
      }
      const editSave = root.querySelector('#nho2d-edit-save');
      if (editSave) {
        editSave.onclick = async () => {
          if (!editForm) return;
          editSaving = true;
          editErrorMessage = '';
          render();
          try {
            const payload = {
              nome: String(editForm.nome || '').trim(),
              razao_social: String(editForm.razao_social || '').trim(),
              cidade: String(editForm.cidade || '').trim() || null,
              estado: String(editForm.estado || '').trim() || null,
              status: String(editForm.status || '').trim() || null,
              vendedor_id: String(editForm.vendedor_id || '').trim() || null,
              documento: String(editForm.documento || '').trim() || null,
              telefone: String(editForm.telefone || '').trim() || null,
              telefone2: String(editForm.telefone2 || '').trim() || null,
              email: String(editForm.email || '').trim() || null,
              site: String(editForm.site || '').trim() || null
            };
            await atualizarCliente(apiClient, clienteId, payload);
            state.data = await fetchClienteDetailsData(apiClient, clienteId);
            editMode = false;
            editForm = null;
            editErrorMessage = '';
            feedbackMessage = 'Dados do cliente atualizados com sucesso.';
          } catch (error) {
            editErrorMessage = error?.body?.error?.message || error?.message || 'Falha ao salvar cliente.';
          } finally {
            editSaving = false;
            render();
          }
        };
      }
    }
    root.querySelectorAll('[data-tab]').forEach((button) => {
      button.onclick = () => { activeTab = button.getAttribute('data-tab') || 'dados-relevantes'; render(); };
    });
    root.querySelectorAll('[data-copy-text]').forEach((button) => {
      button.onclick = async () => {
        const text = decodeURIComponent(String(button.getAttribute('data-copy-text') || '').trim());
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          feedbackMessage = 'Valor copiado para a área de transferência.';
        } catch {
          feedbackMessage = 'Não foi possível copiar automaticamente.';
        }
        render();
      };
    });
    const summaryToggle = root.querySelector('#nho2d-summary-toggle');
    if (summaryToggle) {
      summaryToggle.onclick = () => {
        summaryExpanded = !summaryExpanded;
        render();
      };
    }
    root.querySelectorAll('[data-open-url]').forEach((button) => {
      button.onclick = () => {
        const url = decodeURIComponent(String(button.getAttribute('data-open-url') || '').trim());
        if (!url) return;
        const resolved = url.startsWith('http') ? url : `https://${url}`;
        window.open(resolved, '_blank', 'noopener,noreferrer');
      };
    });
    const enrichBtn = root.querySelector('#nho2d-enrich');
    if (enrichBtn) {
      enrichBtn.onclick = async () => {
        webDiscoveryLoading = true;
        webDiscoveryMessage = 'Descobrindo site oficial...';
        render();
        try {
          await discoverClienteWebsite(apiClient, clienteId);
          state.data = await fetchClienteDetailsData(apiClient, clienteId);
          webDiscoveryMessage = 'Enriquecimento digital concluído com sucesso.';
        } catch (error) {
          webDiscoveryMessage = error?.body?.error?.message || error?.message || 'Falha ao enriquecer digitalmente.';
        } finally {
          webDiscoveryLoading = false;
          render();
        }
      };
    }
    const geocodeBtn = root.querySelector('#nho2d-geocode');
    if (geocodeBtn) {
      geocodeBtn.onclick = async () => {
        const mapUrl = String(geocodeBtn.getAttribute('data-map-url') || '').trim();
        if (mapUrl) {
          window.open(mapUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        geolocationLoading = true;
        feedbackMessage = 'Geolocalizando cliente...';
        render();
        try {
          const response = await geolocalizarCliente(apiClient, clienteId);
          state.data = response?.cliente ? { ...state.data, ...response.cliente } : state.data;
          const timeline = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
          state.data = { ...state.data, timeline: Array.isArray(timeline?.items) ? timeline.items : [] };
          feedbackMessage = response?.resultado?.status === 'sucesso' ? 'Cliente geolocalizado com sucesso.' : (response?.resultado?.erro || 'Geolocalização concluída.');
        } catch (error) {
          feedbackMessage = error?.message || 'Falha ao geolocalizar cliente.';
        } finally {
          geolocationLoading = false;
          render();
        }
      };
    }
    const webDiscoveryBtn = root.querySelector('#nho2d-web-discovery');
    if (webDiscoveryBtn) {
      webDiscoveryBtn.onclick = async () => {
        webDiscoveryLoading = true;
        webDiscoveryMessage = 'Descobrindo site oficial...';
        render();
        try {
          const response = await discoverClienteWebsite(apiClient, clienteId);
          const result = response?.data || response || {};
          state.data = await fetchClienteDetailsData(apiClient, clienteId);
          if (result?.found && result?.site) {
            state.data = { ...state.data, site: result.site };
            webDiscoveryMessage = result.source === 'existing' ? 'O cliente já tinha site cadastrado.' : 'Site oficial descoberto com sucesso.';
          } else {
            webDiscoveryMessage = 'Nenhum site confiável foi identificado.';
          }
        } catch (error) {
          webDiscoveryMessage = error?.body?.error?.message || error?.message || 'Falha ao descobrir site.';
        } finally {
          webDiscoveryLoading = false;
          render();
        }
      };
    }
    const scoreBtn = root.querySelector('#nho2d-score');
    if (scoreBtn) {
      scoreBtn.onclick = async () => {
        scoreLoading = true;
        feedbackMessage = 'Calculando score comercial...';
        render();
        try {
          const response = await calcularScoreCliente(apiClient, clienteId);
          state.data = response?.cliente ? { ...state.data, ...response.cliente } : state.data;
          const timeline = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
          state.data = { ...state.data, timeline: Array.isArray(timeline?.items) ? timeline.items : [] };
          feedbackMessage = 'Score comercial calculado com sucesso.';
        } catch (error) {
          feedbackMessage = error?.message || 'Falha ao calcular score comercial.';
        } finally {
          scoreLoading = false;
          render();
        }
      };
    }
    const segmentacaoBtn = root.querySelector('#nho2d-segmentacao');
    if (segmentacaoBtn) {
      segmentacaoBtn.onclick = async () => {
        scoreLoading = true;
        feedbackMessage = 'Calculando segmentação comercial...';
        render();
        try {
          const response = await calcularSegmentacaoCliente(apiClient, clienteId);
          state.data = response?.cliente ? { ...state.data, ...response.cliente } : state.data;
          const timeline = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
          state.data = { ...state.data, timeline: Array.isArray(timeline?.items) ? timeline.items : [] };
          feedbackMessage = `Segmentação atualizada para ${response?.segmentacao?.segmento || state.data?.segmento_comercial || 'INATIVO'}.`;
        } catch (error) {
          feedbackMessage = error?.message || 'Falha ao calcular segmentação comercial.';
        } finally {
          scoreLoading = false;
          render();
        }
      };
    }
    const alertsBtn = root.querySelector('#nho2d-alerts-generate');
    if (alertsBtn) {
      alertsBtn.onclick = async () => {
        alertsLoading = true;
        alertMessage = 'Gerando alertas comerciais...';
        render();
        try {
          await gerarAlertasCliente(apiClient, clienteId);
          const response = await fetchAlertasCliente(apiClient, clienteId);
          state.data = { ...state.data, cliente_alertas: Array.isArray(response?.items) ? response.items : [] };
          const timeline = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
          state.data = { ...state.data, timeline: Array.isArray(timeline?.items) ? timeline.items : [] };
          alertMessage = 'Alertas gerados com sucesso.';
        } catch (error) {
          alertMessage = error?.message || 'Falha ao gerar alertas.';
        } finally {
          alertsLoading = false;
          render();
        }
      };
    }
    root.querySelectorAll('[data-resolver-alerta]').forEach((button) => {
      button.onclick = async () => {
        const alertaId = button.getAttribute('data-resolver-alerta');
        alertMessage = 'Atualizando alerta...';
        render();
        try {
          await resolverAlertaCliente(apiClient, alertaId);
          const response = await fetchAlertasCliente(apiClient, clienteId);
          state.data = { ...state.data, cliente_alertas: Array.isArray(response?.items) ? response.items : [] };
          const timeline = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
          state.data = { ...state.data, timeline: Array.isArray(timeline?.items) ? timeline.items : [] };
          alertMessage = 'Alerta resolvido.';
        } catch (error) {
          alertMessage = error?.message || 'Falha ao resolver alerta.';
        } finally {
          render();
        }
      };
    });
    const timelineRefresh = root.querySelector('#nho2d-timeline-refresh');
    if (timelineRefresh) {
      timelineRefresh.onclick = async () => {
        const response = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
        state.data = { ...state.data, timeline: Array.isArray(response?.items) ? response.items : [] };
        render();
      };
    }
    const timelineFull = root.querySelector('#nho2d-timeline-full');
    if (timelineFull) {
      timelineFull.onclick = () => {
        activeTab = 'timeline';
        render();
      };
    }
    root.querySelectorAll('[data-toggle-group]').forEach((button) => {
      button.onclick = () => {
        const groupKey = button.getAttribute('data-toggle-group');
        const current = groupAccordionState.get(groupKey) ?? false;
        groupAccordionState.set(groupKey, !current);
        render();
      };
    });
    root.querySelectorAll('[data-toggle-pedido]').forEach((button) => {
      button.onclick = async () => {
        const pedidoId = button.getAttribute('data-toggle-pedido');
        const current = pedidoAccordionState.get(pedidoId) ?? false;
        pedidoAccordionState.set(pedidoId, !current);
        if (!current && !pedidoItemDetails.has(pedidoId) && !pedidoItemLoading.has(pedidoId)) {
          pedidoItemLoading.add(pedidoId);
          render();
          try {
            const detail = await fetchPedidoDetailsForCliente(apiClient, pedidoId);
            const itens = Array.isArray(detail?.itens) ? detail.itens : Array.isArray(detail?.item?.itens) ? detail.item.itens : [];
            pedidoItemDetails.set(pedidoId, itens);
            syncPedidoState();
          } catch {
            pedidoItemDetails.set(pedidoId, []);
          } finally {
            pedidoItemLoading.delete(pedidoId);
            render();
          }
          return;
        }
        render();
      };
    });
    root.querySelectorAll('[data-toggle-variation-group]').forEach((button) => {
      button.onclick = () => {
        const groupKey = button.getAttribute('data-toggle-variation-group');
        const current = pedidoAccordionState.get(groupKey) ?? false;
        pedidoAccordionState.set(groupKey, !current);
        render();
      };
    });
    root.querySelectorAll('[data-whatsapp-conversation-id]').forEach((button) => {
      button.onclick = async () => {
        const conversationId = button.getAttribute('data-whatsapp-conversation-id');
        whatsappActiveConversationId = conversationId;
        if (!whatsappMessagesCache.has(conversationId)) {
          whatsappMessagesLoading = true;
          render();
          try {
            const response = await fetchWhatsappConversationMessagesCliente(apiClient, clienteId, conversationId);
            whatsappMessagesCache.set(conversationId, Array.isArray(response?.items) ? response.items : []);
          } catch {
            whatsappMessagesCache.set(conversationId, []);
          } finally {
            whatsappMessagesLoading = false;
            render();
          }
          return;
        }
        render();
      };
    });
  }

  async function load() {
    state.loading = true;
    state.error = false;
    state.notFound = false;
      syncLoading = false;
      syncMessage = '';
      webDiscoveryLoading = false;
      webDiscoveryMessage = '';
      render();
    try {
      state.data = await fetchClienteDetailsData(apiClient, clienteId);
      if (!state?.data?.id) state.notFound = true;
      syncLoading = true;
      render();
      try {
        const syncResponse = await sincronizarCliente360(apiClient, clienteId);
        if (syncResponse?.item) {
          state.data = { ...state.data, ...syncResponse.item };
        }
        const resumo = syncResponse?.resumo || {};
        const updates = Array.isArray(resumo.changes) ? resumo.changes.length : 0;
        const errors = Array.isArray(resumo.errors) ? resumo.errors.length : 0;
        syncMessage = updates || errors
          ? `${updates ? `${updates} campo(s) atualizados` : 'Sincronização concluída'}${errors ? ` com ${errors} aviso(s)` : ''}.`
          : 'Dados do cliente já estavam atualizados.';
      } catch (error) {
        syncMessage = error?.message || 'Não foi possível sincronizar os dados do cliente.';
      } finally {
        syncLoading = false;
      }
      const alertas = await fetchAlertasCliente(apiClient, clienteId).catch(() => ({ items: [] }));
      state.data = { ...state.data, cliente_alertas: Array.isArray(alertas?.items) ? alertas.items : [] };
      const timeline = await fetchClienteTimeline(apiClient, clienteId).catch(() => ({ items: [] }));
      state.data = { ...state.data, timeline: Array.isArray(timeline?.items) ? timeline.items : [] };
      const whatsappConversations = await fetchWhatsappConversationsCliente(apiClient, clienteId).catch(() => ({ items: [] }));
      state.data = { ...state.data, whatsappConversations: Array.isArray(whatsappConversations?.items) ? whatsappConversations.items : [] };
      whatsappActiveConversationId = state.data.whatsappConversations[0]?.id || null;
      if (whatsappActiveConversationId) {
        const messages = await fetchWhatsappConversationMessagesCliente(apiClient, clienteId, whatsappActiveConversationId).catch(() => ({ items: [] }));
        whatsappMessagesCache.set(whatsappActiveConversationId, Array.isArray(messages?.items) ? messages.items : []);
      }
      syncPedidoState();
    } catch (error) {
      if (error?.status === 404) state.notFound = true;
      else state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  render();
  load();
}
