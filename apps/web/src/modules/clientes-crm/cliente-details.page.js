import { createClienteDetailsState } from './cliente-details.state.js';
import { enriquecerCliente, fetchClienteDetailsData, fetchPedidoDetailsForCliente, geolocalizarCliente } from './cliente-details.service.js';

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
  let activeTab = 'geral';
  let enrichmentLoading = false;
  let geolocationLoading = false;
  let feedbackMessage = '';
  const groupAccordionState = new Map();
  const pedidoAccordionState = new Map();
  const pedidoItemDetails = new Map();
  const pedidoItemLoading = new Set();

  function injectStyles() {
    if (document.getElementById('nh-cliente-details-style')) return;
    const style = document.createElement('style');
    style.id = 'nh-cliente-details-style';
    style.textContent = `
    .nho2d-wrap{max-width:1280px;width:100%;margin:0 auto}
    .nho2d-shell{background:linear-gradient(180deg,#ffffff 0%,#f6f9ff 100%);border:1px solid #dbe4f2;border-radius:18px;padding:20px;box-shadow:0 10px 28px rgba(16,34,68,.07)}
    .nho2d-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:16px}
    .nho2d-title{font-size:32px;font-weight:750;letter-spacing:-.03em;color:#10264b}
    .nho2d-sub{margin-top:4px;color:#61708f;font-size:14px}
    .nho2d-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:#31456f;font-size:14px}
    .nho2d-tabs{display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid #dbe4f2;margin:10px 0 18px;padding-bottom:2px}
    .nho2d-tab{border:1px solid transparent;background:transparent;color:#5e6f93;border-radius:999px;padding:10px 14px;font-weight:700;cursor:pointer}
    .nho2d-tab.is-active{background:#0f3ea8;color:#fff;box-shadow:0 8px 18px rgba(15,62,168,.18)}
    .nho2d-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(320px,1fr);gap:16px}
    .nho2d-stack{display:grid;gap:14px}
    .nho2d-card{background:#fff;border:1px solid #e5ecf8;border-radius:14px;padding:20px;box-shadow:0 4px 14px rgba(16,34,68,.04)}
    .nho2d-card h3{margin:0 0 10px;font-size:16px;color:#10264b}
    .nho2d-dl{display:grid;grid-template-columns:160px minmax(0,1fr);gap:10px 14px;margin:0}
    .nho2d-dt{color:#5e6f93;font-weight:600}
    .nho2d-dd{margin:0;color:#1d2e4f}
    .nho2d-right{text-align:right}
    .nho2d-table-wrap{overflow:auto}
    .nho2d-table{width:100%;border-collapse:separate;border-spacing:0}
    .nho2d-table th{background:#f2f6ff;color:#284276;text-align:left;font-size:13px;padding:10px 12px}
    .nho2d-table td{padding:12px;border-top:1px solid #e8eef8;color:#23355c;vertical-align:top}
    .nho2d-table tbody tr:nth-child(even){background:#fcfdff}
    .nho2d-table tbody tr:hover{background:#f7faff}
    .nho2d-empty{padding:16px 6px;color:#5b6c90}
    .nho2d-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .nho2d-kpi{border:1px solid #e5ecf8;border-radius:12px;padding:12px;background:#f9fbff}
    .nho2d-kpi-label{color:#5e6f93;font-size:12px}
    .nho2d-kpi-value{margin-top:4px;color:#183a86;font-size:18px;font-weight:700}
    .nho2d-section{display:grid;gap:14px}
    .nho2d-accordion{border:1px solid #e5ecf8;border-radius:14px;overflow:hidden;background:#fff}
    .nho2d-accordion-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:transparent;border:0;cursor:pointer;text-align:left}
    .nho2d-accordion-head:hover{background:#f7faff}
    .nho2d-accordion-title{display:grid;gap:4px;min-width:0}
    .nho2d-accordion-title strong{font-size:15px;color:#10264b}
    .nho2d-accordion-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#5e6f93;font-size:13px}
    .nho2d-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:#eef4ff;color:#2d57b8;border:1px solid #d8e5ff}
    .nho2d-accordion-body{padding:0 18px 16px}
    .nho2d-chevron{transition:transform .2s ease;color:#5e6f93}
    .nho2d-accordion.is-open .nho2d-chevron{transform:rotate(180deg)}
    .nho2d-item-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
    .nho2d-item-note{font-size:12px;color:#62759a}
    .nho2d-mini-loading{padding:10px 0;color:#62759a;font-size:13px}
    .nho2d-crm-empty{padding:18px;border:1px dashed #d5e0f3;border-radius:12px;color:#5b6c90;background:#fbfcff}
    .nho2d-group-summary{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .nho2d-group-body{padding:0 18px 16px}
    .nho2d-group-empty{padding:0 18px 16px;color:#62759a}
    .nho2d-product-row{width:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;background:transparent;border:0;cursor:pointer;text-align:left}
    .nho2d-product-row:hover{background:#f7faff}
    .nho2d-product-name{min-width:0;font-weight:700;color:#10264b}
    .nho2d-product-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#5e6f93;font-size:13px}
    .nho2d-variation-panel{padding:0 18px 16px}
    .nho2d-variation-note{font-size:12px;color:#62759a;margin-top:4px}
    @media (max-width:1280px){.nho2d-title{font-size:28px}}
    @media (max-width:1024px){.nho2d-grid{grid-template-columns:1fr}.nho2d-title{font-size:24px}.nho2d-dl{grid-template-columns:1fr}.nho2d-kpi-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function getTabLabel(key) {
    if (key === 'comercial') return 'Comercial';
    if (key === 'crm') return 'CRM';
    if (key === 'enriquecimento') return 'Enriquecimento';
    if (key === 'geolocalizacao') return 'Geolocalização';
    return 'Geral';
  }

  function safeValue(value) {
    const text = String(value || '').trim();
    return text || 'Não informado';
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
          <div class="nho2d-meta">
            <span class="nho2-badge ${statusClass(d?.status)}">${safeText(d?.status, '-')}</span>
            ${d?.cidade || d?.uf ? `<span><strong>${[d?.cidade, d?.uf].filter(Boolean).join(' / ')}</strong></span>` : ''}
            ${d?.dataCadastro ? `<span><strong>Cadastrado em:</strong> ${fmtDate(d.dataCadastro)}</span>` : ''}
          </div>
        </div>
        <button id="nhcd-back" class="nho2-btn" style="background:#fff;color:#1f56dc">Voltar</button>
      </div>
      <div class="nho2d-tabs" role="tablist" aria-label="Detalhes do cliente">
        ${['geral', 'comercial', 'crm', 'enriquecimento', 'geolocalizacao'].map((tab) => `<button class="nho2d-tab ${activeTab === tab ? 'is-active' : ''}" data-tab="${tab}" role="tab" aria-selected="${activeTab === tab ? 'true' : 'false'}">${getTabLabel(tab)}</button>`).join('')}
      </div>
    `;
  }

  function renderGeral(d) {
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
    return `
      <div class="nho2d-grid">
        <div class="nho2d-stack">
          <article class="nho2d-card">
            <h3>Resumo gerencial</h3>
            <div class="nho2d-kpi-grid">
              ${fields.slice(0, 4).map(([label, value]) => `<div class="nho2d-kpi"><div class="nho2d-kpi-label">${label}</div><div class="nho2d-kpi-value">${value}</div></div>`).join('')}
            </div>
          </article>
          <article class="nho2d-card">
            <h3>Dados relevantes</h3>
            <dl class="nho2d-dl">
              ${fields.slice(4).map(([label, value]) => `<dt class="nho2d-dt">${label}</dt><dd class="nho2d-dd">${value}</dd>`).join('')}
            </dl>
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

  function renderEnriquecimento(d) {
    const status = safeValue(d?.enriquecimento_status ? String(d.enriquecimento_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    const payloadText = d?.enriquecimento_payload && Object.keys(d.enriquecimento_payload || {}).length ? JSON.stringify(d.enriquecimento_payload, null, 2) : '';
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <div class="nho2d-header" style="margin-bottom:12px">
            <div>
              <h3 style="margin:0 0 4px">Enriquecimento</h3>
              <div class="nho2d-sub">Consulta manual da BrasilAPI por CNPJ.</div>
            </div>
            <button id="nho2d-enrich" class="nho2-btn" ${enrichmentLoading ? 'disabled' : ''}>${enrichmentLoading ? 'Enriquecendo dados...' : 'Enriquecer CNPJ'}</button>
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
        ${d?.enriquecimento_payload && Object.keys(d.enriquecimento_payload || {}).length ? `<article class="nho2d-card"><h3>Payload bruto</h3><pre style="white-space:pre-wrap;word-break:break-word;margin:0">${safeText(payloadText, '')}</pre></article>` : ''}
      </div>
    `;
  }

  function renderGeolocalizacao(d) {
    const status = safeValue(d?.geolocalizacao_status ? String(d.geolocalizacao_status).replace(/^./, (m) => m.toUpperCase()) : 'Pendente');
    return `
      <div class="nho2d-section">
        <article class="nho2d-card">
          <div class="nho2d-header" style="margin-bottom:12px">
            <div>
              <h3 style="margin:0 0 4px">Geolocalização</h3>
              <div class="nho2d-sub">Consulta manual do endereço do cliente via Nominatim/OpenStreetMap.</div>
            </div>
            <button id="nho2d-geocode" class="nho2-btn" ${geolocationLoading ? 'disabled' : ''}>${geolocationLoading ? 'Geolocalizando...' : 'Geolocalizar Cliente'}</button>
          </div>
          ${feedbackMessage ? `<div class="nho2d-crm-empty" style="margin-bottom:12px">${safeText(feedbackMessage, '')}</div>` : ''}
          <dl class="nho2d-dl">
            <dt class="nho2d-dt">Status</dt><dd class="nho2d-dd">${status}</dd>
            <dt class="nho2d-dt">Fonte</dt><dd class="nho2d-dd">${safeValue(d?.geolocalizacao_fonte)}</dd>
            <dt class="nho2d-dt">Latitude</dt><dd class="nho2d-dd">${safeValue(d?.latitude)}</dd>
            <dt class="nho2d-dt">Longitude</dt><dd class="nho2d-dd">${safeValue(d?.longitude)}</dd>
            <dt class="nho2d-dt">Última execução</dt><dd class="nho2d-dd">${formatDateFriendly(d?.geolocalizacao_ultima_execucao)}</dd>
            <dt class="nho2d-dt">Google Maps</dt><dd class="nho2d-dd">${d?.google_maps_url ? `<a href="${d.google_maps_url}" target="_blank" rel="noreferrer">Abrir no Google Maps</a>` : 'Não informado'}</dd>
            <dt class="nho2d-dt">Erro</dt><dd class="nho2d-dd">${safeValue(d?.geolocalizacao_erro)}</dd>
          </dl>
        </article>
      </div>
    `;
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
      ${activeTab === 'comercial' ? renderComercial(d) : ''}
      ${activeTab === 'crm' ? renderCrm(d) : ''}
      ${activeTab === 'enriquecimento' ? renderEnriquecimento(d) : ''}
      ${activeTab === 'geolocalizacao' ? renderGeolocalizacao(d) : ''}
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
    root.querySelectorAll('[data-tab]').forEach((button) => {
      button.onclick = () => { activeTab = button.getAttribute('data-tab') || 'geral'; render(); };
    });
    const enrichBtn = root.querySelector('#nho2d-enrich');
    if (enrichBtn) {
      enrichBtn.onclick = async () => {
        enrichmentLoading = true;
        feedbackMessage = 'Enriquecendo dados...';
        render();
        try {
          const response = await enriquecerCliente(apiClient, clienteId);
          state.data = response?.item ? { ...state.data, ...response.item } : state.data;
          feedbackMessage = 'Dados enriquecidos com sucesso.';
        } catch (error) {
          feedbackMessage = error?.message || 'Falha ao enriquecer cliente.';
        } finally {
          enrichmentLoading = false;
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
          feedbackMessage = response?.resultado?.status === 'sucesso' ? 'Cliente geolocalizado com sucesso.' : (response?.resultado?.erro || 'Geolocalização concluída.');
        } catch (error) {
          feedbackMessage = error?.message || 'Falha ao geolocalizar cliente.';
        } finally {
          geolocationLoading = false;
          render();
        }
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
  }

  async function load() {
    state.loading = true;
    state.error = false;
    state.notFound = false;
    render();
    try {
      state.data = await fetchClienteDetailsData(apiClient, clienteId);
      if (!state?.data?.id) state.notFound = true;
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
