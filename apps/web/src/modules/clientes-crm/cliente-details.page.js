import { createClienteDetailsState } from './cliente-details.state.js';
import { fetchClienteDetailsData } from './cliente-details.service.js';

function fmtCurrency(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}
function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'aprovado') return 'is-approved';
  if (s === 'confirmado') return 'is-confirmed';
  if (s === 'faturado') return 'is-billed';
  if (s === 'cancelado') return 'is-canceled';
  return 'is-draft';
}

export function renderClienteDetailsPage(root, { apiClient, clienteId }) {
  const state = createClienteDetailsState();

  function injectStyles() {
    if (document.getElementById('nh-cliente-details-style')) return;
    const style = document.createElement('style');
    style.id = 'nh-cliente-details-style';
    style.textContent = `
    .nho2d-wrap{max-width:1280px;width:100%;margin:0 auto}
    .nho2d-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:20px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
    .nho2d-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:18px}
    .nho2d-title{font-size:32px;font-weight:700;letter-spacing:-.02em}
    .nho2d-sub{margin-top:4px;color:#61708f;font-size:14px}
    .nho2d-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:#31456f;font-size:14px}
    .nho2d-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,1fr);gap:16px}
    .nho2d-stack{display:grid;gap:14px}
    .nho2d-card{background:#fff;border:1px solid #e5ecf8;border-radius:14px;padding:20px;box-shadow:0 4px 14px rgba(16,34,68,.04)}
    .nho2d-card h3{margin:0 0 10px;font-size:16px}
    .nho2d-dl{display:grid;grid-template-columns:160px minmax(0,1fr);gap:10px 14px;margin:0}
    .nho2d-dt{color:#5e6f93;font-weight:600}
    .nho2d-dd{margin:0;color:#1d2e4f}
    .nho2d-right{text-align:right}
    .nho2d-total{font-size:22px;font-weight:700;color:#0f3ea8}
    .nho2d-table-wrap{overflow:auto}
    .nho2d-table{width:100%;border-collapse:separate;border-spacing:0}
    .nho2d-table th{background:#f2f6ff;color:#284276;text-align:left;font-size:13px;padding:10px 12px}
    .nho2d-table td{padding:12px;border-top:1px solid #e8eef8;color:#23355c}
    .nho2d-table tbody tr:nth-child(even){background:#fcfdff}
    .nho2d-table tbody tr:hover{background:#f7faff}
    .nho2d-empty{padding:16px 6px;color:#5b6c90}
    .nhcd-kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .nhcd-kpi{border:1px solid #e5ecf8;border-radius:12px;padding:12px;background:#f9fbff}
    .nhcd-kpi-label{color:#5e6f93;font-size:12px}
    .nhcd-kpi-value{margin-top:4px;color:#183a86;font-size:18px;font-weight:700}
    .nhcd-link{cursor:pointer}
    @media (max-width:1280px){.nho2d-wrap{max-width:1180px}.nho2d-title{font-size:28px}}
    @media (max-width:1024px){.nho2d-grid{grid-template-columns:1fr}.nho2d-title{font-size:24px}.nho2d-dl{grid-template-columns:1fr}.nhcd-kpi-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderContent() {
    if (state.loading) return '<section class="nho2d-panel nho2-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></section>';
    if (state.error) return '<section class="nho2d-panel nho2-state">Não foi possível carregar o cliente.<br/><br/><button id="nhcd-retry" class="nho2-btn">Tentar novamente</button></section>';
    if (state.notFound || !state.data?.id) return '<section class="nho2d-panel nho2-state">Cliente não encontrado.</section>';

    const d = state.data;
    const dataRows = [['Empresa', d?.dadosCliente?.empresa], ['Razão Social', d?.dadosCliente?.razaoSocial], ['Contato', d?.dadosCliente?.contato], ['Telefone', d?.dadosCliente?.telefone], ['Cidade', d?.dadosCliente?.cidade], ['UF', d?.dadosCliente?.uf], ['Status', d?.dadosCliente?.status], ['Data de Cadastro', fmtDate(d?.dadosCliente?.dataCadastro)]]
      .filter((x) => x[1])
      .map((x) => `<dt class="nho2d-dt">${x[0]}</dt><dd class="nho2d-dd">${x[1]}</dd>`)
      .join('');
    const pedidosRows = (d?.ultimosPedidos || []).map((p) => `<tr data-id="${p.id}" class="nhcd-link"><td>${p.numero || '-'}</td><td>${fmtDate(p.data) || '-'}</td><td><span class="nho2-badge ${statusClass(p.status)}">${p.status || '-'}</span></td><td class="nho2d-right">${fmtCurrency(p.valor)}</td></tr>`).join('');
    const produtosRows = (d?.produtosComprados || []).map((p) => `<tr><td>${p.produto || '-'}</td><td>${p.quantidade ?? 0}</td><td class="nho2d-right">${fmtCurrency(p.faturamento)}</td></tr>`).join('');
    const timelineRows = (d?.timeline || []).slice(0, 20).map((e) => `<tr><td>${e.tipo || 'Evento'}</td><td>${e.detalhe || ''}</td><td>${fmtDate(e.data) || ''}</td></tr>`).join('');
    const auditoria = [d?.auditoria?.criadoEm ? `<p><strong>Criado em:</strong> ${fmtDate(d.auditoria.criadoEm) || '-'}</p>` : '', d?.auditoria?.atualizadoEm ? `<p><strong>Atualizado em:</strong> ${fmtDate(d.auditoria.atualizadoEm) || '-'}</p>` : '', d?.auditoria?.origem ? `<p><strong>Origem:</strong> ${d.auditoria.origem}</p>` : ''].filter(Boolean).join('');

    return `<section class="nho2d-panel">
      <div class="nho2d-header">
        <div>
          <div class="nho2d-title">${d.nomeEmpresa || 'Cliente não identificado'}</div>
          <div class="nho2d-sub">Cliente 360°</div>
          <div class="nho2d-meta">
            <span class="nho2-badge ${statusClass(d.status)}">${d.status || '-'}</span>
            ${d.cidade || d.uf ? `<span><strong>${[d.cidade, d.uf].filter(Boolean).join(' / ')}</strong></span>` : ''}
            ${d.dataCadastro ? `<span><strong>Cadastrado em:</strong> ${fmtDate(d.dataCadastro)}</span>` : ''}
          </div>
        </div>
        <button id="nhcd-back" class="nho2-btn" style="background:#fff;color:#1f56dc">Voltar</button>
      </div>
      <div class="nho2d-grid">
        <div class="nho2d-stack">
          <article class="nho2d-card"><h3>Dados do Cliente</h3><dl class="nho2d-dl">${dataRows || '<p class="nho2d-empty">Sem dados disponíveis.</p>'}</dl></article>
          <article class="nho2d-card"><h3>Últimos Pedidos</h3><div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Número</th><th>Data</th><th>Status</th><th class="nho2d-right">Valor</th></tr></thead><tbody>${pedidosRows || '<tr><td colspan="4" class="nho2d-empty">Sem pedidos para este cliente.</td></tr>'}</tbody></table></div></article>
          <article class="nho2d-card"><h3>Produtos Comprados</h3>${produtosRows ? `<div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Produto</th><th>Quantidade</th><th class="nho2d-right">Faturamento</th></tr></thead><tbody>${produtosRows}</tbody></table></div>` : '<p class="nho2d-empty">Este cliente ainda não possui produtos comprados.</p>'}</article>
        </div>
        <div class="nho2d-stack">
          <article class="nho2d-card"><h3>Indicadores</h3><div class="nhcd-kpi-grid"><div class="nhcd-kpi"><div class="nhcd-kpi-label">Faturamento Total</div><div class="nhcd-kpi-value">${fmtCurrency(d?.kpis?.faturamentoTotal)}</div></div><div class="nhcd-kpi"><div class="nhcd-kpi-label">Total de Pedidos</div><div class="nhcd-kpi-value">${d?.kpis?.totalPedidos ?? 0}</div></div><div class="nhcd-kpi"><div class="nhcd-kpi-label">Ticket Médio</div><div class="nhcd-kpi-value">${fmtCurrency(d?.kpis?.ticketMedio)}</div></div><div class="nhcd-kpi"><div class="nhcd-kpi-label">Última Compra</div><div class="nhcd-kpi-value">${d?.kpis?.ultimaCompraLabel || (fmtDate(d?.kpis?.ultimaCompra) || 'Sem compras')}</div>${d?.kpis?.ultimaCompra ? `<div class="nhcd-kpi-label">${fmtDate(d?.kpis?.ultimaCompra)}</div>` : ''}</div></div></article>
          <article class="nho2d-card"><h3>Timeline Comercial</h3><div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Evento</th><th>Detalhe</th><th>Data</th></tr></thead><tbody>${timelineRows || '<tr><td colspan="3" class="nho2d-empty">Sem eventos disponíveis.</td></tr>'}</tbody></table></div></article>
          <article class="nho2d-card"><h3>Auditoria</h3>${auditoria || '<p class="nho2d-empty">Sem dados de auditoria disponíveis.</p>'}</article>
        </div>
      </div>
    </section>`;
  }

  function render() {
    injectStyles();
    root.innerHTML = `<div class="nho2d-wrap">${renderContent()}</div>`;
    const retry = root.querySelector('#nhcd-retry');
    if (retry) retry.onclick = () => load();
    const back = root.querySelector('#nhcd-back');
    if (back) back.onclick = () => { window.location.hash = '#/clientes'; };
    root.querySelectorAll('.nhcd-link').forEach((row) => {
      row.onclick = () => { window.location.hash = `#/pedidos/${row.getAttribute('data-id')}`; };
    });
  }

  async function load() {
    state.loading = true; state.error = false; state.notFound = false; render();
    try { state.data = await fetchClienteDetailsData(apiClient, clienteId); if (!state?.data?.id) state.notFound = true; }
    catch (error) { if (error?.status === 404) state.notFound = true; else state.error = true; }
    finally { state.loading = false; render(); }
  }
  render();
  load();
}
