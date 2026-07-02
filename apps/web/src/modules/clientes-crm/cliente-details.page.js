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
    .nho2d-wrap{max-width:1280px;width:100%;margin:0 auto;color:#e9eef8}
    .nho2d-shell{background:linear-gradient(180deg,#11172a 0%,#0b1220 100%);border:1px solid #1f2a44;border-radius:20px;padding:20px;box-shadow:0 22px 48px rgba(0,0,0,.35)}
    .nho2d-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:16px}
    .nho2d-title{font-size:32px;font-weight:750;letter-spacing:-.03em;color:#f5f7fb}
    .nho2d-sub{margin-top:4px;color:#93a4c7;font-size:14px}
    .nho2d-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:#bfd0f4;font-size:14px}
    .nho2d-tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #22304d;margin:10px 0 18px;padding-bottom:2px}
    .nho2d-tab{border:1px solid #243253;background:#10192d;color:#a7b6d4;border-radius:999px;padding:10px 14px;font-weight:700;cursor:pointer}
    .nho2d-tab.is-active{background:#2f6dff;color:#fff;box-shadow:0 10px 22px rgba(47,109,255,.28)}
    .nho2d-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);gap:16px}
    .nho2d-dados-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
    .cliente360-relevant-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
    .cliente360-card-primary{min-height:100%;display:flex;flex-direction:column}
    .cliente360-card-primary .cliente360-card-body{flex:1}
    .cliente360-column-right{display:flex;flex-direction:column;gap:24px;height:100%;grid-column:3;grid-row:1}
    .cliente360-card-enrichment{grid-column:2;grid-row:1}
    .cliente360-card-address,.cliente360-card-summary{width:100%}
    .cliente360-card-primary{grid-column:1;grid-row:1}
    .cliente360-card-map{display:grid;grid-column:1 / -1;grid-template-columns:minmax(0,1fr) minmax(420px,1.2fr);gap:18px;min-width:0;align-items:stretch}
    .cliente360-map-left{display:grid;align-content:start;gap:12px}
    .cliente360-map-frame{width:100%;height:240px;border:0;border-radius:12px;overflow:hidden;display:block;min-height:220px}
    .nho2d-single-col{display:grid;grid-template-columns:1fr;gap:10px}
    .nho2d-stack{display:grid;gap:14px}
    .nho2d-card{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,.22)}
    .nho2d-card h3{margin:0 0 10px;font-size:16px;color:#f5f7fb}
    .nho2d-dl{display:grid;grid-template-columns:160px minmax(0,1fr);gap:10px 14px;margin:0}
    .nho2d-dl-single{grid-template-columns:170px minmax(0,1fr)}
    .nho2d-dt{color:#93a4c7;font-weight:600}
    .nho2d-dd{margin:0;color:#e7eefb}
    .nho2d-right{text-align:right}
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
    @media (max-width:1280px){.nho2d-title{font-size:28px}}
    @media (max-width:1280px){.nho2d-dados-grid,.cliente360-relevant-grid{grid-template-columns:1fr}.cliente360-card-primary{min-height:0}.cliente360-column-right{grid-column:auto;grid-row:auto;gap:16px;height:auto}.cliente360-card-enrichment,.cliente360-card-address,.cliente360-card-summary{grid-column:auto;grid-row:auto}.cliente360-card-map{grid-template-columns:1fr}.cliente360-map-frame{height:240px}}
    @media (max-width:1024px){.nho2d-grid{grid-template-columns:1fr}.nho2d-dados-grid{grid-template-columns:1fr}.nho2d-title{font-size:24px}.nho2d-dl{grid-template-columns:1fr}.nho2d-kpi-grid{grid-template-columns:1fr}}
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
    return `
      <div class="nho2d-header">
        <div>
          <div class="nho2d-title">${safeText(d?.nomeEmpresa, 'Cliente não identificado')}</div>
          <div class="nho2d-sub">Cliente 360°</div>
          ${syncLoading ? `<div class="nho2d-sync" role="status" aria-live="polite"><span class="nho2d-sync-dot"></span>Atualizando dados do cliente...</div>` : syncMessage ? `<div class="nho2d-sync" role="status" aria-live="polite"><span class="nho2d-sync-dot"></span>${safeText(syncMessage, '')}</div>` : ''}
          <div class="nho2d-meta">
            <span class="nho2-badge ${statusClass(d?.status)}">${safeText(d?.status, '-')}</span>
            ${d?.cidade || d?.uf ? `<span><strong>${[d?.cidade, d?.uf].filter(Boolean).join(' / ')}</strong></span>` : ''}
            ${d?.dataCadastro ? `<span><strong>Cadastrado em:</strong> ${fmtDate(d.dataCadastro)}</span>` : ''}
          </div>
        </div>
        <button id="nhcd-back" class="nho2-btn ghost">Voltar</button>
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
    const enrichmentStatus = safeValue(d?.enriquecimento_status ? String(d.enriquecimento_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    const geolocationStatus = safeValue(d?.geolocalizacao_status ? String(d.geolocalizacao_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    const hasCoordinates = Number.isFinite(Number(d?.latitude)) && Number.isFinite(Number(d?.longitude));
    const iframeSrc = hasCoordinates ? `https://maps.google.com/maps?q=${d.latitude},${d.longitude}&z=15&output=embed` : '';
    const timelineCount = Array.isArray(d?.timeline) ? d.timeline.length : 0;
    const cardFields = (items) => `<dl class="nho2d-dl">${items.map(([label, value]) => `<dt class="nho2d-dt">${label}</dt><dd class="nho2d-dd">${safeValue(value)}</dd>`).join('')}</dl>`;
    const hasSite = Boolean(String(d?.site || '').trim());
    const enrichment = d?.digital_enrichment_payload && typeof d.digital_enrichment_payload === 'object' ? d.digital_enrichment_payload : {};
    const contacts = enrichment.contacts || {};
    const social = enrichment.social || {};
    const company = enrichment.company || {};
    const commercial = enrichment.commercial || {};
    const lastDigitalUpdate = d?.digital_enrichment_updated_at || null;
    const socialLine = (items) => (Array.isArray(items) ? items.map((item) => `<a href="${item}" target="_blank" rel="noreferrer">${safeText(item)}</a>`).join('<br/>') : '-');
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
        ['Telefone', d?.dadosCliente?.telefone || '-'],
        ['Telefone secundário', d?.telefone2 || d?.telefone_secundario || '-'],
        ['E-mail', d?.dadosCliente?.email || '-'],
        ['Site', hasSite ? `<a href="${d.site}" target="_blank" rel="noreferrer">${d.site}</a>` : '-']
      ].map(([label, value]) => `<dt class="nho2d-dt">${label}</dt><dd class="nho2d-dd">${safeValue(value)}</dd>`).join('')}</dl>`;
    };
    return `
      <div class="cliente360-relevant-grid nho2d-dados-grid">
        <article class="nho2d-card cliente360-card-primary">
          <h3>Dados principais</h3>
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
            ${renderPrincipalFields()}
          ` : `
            ${renderPrincipalFields()}
            <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
              <button id="nho2d-edit-start" class="nho2-btn">Editar dados</button>
              ${hasSite ? '' : `<button id="nho2d-web-discovery" class="nho2-btn secondary" ${webDiscoveryLoading ? 'disabled' : ''}>${webDiscoveryLoading ? 'Descobrindo...' : 'Descobrir site'}</button>`}
            </div>
            ${webDiscoveryMessage ? `<div class="nho2d-crm-empty" style="margin-top:12px">${safeText(webDiscoveryMessage, '')}</div>` : ''}
          `}
          </div>
        </article>
        <article class="nho2d-card cliente360-card-enrichment">
            <div class="nho2d-header" style="margin-bottom:12px">
              <div>
                <h3 style="margin:0 0 4px">Presença Digital</h3>
                <div class="nho2d-sub">Site descoberto, contatos e sinais comerciais coletados do site oficial.</div>
              </div>
              <button id="nho2d-enrich" class="nho2-btn secondary" ${enrichmentLoading ? 'disabled' : ''}>${enrichmentLoading ? 'Enriquecendo digitalmente...' : 'Enriquecer digitalmente'}</button>
            </div>
            ${cardFields([
              ['Site', hasSite ? `<a href="${d.site}" target="_blank" rel="noreferrer">${d.site}</a>` : '-'],
              ['E-mails', Array.isArray(contacts.emails) && contacts.emails.length ? contacts.emails.join('<br/>') : '-'],
              ['Telefones', Array.isArray(contacts.phones) && contacts.phones.length ? contacts.phones.join('<br/>') : '-'],
              ['WhatsApp', Array.isArray(contacts.whatsapp) && contacts.whatsapp.length ? contacts.whatsapp.join('<br/>') : '-'],
              ['Instagram', socialLine(social.instagram)],
              ['Facebook', socialLine(social.facebook)],
              ['LinkedIn', socialLine(social.linkedin)],
              ['YouTube', socialLine(social.youtube)],
              ['TikTok', socialLine(social.tiktok)],
              ['Resumo da empresa', company.description || '-'],
              ['Categorias', Array.isArray(company.categories) && company.categories.length ? company.categories.join(', ') : '-'],
              ['Marcas', Array.isArray(company.brands) && company.brands.length ? company.brands.join(', ') : '-'],
              ['E-commerce', commercial.has_ecommerce ? 'Sim' : 'Não'],
              ['Catálogo online', commercial.has_catalog ? 'Sim' : 'Não'],
              ['Última atualização do enriquecimento digital', lastDigitalUpdate ? formatDateFriendly(lastDigitalUpdate) : 'Não informado']
            ])}
          </article>
        <div class="cliente360-column-right">
          <article class="nho2d-card cliente360-card-address">
              <h3>Endereço</h3>
              ${cardFields([
                ['Logradouro', d?.logradouro],
                ['Número', d?.numero],
                ['Bairro', d?.bairro],
                ['CEP', d?.cep],
                ['Cidade', d?.cidade],
                ['UF', d?.uf]
              ])}
            </article>
          <article class="nho2d-card cliente360-card-summary">
              <h3>Resumo</h3>
              ${cardFields([
                ['Status do enriquecimento', enrichmentStatus],
                ['Status da geolocalização', geolocationStatus],
                ['Última sincronização', formatDateFriendly(d?.sincronizado_em || d?.updated_at || d?.updatedAt)],
                ['Eventos na Timeline', timelineCount]
              ])}
            </article>
        </div>
        <article class="nho2d-card cliente360-card-map" style="grid-column:1 / -1">
          <div class="cliente360-map-left">
            <div class="nho2d-header" style="margin-bottom:0">
              <div>
                <h3 style="margin:0 0 4px">Geolocalização</h3>
                <div class="nho2d-sub">Consulta manual do endereço do cliente via Nominatim/OpenStreetMap.</div>
              </div>
              <button id="nho2d-geocode" class="nho2-btn secondary" ${geolocationLoading ? 'disabled' : ''}>${geolocationLoading ? 'Geolocalizando...' : 'Geolocalizar Cliente'}</button>
            </div>
            ${cardFields([
              ['Latitude', d?.latitude],
              ['Longitude', d?.longitude],
              ['Google Maps', d?.google_maps_link ? `<a href="${d.google_maps_link}" target="_blank" rel="noreferrer">Abrir no Google Maps</a>` : d?.google_maps_url ? `<a href="${d.google_maps_url}" target="_blank" rel="noreferrer">Abrir no Google Maps</a>` : 'Não informado'],
              ['Place ID', d?.place_id],
              ['Fonte', d?.geolocalizacao_fonte],
              ['Última atualização', formatDateFriendly(d?.geolocalizacao_ultima_execucao)]
            ])}
          </div>
          <div style="min-width:0;overflow:hidden;border-radius:12px;height:100%">${hasCoordinates ? `<iframe title="Mapa do cliente" src="${iframeSrc}" class="cliente360-map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>` : '<div class="nho2d-crm-empty" style="height:240px;display:flex;align-items:center;justify-content:center">Sem coordenadas para exibir o mapa.</div>'}</div>
        </article>
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
            <button id="nho2d-geocode" class="nho2-btn secondary" ${geolocationLoading ? 'disabled' : ''}>${geolocationLoading ? 'Geolocalizando...' : 'Geolocalizar Cliente'}</button>
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
          <div class="nho2d-header" style="margin-bottom:12px">
            <div>
              <h3 style="margin:0 0 4px">Timeline</h3>
              <div class="nho2d-sub">Eventos relevantes do Cliente 360 em ordem cronológica decrescente.</div>
            </div>
            <button id="nho2d-timeline-refresh" class="nho2-btn secondary">Atualizar</button>
          </div>
          ${items.length ? `<div class="nho2d-timeline-list">${items.map((item) => `
            <div class="nho2d-timeline-item">
              <div class="nho2d-timeline-icon">${getTimelineIcon(item.categoria)}</div>
              <div class="nho2d-timeline-body">
                <div class="nho2d-timeline-title">${safeText(item.titulo, 'Evento')}</div>
                <div class="nho2d-timeline-desc">${safeText(item.descricao, '')}</div>
                <div class="nho2d-timeline-meta">${formatDateFriendly(item.created_at)}</div>
              </div>
            </div>`).join('')}</div>` : '<div class="nho2d-crm-empty">Nenhum evento registrado ainda.</div>'}
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
