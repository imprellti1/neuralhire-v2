import { createPedidoCreateState } from './pedido-create.state.js';
import { createPedido, fetchPedidoCreateDependencies } from './pedido-create.service.js';

function brl(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function injectStyles() {
  if (document.getElementById('nh-pedido-create-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-pedido-create-style';
  style.textContent = `
  .nhpc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px;flex-wrap:wrap}
  .nhpc-title{font-size:30px;font-weight:700}
  .nhpc-sub{color:#61708f;font-size:14px}
  .nhpc-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#fff;cursor:pointer}
  .nhpc-btn.primary{background:#1f56dc;border-color:#1f56dc;color:#fff;font-weight:700}
  .nhpc-btn[disabled]{opacity:.5;cursor:not-allowed}
  .nhpc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .nhpc-card{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px}
  .nhpc-card h3{margin:0 0 12px}
  .nhpc-field{display:grid;gap:6px;margin-bottom:10px}
  .nhpc-field input,.nhpc-field select,.nhpc-field textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}
  .nhpc-field textarea{height:90px;padding:10px;resize:vertical}
  .nhpc-items{display:grid;gap:10px}
  .nhpc-item{display:grid;grid-template-columns:1fr 120px 120px 96px;gap:8px;align-items:end}
  .nhpc-msg{padding:10px;border-radius:10px;font-size:13px;margin:10px 0}
  .nhpc-msg.error{background:#fff1f2;color:#b42318}
  .nhpc-msg.ok{background:#ecfdf3;color:#047857}
  .nhpc-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  @media (max-width:1024px){.nhpc-grid{grid-template-columns:1fr}.nhpc-item{grid-template-columns:1fr 1fr}.nhpc-item .full{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
}

function validate(state) {
  if (!state.clienteId) return 'Selecione um cliente.';
  if (!state.itens.length) return 'Adicione ao menos um item.';
  for (const item of state.itens) {
    if (!item.produtoId) return 'Selecione um produto para todos os itens.';
    if (Number(item.quantidade || 0) <= 0) return 'Quantidade deve ser maior que zero.';
  }
  return '';
}

export function renderPedidoCreatePage(root, { apiClient }) {
  injectStyles();
  const state = createPedidoCreateState();

  const getProduto = (id) => state.produtos.find((p) => String(p.id) === String(id));
  const subtotal = state.itens.reduce((sum, item) => sum + (Number(item.quantidade || 0) * Number(getProduto(item.produtoId)?.preco || 0)), 0);
  const desconto = state.itens.reduce((sum, item) => sum + Number(item.desconto || 0), 0);
  const total = Math.max(0, subtotal - desconto);

  function render() {
    const hasClientes = state.clientes.length > 0;
    const hasProdutos = state.produtos.length > 0;

    root.innerHTML = `
      <section class="nhpc-head">
        <div><div class="nhpc-title">Novo Pedido</div><div class="nhpc-sub">Cadastro comercial com validação e prévia financeira.</div></div>
        <button class="nhpc-btn" id="nhpc-back">Voltar</button>
      </section>
      ${state.error ? `<div class="nhpc-msg error">${state.error}</div>` : ''}
      ${state.success ? `<div class="nhpc-msg ok">${state.success}</div>` : ''}
      <section class="nhpc-grid">
        <article class="nhpc-card">
          <h3>Dados do Pedido</h3>
          <label class="nhpc-field">Cliente
            <select id="nhpc-cliente" ${!hasClientes || state.saving ? 'disabled' : ''}>
              <option value="">Selecione</option>
              ${state.clientes.map((c) => `<option value="${c.id}" ${String(state.clienteId) === String(c.id) ? 'selected' : ''}>${c.nome}</option>`).join('')}
            </select>
          </label>
          <label class="nhpc-field">Origem
            <select id="nhpc-origem" ${state.saving ? 'disabled' : ''}>
              <option value="manual" ${state.origem === 'manual' ? 'selected' : ''}>manual</option>
              <option value="site" ${state.origem === 'site' ? 'selected' : ''}>site</option>
              <option value="whatsapp" ${state.origem === 'whatsapp' ? 'selected' : ''}>whatsapp</option>
            </select>
          </label>
          <label class="nhpc-field">Observações
            <textarea id="nhpc-obs" ${state.saving ? 'disabled' : ''}>${state.observacoes || ''}</textarea>
          </label>
          ${!hasClientes ? '<div class="nhpc-msg error">Nenhum cliente disponível para criar pedidos.</div>' : ''}
        </article>
        <article class="nhpc-card">
          <h3>Resumo Financeiro (prévia)</h3>
          <div class="nhpc-field"><b>Subtotal estimado:</b> ${brl(subtotal)}</div>
          <div class="nhpc-field"><b>Desconto estimado:</b> ${brl(desconto)}</div>
          <div class="nhpc-field"><b>Total estimado:</b> ${brl(total)}</div>
          <small style="color:#61708f">Valor final é recalculado no backend.</small>
        </article>
      </section>
      <section class="nhpc-card" style="margin-top:14px">
        <h3>Itens</h3>
        <div class="nhpc-items">
          ${state.itens.map((item, index) => `
            <div class="nhpc-item" data-index="${index}">
              <label class="nhpc-field full">Produto
                <select data-role="produto" ${!hasProdutos || state.saving ? 'disabled' : ''}>
                  <option value="">Selecione</option>
                  ${state.produtos.map((p) => `<option value="${p.id}" ${String(item.produtoId) === String(p.id) ? 'selected' : ''}>${p.nome}</option>`).join('')}
                </select>
              </label>
              <label class="nhpc-field">Quantidade<input data-role="quantidade" type="number" min="1" value="${Number(item.quantidade || 1)}" ${state.saving ? 'disabled' : ''}/></label>
              <label class="nhpc-field">Desconto<input data-role="desconto" type="number" min="0" step="0.01" value="${Number(item.desconto || 0)}" ${state.saving ? 'disabled' : ''}/></label>
              <button class="nhpc-btn" data-role="remover" ${state.saving ? 'disabled' : ''}>Remover</button>
            </div>
          `).join('')}
        </div>
        ${!hasProdutos ? '<div class="nhpc-msg error">Nenhum produto disponível para criar itens.</div>' : ''}
        <div class="nhpc-row">
          <button class="nhpc-btn" id="nhpc-add" ${!hasProdutos || state.saving ? 'disabled' : ''}>Adicionar produto</button>
        </div>
      </section>
      <section class="nhpc-row">
        <button class="nhpc-btn" id="nhpc-cancel" ${state.saving ? 'disabled' : ''}>Cancelar</button>
        <button class="nhpc-btn primary" id="nhpc-save" ${state.loading || state.saving ? 'disabled' : ''}>${state.saving ? 'Criando...' : 'Criar pedido'}</button>
      </section>
    `;

    root.querySelector('#nhpc-back').onclick = () => { window.location.hash = '#/pedidos'; };
    root.querySelector('#nhpc-cancel').onclick = () => { window.location.hash = '#/pedidos'; };

    const clienteEl = root.querySelector('#nhpc-cliente');
    if (clienteEl) clienteEl.onchange = (e) => { state.clienteId = e.target.value || ''; };
    const origemEl = root.querySelector('#nhpc-origem');
    if (origemEl) origemEl.onchange = (e) => { state.origem = e.target.value || 'manual'; };
    const obsEl = root.querySelector('#nhpc-obs');
    if (obsEl) obsEl.oninput = (e) => { state.observacoes = e.target.value || ''; };

    const add = root.querySelector('#nhpc-add');
    if (add) add.onclick = () => { state.itens.push({ produtoId: '', quantidade: 1, desconto: 0 }); render(); };

    root.querySelectorAll('.nhpc-item').forEach((row) => {
      const idx = Number(row.getAttribute('data-index'));
      const produto = row.querySelector('[data-role="produto"]');
      const quantidade = row.querySelector('[data-role="quantidade"]');
      const descontoInput = row.querySelector('[data-role="desconto"]');
      const remover = row.querySelector('[data-role="remover"]');
      if (produto) produto.onchange = (e) => { state.itens[idx].produtoId = e.target.value || ''; render(); };
      if (quantidade) quantidade.oninput = (e) => { state.itens[idx].quantidade = Number(e.target.value || 0); render(); };
      if (descontoInput) descontoInput.oninput = (e) => { state.itens[idx].desconto = Number(e.target.value || 0); render(); };
      if (remover) remover.onclick = () => { state.itens.splice(idx, 1); render(); };
    });

    const save = root.querySelector('#nhpc-save');
    if (save) save.onclick = async () => {
      if (state.saving) return;
      state.error = '';
      state.success = '';
      const validationError = validate(state);
      if (validationError) {
        state.error = validationError;
        render();
        return;
      }

      state.saving = true;
      render();
      try {
        const out = await createPedido(apiClient, state);
        const id = out?.pedido?.id;
        state.success = 'Pedido criado com sucesso.';
        render();
        if (id) window.location.hash = `#/pedidos/${id}`;
      } catch (error) {
        state.error = error?.body?.error?.message || error?.message || 'Não foi possível criar o pedido.';
        state.saving = false;
        render();
      }
    };
  }

  async function load() {
    state.loading = true;
    state.error = '';
    render();
    try {
      const data = await fetchPedidoCreateDependencies(apiClient);
      state.clientes = data.clientes || [];
      state.produtos = data.produtos || [];
    } catch {
      state.error = 'Falha ao carregar clientes e produtos.';
    } finally {
      state.loading = false;
      render();
    }
  }

  render();
  load();
}
