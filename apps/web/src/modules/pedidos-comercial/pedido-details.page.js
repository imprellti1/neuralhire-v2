import { createPedidoDetailsState } from './pedido-details.state.js';
import { fetchClientesCatalogData, fetchPedidoDetailsData, fetchProdutosCatalogData, updatePedidoGeral, updatePedidoItens, updatePedidoStatus } from './pedido-details.service.js';

function fmtCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR');
}
function fmtDateOnlyUTC(value) {
  if (!value) return '-';
  const d = new Date(value);
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
function shortRequestId(requestId) {
  const raw = String(requestId || '').trim();
  if (!raw) return '';
  return raw.length > 14 ? `${raw.slice(0, 8)}...${raw.slice(-4)}` : raw;
}
function getStatusActions(statusExibicao) {
  const status = String(statusExibicao || '').toLowerCase();
  if (status === 'rascunho') return [{ key: 'aprovado', label: 'Aprovar pedido', loadingLabel: 'Aprovando...', successLabel: 'Pedido aprovado com sucesso.', description: 'Libera o pedido para as próximas etapas comerciais.' }, { key: 'cancelado', label: 'Cancelar pedido', loadingLabel: 'Cancelando...', successLabel: 'Pedido cancelado com sucesso.', description: 'Interrompe o fluxo do pedido e registra no histórico.' }];
  if (status === 'aprovado' || status === 'confirmado') return [{ key: 'faturado', label: 'Faturar pedido', loadingLabel: 'Faturando...', successLabel: 'Pedido faturado com sucesso.', description: 'Marca o pedido como concluído para faturamento.' }, { key: 'cancelado', label: 'Cancelar pedido', loadingLabel: 'Cancelando...', successLabel: 'Pedido cancelado com sucesso.', description: 'Cancela o pedido atual e atualiza o histórico.' }];
  if (status === 'cancelado') return [{ key: 'rascunho', label: 'Reabrir pedido', loadingLabel: 'Reabrindo...', successLabel: 'Pedido reaberto com sucesso.', description: 'Retorna o pedido para rascunho para nova edição.' }];
  return [];
}

export function renderPedidoDetailsPage(root, { apiClient, pedidoId, routeQuery = new URLSearchParams() }) {
  const state = createPedidoDetailsState();
  let actionLoading = null;
  let actionError = '';
  let actionSuccess = '';
  let confirmAction = null;
  let editMode = false;
  let itensDraft = [];
  let produtosCatalog = [];
  let clientesCatalog = [];
  let geralEditMode = false;
  let geralSaving = false;
  let geralMessage = '';
  let geralDraft = { cliente_id: '', origem: 'manual', observacoes: '' };
  let itensSaving = false;
  let itensMessage = '';
  let removeItemIndex = null;
  function injectStyles() {
    if (document.getElementById('nh-pedido-details-style')) return;
    const style = document.createElement('style');
    style.id = 'nh-pedido-details-style';
    style.textContent = `
    .nho2d-wrap{max-width:1280px;width:100%;margin:0 auto}
    .nho2d-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,.22);color:#e7eefb}
    .nho2d-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:18px}
    .nho2d-title{font-size:32px;font-weight:700;letter-spacing:-.02em}
    .nho2d-sub{margin-top:4px;color:#91a4c4;font-size:14px}
    .nho2d-meta{margin-top:10px;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;color:#31456f;font-size:14px}
    .nho2d-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(300px,1fr);gap:16px}
    .nho2d-stack{display:grid;gap:14px}
    .nho2d-card{background:linear-gradient(180deg,rgba(15,27,47,.94),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:14px;padding:20px;box-shadow:0 4px 14px rgba(0,0,0,.16)}
    .nho2d-card h3{margin:0 0 10px;font-size:16px}
    .nho2d-dl{display:grid;grid-template-columns:160px minmax(0,1fr);gap:10px 14px;margin:0}
    .nho2d-dt{color:#91a4c4;font-weight:600}
    .nho2d-dd{margin:0;color:#e7eefb}
    .nho2d-right{text-align:right}
    .nho2d-total{font-size:22px;font-weight:700;color:#0f3ea8}
    .nho2d-table-wrap{overflow:auto}
    .nho2d-table{width:100%;border-collapse:separate;border-spacing:0}
    .nho2d-table th{background:rgba(255,255,255,.03);color:#91a4c4;text-align:left;font-size:13px;padding:10px 12px}
    .nho2d-table td{padding:12px;border-top:1px solid rgba(148,163,184,.12);color:#e7eefb}
    .nho2d-table tbody tr:nth-child(even){background:rgba(255,255,255,.015)}
    .nho2d-table tbody tr:hover{background:rgba(79,140,255,.08)}
    .nho2d-empty{padding:16px 6px;color:#91a4c4}
    .nho2d-actions{display:flex;flex-wrap:wrap;gap:8px}
    .nho2d-actions .nho2-btn[disabled]{opacity:.55;cursor:not-allowed}
    .nho2d-actions-error{margin-top:10px;color:#fda4af;font-size:13px}
    .nho2d-actions-success{margin-top:10px;color:#86efac;font-size:13px}
    .nho2d-actions-card{border:1px solid rgba(148,163,184,.18);background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98))}
    .nho2d-actions-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}
    .nho2d-actions-list{display:grid;gap:10px}
    .nho2d-action-item{border:1px solid rgba(148,163,184,.18);border-radius:10px;padding:10px;background:rgba(11,22,40,.94)}
    .nho2d-action-desc{margin:0 0 8px;color:#91a4c4;font-size:13px}
    .nho2d-confirm-backdrop{position:fixed;inset:0;background:rgba(13,26,52,.35);display:flex;align-items:center;justify-content:center;z-index:50;padding:14px}
    .nho2d-confirm{width:min(460px,100%);background:linear-gradient(180deg,rgba(15,27,47,.98),rgba(11,21,37,.99));border:1px solid rgba(148,163,184,.18);border-radius:14px;padding:18px;box-shadow:0 16px 38px rgba(0,0,0,.28);color:#e7eefb}
    .nho2d-confirm h4{margin:0 0 8px;font-size:18px;color:#e7eefb}
    .nho2d-confirm p{margin:0 0 6px;color:#91a4c4}
    .nho2d-confirm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
    .nho2d-inline-actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
    .nho2d-input,.nho2d-select{border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:8px 10px;font-size:13px;background:#0b1628;color:#e7eefb}
    @media (max-width:1280px){.nho2d-wrap{max-width:1180px}.nho2d-title{font-size:28px}}
    @media (max-width:1024px){.nho2d-grid{grid-template-columns:1fr}.nho2d-title{font-size:24px}.nho2d-dl{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderContent() {
    if (state.loading) return '<section class="nho2d-panel nho2-loading"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></section>';
    if (state.error) return '<section class="nho2d-panel nho2-state">Não foi possível carregar o pedido.<br/><br/><button id="nho2d-retry" class="nho2-btn">Tentar novamente</button></section>';
    if (state.notFound || !state.data) return '<section class="nho2d-panel nho2-state">Pedido não encontrado.</section>';

    const d = state.data;
    const fromAuditoria = String(routeQuery.get('origin') || '') === 'auditoria';
    const backLabel = fromAuditoria ? '← Voltar para Auditoria' : 'Voltar';
    const backRoute = fromAuditoria ? '#/auditoria-pedidos' : '#/pedidos';
    const actions = getStatusActions(d?.statusExibicao);
    const itensRows = editMode
      ? (itensDraft || []).map((item, index) => `<tr><td>${item.produto || 'Produto não identificado'}</td><td><input class="nho2d-input js-item-qty" data-index="${index}" type="number" min="1" value="${item.quantidade ?? 1}" /></td><td class="nho2d-right">${fmtCurrency(item?.valorUnitario)}</td><td class="nho2d-right">${fmtCurrency(Number(item?.valorUnitario || 0) * Number(item?.quantidade || 0))}</td><td><button class="nho2-btn js-remove-item" data-index="${index}" ${itensSaving ? 'disabled' : ''}>Remover</button></td></tr>`).join('')
      : (d?.itens || []).map((item) => `<tr><td>${item?.produto || 'Produto não identificado'}</td><td>${item?.quantidade ?? 0}</td><td class="nho2d-right">${fmtCurrency(item?.valorUnitario)}</td><td class="nho2d-right">${fmtCurrency(item?.totalItem)}</td></tr>`).join('');
    const historicoRows = (d?.historico || []).map((h) => `<tr><td>${h?.statusAnterior || ''}</td><td>${h?.statusNovo || ''}</td><td>${fmtDate(h?.data)}</td></tr>`).join('');
    const resumoDataEmissao = fmtDateOnlyUTC(d?.dataEmissao);
    const auditLines = [
      d?.requestId ? `<p><strong>RequestId:</strong> ${shortRequestId(d?.requestId)}</p>` : '',
      d?.origemExibicao && d?.origemExibicao !== '-' ? `<p><strong>Origem:</strong> ${d?.origemExibicao}</p>` : '',
      d?.criadoEm ? `<p><strong>Criado em:</strong> ${fmtDate(d?.criadoEm)}</p>` : '',
      d?.atualizadoEm ? `<p><strong>Atualizado em:</strong> ${fmtDate(d?.atualizadoEm)}</p>` : ''
    ].filter(Boolean).join('');

    return `<section class="nho2d-panel">
      <div class="nho2d-header">
        <div>
          <div class="nho2d-title">Pedido ${d?.numeroExibicao || '-'}</div>
          <div class="nho2d-sub">Pedido Comercial${d?.idTecnico ? ` • ID técnico: ${shortRequestId(d.idTecnico)}` : ''}</div>
          <div class="nho2d-meta">
            <span class="nho2-badge ${statusClass(d?.statusExibicao)}">${d?.statusExibicao || '-'}</span>
            <span><strong>Cliente:</strong> ${d?.clienteExibicao || 'Cliente não identificado'}</span>
            <span><strong>Criado em:</strong> ${fmtDate(d?.criadoEm) || '-'}</span>
          </div>
        </div>
        <button id="nho2d-back" class="nho2-btn" data-back-route="${backRoute}" style="background:#0b1628;color:#91a4c4;border-color:rgba(148,163,184,.22)">${backLabel}</button>
      </div>
      <div class="nho2d-grid">
        <div class="nho2d-stack">
          <article class="nho2d-card"><h3>Resumo do Pedido</h3>${geralEditMode ? `<div class="nho2d-inline-actions"><select id="nho2d-geral-cliente" class="nho2d-select"><option value="">Selecione o cliente...</option>${clientesCatalog.map((c) => `<option value="${c.id}" ${String(geralDraft.cliente_id)===String(c.id)?'selected':''}>${c.empresa || c.razao_social || c.nome || 'Cliente'}</option>`).join('')}</select><select id="nho2d-geral-origem" class="nho2d-select"><option value="manual" ${geralDraft.origem==='manual'?'selected':''}>manual</option><option value="site" ${geralDraft.origem==='site'?'selected':''}>site</option><option value="whatsapp" ${geralDraft.origem==='whatsapp'?'selected':''}>whatsapp</option></select><button id="nho2d-geral-save" class="nho2-btn" ${geralSaving ? 'disabled' : ''}>${geralSaving ? 'Salvando...' : 'Salvar Alterações'}</button><button id="nho2d-geral-cancel" class="nho2-btn" style="background:#0b1628;color:#91a4c4;border-color:rgba(148,163,184,.22)" ${geralSaving ? 'disabled' : ''}>Cancelar</button></div><label class="nhpc-field">Observações<textarea id="nho2d-geral-obs" class="nho2d-input" style="width:100%;min-height:82px">${geralDraft.observacoes || ''}</textarea></label>` : `<div class="nho2d-inline-actions"><button id="nho2d-geral-edit" class="nho2-btn">Editar Pedido</button></div>`}${geralMessage ? `<p class="${geralMessage.includes('sucesso') ? 'nho2d-actions-success' : 'nho2d-actions-error'}">${geralMessage}</p>` : ''}<dl class="nho2d-dl"><dt class="nho2d-dt">Número</dt><dd class="nho2d-dd">${d?.numeroExibicao || '-'}</dd><dt class="nho2d-dt">Cliente</dt><dd class="nho2d-dd">${d?.clienteExibicao || 'Cliente não identificado'}</dd><dt class="nho2d-dt">Status</dt><dd class="nho2d-dd"><span class="nho2-badge ${statusClass(d?.statusExibicao)}">${d?.statusExibicao || '-'}</span></dd><dt class="nho2d-dt">Origem</dt><dd class="nho2d-dd">${d?.origemExibicao || '-'}</dd><dt class="nho2d-dt">Data de emissão</dt><dd class="nho2d-dd">${resumoDataEmissao}</dd></dl></article>
          <article class="nho2d-card"><h3>Itens do Pedido</h3>
          ${editMode ? `<div class="nho2d-inline-actions"><select id="nho2d-add-produto" class="nho2d-select"><option value="">Adicionar produto...</option>${produtosCatalog.map((p) => `<option value="${p.id}">${p.nome || p.sku || 'Produto'}</option>`).join('')}</select><button id="nho2d-add-item" class="nho2-btn" ${itensSaving ? 'disabled' : ''}>Adicionar item</button><button id="nho2d-save-itens" class="nho2-btn" ${itensSaving ? 'disabled' : ''}>${itensSaving ? 'Salvando...' : 'Salvar alterações'}</button><button id="nho2d-cancel-itens" class="nho2-btn" style="background:#0b1628;color:#91a4c4;border-color:rgba(148,163,184,.22)" ${itensSaving ? 'disabled' : ''}>Cancelar edição</button></div>` : `<div class="nho2d-inline-actions"><button id="nho2d-edit-itens" class="nho2-btn">Editar itens</button></div>`}
          ${itensMessage ? `<p class="${itensMessage.includes('sucesso') ? 'nho2d-actions-success' : 'nho2d-actions-error'}">${itensMessage}</p>` : ''}
          <div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Produto</th><th>Qtde</th><th class="nho2d-right">Unitário</th><th class="nho2d-right">Total</th>${editMode ? '<th>Ações</th>' : ''}</tr></thead><tbody>${itensRows || `<tr><td colspan="${editMode ? 5 : 4}" class="nho2d-empty">Nenhum item encontrado.</td></tr>`}</tbody></table></div></article>
        </div>
        <div class="nho2d-stack">
          <article class="nho2d-card"><h3>Financeiro</h3><dl class="nho2d-dl"><dt class="nho2d-dt">Total</dt><dd class="nho2d-dd nho2d-right nho2d-total">${fmtCurrency(d?.financeiro?.total)}</dd><dt class="nho2d-dt">Itens distintos</dt><dd class="nho2d-dd nho2d-right">${d?.quantidadeItensDistintos ?? 0}</dd><dt class="nho2d-dt">Quantidade vendida</dt><dd class="nho2d-dd nho2d-right">${d?.quantidadeTotalVendida ?? 0}</dd></dl></article>
          <article class="nho2d-card"><h3>Auditoria</h3>${auditLines || '<p class="nho2d-empty">Sem dados de auditoria disponíveis.</p>'}</article>
          <article class="nho2d-card nho2d-actions-card"><h3>Ações do Pedido</h3><div class="nho2d-actions-head"><span>Status atual</span><span class="nho2-badge ${statusClass(d?.statusExibicao)}">${d?.statusExibicao || '-'}</span></div>${actions.length ? `<div class="nho2d-actions-list">${actions.map((action) => `<div class="nho2d-action-item"><p class="nho2d-action-desc">${action.description || ''}</p><div class="nho2d-actions"><button class="nho2-btn js-pedido-action" data-next-status="${action.key}" ${actionLoading ? 'disabled' : ''}>${actionLoading === action.key ? action.loadingLabel : action.label}</button></div></div>`).join('')}</div>` : '<p class="nho2d-empty">Pedido em status final, sem ações principais.</p>'}${actionSuccess ? `<p class="nho2d-actions-success">${actionSuccess}</p>` : ''}${actionError ? `<p class="nho2d-actions-error">${actionError}</p>` : ''}</article>
        </div>
      </div>
      <article class="nho2d-card" style="margin-top:14px"><h3>Histórico</h3>${historicoRows ? `<div class="nho2d-table-wrap"><table class="nho2d-table"><thead><tr><th>Status anterior</th><th>Status novo</th><th>Data</th></tr></thead><tbody>${historicoRows}</tbody></table></div>` : '<p class="nho2d-empty">Nenhuma movimentação registrada ainda.<br/>As alterações de status aparecerão aqui.</p>'}</article>
      ${confirmAction ? `<div class="nho2d-confirm-backdrop"><div class="nho2d-confirm"><h4>Confirmar ação</h4><p>Deseja realmente ${confirmAction.verb} este pedido?</p><p>Esta ação atualizará o status e registrará histórico.</p><div class="nho2d-confirm-actions"><button id="nho2d-confirm-cancel" class="nho2-btn" style="background:#0b1628;color:#91a4c4;border-color:rgba(148,163,184,.22)">Cancelar</button><button id="nho2d-confirm-submit" class="nho2-btn">Confirmar</button></div></div></div>` : ''}
      ${removeItemIndex !== null ? `<div class="nho2d-confirm-backdrop"><div class="nho2d-confirm"><h4>Remover item</h4><p>Deseja remover este item do pedido?</p><div class="nho2d-confirm-actions"><button id="nho2d-remove-cancel" class="nho2-btn" style="background:#0b1628;color:#91a4c4;border-color:rgba(148,163,184,.22)">Cancelar</button><button id="nho2d-remove-submit" class="nho2-btn">Confirmar</button></div></div></div>` : ''}
    </section>`;
  }

  function render() {
    injectStyles();
    root.innerHTML = `<div class="nho2d-wrap">${renderContent()}</div>`;
    const retry = root.querySelector('#nho2d-retry');
    if (retry) retry.onclick = () => load();
    const back = root.querySelector('#nho2d-back');
    if (back) back.onclick = () => { window.location.hash = back.getAttribute('data-back-route') || '#/pedidos'; };
    const confirmCancel = root.querySelector('#nho2d-confirm-cancel');
    if (confirmCancel) confirmCancel.onclick = () => { confirmAction = null; render(); };
    const confirmSubmit = root.querySelector('#nho2d-confirm-submit');
    if (confirmSubmit) confirmSubmit.onclick = async () => {
      if (!confirmAction || actionLoading) return;
      actionError = '';
      actionSuccess = '';
      actionLoading = confirmAction.key;
      const successLabel = confirmAction.successLabel;
      const targetId = state?.data?.id;
      confirmAction = null;
      render();
      try {
        await updatePedidoStatus(apiClient, targetId, actionLoading);
        state.data = await fetchPedidoDetailsData(apiClient, targetId);
        actionSuccess = successLabel;
      } catch {
        actionError = 'Não foi possível atualizar o status do pedido. Tente novamente.';
      } finally {
        actionLoading = null;
        render();
      }
    };
    const removeCancel = root.querySelector('#nho2d-remove-cancel');
    if (removeCancel) removeCancel.onclick = () => { removeItemIndex = null; render(); };
    const removeSubmit = root.querySelector('#nho2d-remove-submit');
    if (removeSubmit) removeSubmit.onclick = () => { if (removeItemIndex !== null) itensDraft.splice(removeItemIndex, 1); removeItemIndex = null; render(); };
    const editBtn = root.querySelector('#nho2d-edit-itens');
    if (editBtn) editBtn.onclick = async () => { editMode = true; itensMessage = ''; itensDraft = (state?.data?.itens || []).map((i) => ({ ...i })); if (!produtosCatalog.length) produtosCatalog = await fetchProdutosCatalogData(apiClient); render(); };
    const cancelEdit = root.querySelector('#nho2d-cancel-itens');
    if (cancelEdit) cancelEdit.onclick = () => { editMode = false; itensDraft = []; itensMessage = ''; render(); };
    const addItem = root.querySelector('#nho2d-add-item');
    if (addItem) addItem.onclick = () => {
      const select = root.querySelector('#nho2d-add-produto');
      const productId = select?.value;
      if (!productId) return;
      const product = produtosCatalog.find((p) => p.id === productId);
      if (!product) return;
      itensDraft.push({ produtoId: product.id, produto: product.nome || 'Produto não identificado', quantidade: 1, valorUnitario: Number(product.preco ?? product.preco_unitario ?? 0) });
      render();
    };
    root.querySelectorAll('.js-item-qty').forEach((input) => { input.onchange = () => { const idx = Number(input.dataset.index); itensDraft[idx].quantidade = Number(input.value || 0); }; });
    root.querySelectorAll('.js-remove-item').forEach((btn) => { btn.onclick = () => { removeItemIndex = Number(btn.dataset.index); render(); }; });
    const saveItens = root.querySelector('#nho2d-save-itens');
    if (saveItens) saveItens.onclick = async () => {
      if (itensSaving) return;
      itensMessage = '';
      const payloadItens = itensDraft.map((item) => ({
        produto_id: item.produto_id || item.produtoId || '',
        quantidade: Number(item.quantidade || 0)
      }));
      const hasInvalidProduto = payloadItens.some((item) => !String(item.produto_id || '').trim());
      if (hasInvalidProduto) {
        itensMessage = 'Selecione um produto válido para todos os itens.';
        render();
        return;
      }
      itensSaving = true;
      render();
      try {
        await updatePedidoItens(apiClient, state.data.id, payloadItens);
        state.data = await fetchPedidoDetailsData(apiClient, state.data.id);
        editMode = false;
        itensDraft = [];
        itensMessage = 'Itens atualizados com sucesso.';
      } catch {
        itensMessage = 'Não foi possível salvar os itens do pedido. Tente novamente.';
      } finally {
        itensSaving = false;
        render();
      }
    };
    root.querySelectorAll('.js-pedido-action').forEach((button) => {
      button.onclick = () => {
        if (actionLoading) return;
        const nextStatus = button?.dataset?.nextStatus;
        const action = getStatusActions(state?.data?.statusExibicao).find((item) => item.key === nextStatus);
        if (!nextStatus || !state?.data?.id) return;
        actionError = '';
        actionSuccess = '';
        confirmAction = { key: nextStatus, successLabel: action?.successLabel || 'Status atualizado com sucesso.', verb: String(action?.label || 'atualizar').toLowerCase().replace(' pedido', '') };
        render();
      };
    });
    const geralEdit = root.querySelector('#nho2d-geral-edit');
    if (geralEdit) geralEdit.onclick = async () => {
      geralMessage = '';
      if (!clientesCatalog.length) clientesCatalog = await fetchClientesCatalogData(apiClient);
      geralDraft = { cliente_id: state.data?.idCliente || '', origem: state.data?.origemExibicao || 'manual', observacoes: state.data?.observacoes || '' };
      if (!geralDraft.cliente_id) {
        const matched = clientesCatalog.find((c) => (c.empresa || c.razao_social || c.nome) === state.data?.clienteExibicao);
        geralDraft.cliente_id = matched?.id || '';
      }
      geralEditMode = true;
      render();
    };
    const geralCancel = root.querySelector('#nho2d-geral-cancel');
    if (geralCancel) geralCancel.onclick = () => { geralEditMode = false; geralMessage = ''; render(); };
    const geralObs = root.querySelector('#nho2d-geral-obs');
    if (geralObs) geralObs.oninput = (e) => { geralDraft.observacoes = e.target.value || ''; };
    const geralCliente = root.querySelector('#nho2d-geral-cliente');
    if (geralCliente) geralCliente.onchange = (e) => { geralDraft.cliente_id = e.target.value || ''; };
    const geralOrigem = root.querySelector('#nho2d-geral-origem');
    if (geralOrigem) geralOrigem.onchange = (e) => { geralDraft.origem = e.target.value || ''; };
    const geralSave = root.querySelector('#nho2d-geral-save');
    if (geralSave) geralSave.onclick = async () => {
      if (geralSaving) return;
      if (!geralDraft.cliente_id) { geralMessage = 'Selecione um cliente.'; render(); return; }
      if (!geralDraft.origem) { geralMessage = 'Selecione a origem.'; render(); return; }
      geralSaving = true;
      geralMessage = '';
      render();
      try {
        await updatePedidoGeral(apiClient, state.data.id, { cliente_id: geralDraft.cliente_id, origem: geralDraft.origem, observacoes: geralDraft.observacoes || '' });
        state.data = await fetchPedidoDetailsData(apiClient, state.data.id);
        geralEditMode = false;
        geralMessage = 'Dados gerais atualizados com sucesso.';
      } catch (error) {
        geralMessage = error?.body?.error?.message || 'Não foi possível atualizar os dados gerais.';
      } finally {
        geralSaving = false;
        render();
      }
    };
  }

  async function load() {
    state.loading = true;
    state.error = false;
    state.notFound = false;
    render();
    try {
      state.data = await fetchPedidoDetailsData(apiClient, pedidoId);
      if (!state?.data?.id) state.notFound = true;
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
