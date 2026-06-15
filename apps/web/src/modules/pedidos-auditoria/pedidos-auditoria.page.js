import { createPedidosAuditoriaState } from './pedidos-auditoria.state.js';
import { fetchPedidosAuditoria, fetchVendedoresData, patchPedidoComissao, patchPedidoFaturamento, patchPedidoVendedor } from './pedidos-auditoria.service.js';

function injectStyles() {
  if (document.getElementById('nh-pedidos-auditoria-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-pedidos-auditoria-style';
  style.textContent = `
  .nha2-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);max-width:100%;overflow:hidden}
  .nha2-head{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
  .nha2-title{font-size:30px;font-weight:800;letter-spacing:-.03em}
  .nha2-sub{margin-top:6px;color:#91a4c4;max-width:70ch}
  .nha2-tools{display:grid;grid-template-columns:1.5fr 1fr 1fr 120px;gap:10px}
  .nha2-input,.nha2-select,.nha2-btn{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}
  .nha2-btn{background:#1f56dc;color:#fff;font-weight:700;cursor:pointer}
  .nha2-table-wrap{max-width:100%;overflow-x:auto;overflow-y:hidden;border-radius:14px}
  .nha2-table{width:100%;min-width:1180px;border-collapse:collapse;font-size:13px;table-layout:fixed}
  .nha2-table th,.nha2-table td{padding:10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;vertical-align:top;white-space:normal;overflow-wrap:anywhere}
  .nha2-table th{font-size:12px;color:#91a4c4;text-transform:uppercase;letter-spacing:.04em;background:rgba(255,255,255,.03)}
  .nha2-row:hover td{background:rgba(79,140,255,.08)}
  .nha2-badge{display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#eaf1ff;color:#1d4ed8;margin-right:6px;margin-bottom:4px}
  .nha2-badge.warn{background:rgba(251,191,36,.16);color:#fbbf24}
  .nha2-badge.danger{background:rgba(248,113,113,.16);color:#f87171}
  .nha2-badge.ok{background:rgba(52,211,153,.16);color:#34d399}
  .nha2-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
  .nha2-actions .nha2-btn{white-space:nowrap}
  .nha2-col-num{width:116px}
  .nha2-col-cliente{width:210px}
  .nha2-col-vendedor{width:150px}
  .nha2-col-status{width:110px}
  .nha2-col-date{width:108px}
  .nha2-col-money{width:110px}
  .nha2-col-commission{width:88px}
  .nha2-col-itens{width:72px}
  .nha2-col-problems{width:170px}
  .nha2-col-actions{width:180px}
  .nha2-small{padding:8px 10px;height:auto}
  .nha2-empty,.nha2-error{padding:24px;text-align:center;color:#91a4c4}
  .nha2-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:8px 0 12px;color:#91a4c4}
  .nha2-overlay{position:fixed;inset:0;background:rgba(2,6,23,.72);display:grid;place-items:center;padding:20px;z-index:40}
  .nha2-modal{width:min(520px,100%);background:linear-gradient(180deg,rgba(15,27,47,.98),rgba(11,21,37,.99));border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 28px 80px rgba(0,0,0,.45)}
  .nha2-modal h3{margin:0 0 8px;font-size:22px}
  .nha2-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .nha2-field{display:grid;gap:6px;margin-top:10px}
  .nha2-field label{font-size:12px;color:#91a4c4}
  .nha2-field input{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}
  .nha2-modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:14px}
  @media (max-width: 1024px){.nha2-tools{grid-template-columns:1fr 1fr}.nha2-grid{grid-template-columns:1fr}.nha2-title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

function fmtDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date);
}

function fmtMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function issueLabel(issue) {
  if (issue === 'sem_comissao') return 'Sem comissão';
  if (issue === 'sem_itens') return 'Sem itens';
  if (issue === 'sem_vendedor') return 'Sem vendedor';
  if (issue === 'nao_faturado_total') return 'Não faturado total';
  return issue;
}

function getPedidoDetailRoute(pedidoId) {
  return `#/pedidos/${pedidoId}`;
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function getClienteDisplayValue(item = {}) {
  const candidates = [item?.cliente_nome, item?.cliente?.nome, item?.cliente?.codigo, item?.cliente_id];
  const value = candidates.find((candidate, index) => {
    const text = String(candidate || '').trim();
    if (!text) return false;
    if (index === candidates.length - 1) return true;
    return true;
  });
  if (value && isUuidLike(String(value).trim()) && String(value).trim() === String(item?.cliente_id || '').trim()) return '-';
  return value || '-';
}

function getVendedorDisplayValue(item = {}) {
  if ((item?.issues || []).includes('sem_vendedor') || (!item?.vendedor && !item?.vendedor_nome)) return 'Sem vendedor';
  return item?.vendedor?.nome || item?.vendedor_nome || 'Sem vendedor';
}

export function renderPedidosAuditoriaPage(root, { apiClient }) {
  injectStyles();
  const state = createPedidosAuditoriaState();

  async function load(page = 1) {
    state.loading = true;
    state.error = false;
    render();
    try {
      const data = await fetchPedidosAuditoria(apiClient, { page, limit: state.pagination.limit, ...state.filters });
      state.items = data.items || [];
      state.pagination = data.pagination || state.pagination;
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function ensureVendedoresLoaded() {
    if (state.vendedores.length || state.vendedoresLoading) return;
    state.vendedoresLoading = true;
    state.vendedoresError = '';
    render();
    try {
      const data = await fetchVendedoresData(apiClient);
      state.vendedores = data.items || [];
    } catch {
      state.vendedoresError = 'Não foi possível carregar os vendedores.';
    } finally {
      state.vendedoresLoading = false;
      render();
    }
  }

  function openModal(type, pedido) {
    state.selected = pedido;
    state.modal = type;
    state.form = {
      comissao_principal_percentual: pedido?.comissao_principal_percentual ?? '',
      comissao_preposto_percentual: pedido?.comissao_preposto_percentual ?? '',
      data_faturamento: pedido?.data_faturamento || '',
      vendedor_id: pedido?.vendedor_id || ''
    };
    if (type === 'vendedor') ensureVendedoresLoaded();
    render();
  }

  function closeModal() {
    state.modal = null;
    state.selected = null;
    render();
  }

  async function saveModal() {
    const pedido = state.selected;
    if (!pedido) return;
    if (state.modal === 'comissao') {
      await patchPedidoComissao(apiClient, pedido.id, {
        comissao_principal_percentual: state.form.comissao_principal_percentual === '' ? null : Number(state.form.comissao_principal_percentual),
        comissao_preposto_percentual: state.form.comissao_preposto_percentual === '' ? null : Number(state.form.comissao_preposto_percentual)
      });
    }
    if (state.modal === 'faturamento') {
      await patchPedidoFaturamento(apiClient, pedido.id, { data_faturamento: state.form.data_faturamento });
    }
    if (state.modal === 'vendedor') {
      await patchPedidoVendedor(apiClient, pedido.id, { vendedor_id: state.form.vendedor_id || null });
    }
    closeModal();
    await load(state.pagination.page);
  }

  function renderModal() {
    if (!state.modal || !state.selected) return '';
    const isComissao = state.modal === 'comissao';
    const isVendedor = state.modal === 'vendedor';
    const isFaturamento = state.modal === 'faturamento';
    const body = isComissao
      ? `
            <div class="nha2-grid">
              <div class="nha2-field"><label>Comissão principal %</label><input id="nha2-comissao-principal" type="number" min="0" max="100" step="0.01" value="${state.form.comissao_principal_percentual}"></div>
              <div class="nha2-field"><label>Comissão preposto %</label><input id="nha2-comissao-preposto" type="number" min="0" max="100" step="0.01" value="${state.form.comissao_preposto_percentual}"></div>
            </div>`
      : isVendedor
        ? `
            <div class="nha2-field">
              <label>Vendedor</label>
              <select id="nha2-vendedor-id" class="nha2-select">
                <option value="">Selecione um vendedor...</option>
                ${state.vendedores.map((vendedor) => `<option value="${vendedor.id}" ${String(vendedor.id) === String(state.form.vendedor_id || '') ? 'selected' : ''}>${vendedor.nome || '-'}</option>`).join('')}
              </select>
              ${state.vendedoresLoading ? '<div style="color:#91a4c4;font-size:12px;margin-top:6px;">Carregando vendedores...</div>' : state.vendedoresError ? `<div style="color:#fda4af;font-size:12px;margin-top:6px;">${state.vendedoresError}</div>` : '<div style="color:#91a4c4;font-size:12px;margin-top:6px;">Vínculo oficial com public.vendedores.</div>'}
            </div>`
        : `
            <div class="nha2-field"><label>Data de faturamento</label><input id="nha2-data-faturamento" type="date" value="${state.form.data_faturamento}"></div>`;
    return `
      <div class="nha2-overlay" data-testid="nha2-modal-overlay">
        <div class="nha2-modal">
          <h3>${isComissao ? 'Definir comissão' : isVendedor ? 'Definir vendedor' : 'Marcar faturado'}</h3>
          <div style="color:#91a4c4;margin-bottom:8px;">Pedido ${state.selected.numero || state.selected.id}</div>
          ${body}
          <div class="nha2-modal-actions">
            <button class="nha2-btn nha2-small" id="nha2-cancel">Cancelar</button>
            <button class="nha2-btn nha2-small" id="nha2-save">${isComissao ? 'Salvar comissão' : isVendedor ? 'Salvar vendedor' : 'Salvar faturamento'}</button>
          </div>
        </div>
      </div>`;
  }

  function render() {
    root.innerHTML = `
      <section class="nha2-head">
        <div>
          <div class="nha2-title">Auditoria de Pedidos</div>
          <div class="nha2-sub">Lista operacional para corrigir comissão, visualizar pedidos sem itens, definir vendedor e marcar faturamento total.</div>
        </div>
        <div class="nha2-tools">
          <input id="nha2-search" class="nha2-input" placeholder="Buscar por ERP ou cliente" value="${state.filters.search}">
          <select id="nha2-issue" class="nha2-select"><option value="">Todos os problemas</option><option value="sem_comissao" ${state.filters.issue === 'sem_comissao' ? 'selected' : ''}>Sem comissão</option><option value="sem_itens" ${state.filters.issue === 'sem_itens' ? 'selected' : ''}>Sem itens</option><option value="nao_faturado_total" ${state.filters.issue === 'nao_faturado_total' ? 'selected' : ''}>Não faturado total</option></select>
          <select id="nha2-status" class="nha2-select"><option value="">Todos status</option><option value="rascunho" ${state.filters.status === 'rascunho' ? 'selected' : ''}>Rascunho</option><option value="aprovado" ${state.filters.status === 'aprovado' ? 'selected' : ''}>Aprovado</option><option value="confirmado" ${state.filters.status === 'confirmado' ? 'selected' : ''}>Confirmado</option><option value="faturado_total" ${state.filters.status === 'faturado_total' ? 'selected' : ''}>Faturado total</option><option value="cancelado" ${state.filters.status === 'cancelado' ? 'selected' : ''}>Cancelado</option></select>
          <button id="nha2-refresh" class="nha2-btn">Atualizar</button>
        </div>
      </section>
      <section class="nha2-panel">
        ${state.loading ? '<div class="nha2-empty">Carregando pedidos...</div>' : state.error ? '<div class="nha2-error">Não foi possível carregar a auditoria.</div>' : !state.items.length ? '<div class="nha2-empty">Nenhum pedido com problema encontrado.</div>' : `
          <div class="nha2-meta"><div>Página ${state.pagination.page} de ${state.pagination.totalPages}</div><div>Total: ${state.pagination.total}</div></div>
          <div class="nha2-table-wrap">
          <table class="nha2-table">
            <thead><tr><th class="nha2-col-num">Número ERP</th><th class="nha2-col-cliente">Cliente</th><th class="nha2-col-vendedor">Vendedor</th><th class="nha2-col-status">Status</th><th class="nha2-col-date">Emissão</th><th class="nha2-col-date">Faturamento</th><th class="nha2-col-money">Total</th><th class="nha2-col-commission">Comissão Principal %</th><th class="nha2-col-commission">Comissão Preposto %</th><th class="nha2-col-itens">Itens</th><th class="nha2-col-problems">Problemas</th><th class="nha2-col-actions">Ações</th></tr></thead>
            <tbody>
              ${state.items.map((item) => `
                <tr class="nha2-row">
                  <td><a href="${getPedidoDetailRoute(item.id)}" data-action="open-detail" data-id="${item.id}" style="color:#93c5fd;text-decoration:none;font-weight:700;word-break:break-word">${item.numero || item.id}</a><div><button class="nha2-btn nha2-small" data-action="open-detail" data-id="${item.id}" style="margin-top:6px">Abrir</button></div></td>
                  <td>${item.cliente_nome || getClienteDisplayValue(item)}</td>
                  <td>${getVendedorDisplayValue(item)}</td>
                  <td>${item.status || '-'}</td>
                  <td>${fmtDate(item.data_emissao)}</td>
                  <td>${fmtDate(item.data_faturamento)}</td>
                  <td>${fmtMoney(item.total)}</td>
                  <td>${item.comissao_principal_percentual ?? '-'}</td>
                  <td>${item.comissao_preposto_percentual ?? '-'}</td>
                  <td>${Number(item.itens_count || 0)}</td>
                  <td>${(item.issues || []).map((issue) => `<span class="nha2-badge ${issue === 'sem_itens' || issue === 'sem_vendedor' ? 'warn' : issue === 'sem_comissao' ? 'danger' : 'ok'}">${issueLabel(issue)}</span>`).join('')}</td>
                  <td>
                    <div class="nha2-actions">
                      <button class="nha2-btn nha2-small" data-action="comissao" data-id="${item.id}">Definir comissão</button>
                      <button class="nha2-btn nha2-small" data-action="faturamento" data-id="${item.id}">Marcar faturado</button>
                      <button class="nha2-btn nha2-small" data-action="vendedor" data-id="${item.id}">Definir vendedor</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table></div>`}
      </section>
      ${renderModal()}
    `;

    root.querySelector('#nha2-search').oninput = (e) => { state.filters.search = e.target.value; load(1); };
    root.querySelector('#nha2-issue').onchange = (e) => { state.filters.issue = e.target.value; load(1); };
    root.querySelector('#nha2-status').onchange = (e) => { state.filters.status = e.target.value; load(1); };
    root.querySelector('#nha2-refresh').onclick = () => load(state.pagination.page);
    root.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.onclick = () => {
        if (btn.getAttribute('data-action') === 'open-detail') {
          window.location.hash = getPedidoDetailRoute(btn.getAttribute('data-id'));
          return;
        }
        const pedido = state.items.find((item) => item.id === btn.getAttribute('data-id'));
        if (!pedido) return;
        openModal(btn.getAttribute('data-action'), pedido);
      };
    });
    root.querySelectorAll('a[data-action="open-detail"]').forEach((link) => {
      link.onclick = (e) => {
        e.preventDefault();
        window.location.hash = getPedidoDetailRoute(link.getAttribute('data-id'));
      };
    });
    const cancel = root.querySelector('#nha2-cancel');
    if (cancel) cancel.onclick = closeModal;
    const save = root.querySelector('#nha2-save');
    if (save) save.onclick = async () => {
      if (state.modal === 'comissao') {
        state.form.comissao_principal_percentual = root.querySelector('#nha2-comissao-principal')?.value ?? '';
        state.form.comissao_preposto_percentual = root.querySelector('#nha2-comissao-preposto')?.value ?? '';
      }
      if (state.modal === 'faturamento') state.form.data_faturamento = root.querySelector('#nha2-data-faturamento')?.value ?? '';
      if (state.modal === 'vendedor') state.form.vendedor_id = root.querySelector('#nha2-vendedor-id')?.value ?? '';
      await saveModal();
    };
    const overlay = root.querySelector('[data-testid="nha2-modal-overlay"]');
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  }

  render();
  load(1);
}
