import { createProdutoCreateState } from './produto-create.state.js';
import { createProduto } from './produto-create.service.js';
import { validateProdutoCreateForm } from './produto-create.mapper.js';

function injectStyles() {
  if (document.getElementById('nh-produto-create-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-produto-create-style';
  style.textContent = `
  .nhpr-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .nhpr-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhpr-sub{color:#61708f;font-size:14px;margin-top:6px}
  .nhpr-card{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
  .nhpr-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .nhpr-field{display:grid;gap:6px;margin-bottom:10px}
  .nhpr-field input,.nhpr-field select,.nhpr-field textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}
  .nhpr-field textarea{height:92px;padding:10px;resize:vertical}
  .nhpr-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  .nhpr-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#fff;cursor:pointer}
  .nhpr-btn.primary{background:#1f56dc;border-color:#1f56dc;color:#fff;font-weight:700}
  .nhpr-btn[disabled]{opacity:.55;cursor:not-allowed}
  .nhpr-msg{padding:10px;border-radius:10px;font-size:13px;margin-bottom:12px}
  .nhpr-msg.error{background:#fff1f2;color:#b42318}.nhpr-msg.ok{background:#ecfdf3;color:#047857}
  .nhpr-ferr{font-size:12px;color:#b42318}
  @media (max-width:1024px){.nhpr-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

export function renderProdutoCreatePage(root, { apiClient }) {
  injectStyles();
  const state = createProdutoCreateState();

  function render() {
    const f = state.form;
    root.innerHTML = `
      <section class="nhpr-head">
        <div><div class="nhpr-title">Novo Produto</div><div class="nhpr-sub">Cadastro de item para o catálogo comercial.</div></div>
        <button class="nhpr-btn" id="nhpr-back">Voltar</button>
      </section>
      ${state.error ? `<div class="nhpr-msg error">${state.error}</div>` : ''}
      ${state.success ? `<div class="nhpr-msg ok">${state.success}</div>` : ''}
      <section class="nhpr-card">
        <div class="nhpr-grid">
          <div>
            <label class="nhpr-field">Nome do Produto *<input id="nome" value="${f.nome}" ${state.loading ? 'disabled' : ''}/>${state.fieldErrors.nome ? `<span class="nhpr-ferr">${state.fieldErrors.nome}</span>` : ''}</label>
            <label class="nhpr-field">SKU<input id="sku" value="${f.sku}" ${state.loading ? 'disabled' : ''}/></label>
            <label class="nhpr-field">Categoria<input id="categoria" value="${f.categoria}" ${state.loading ? 'disabled' : ''}/></label>
          </div>
          <div>
            <label class="nhpr-field">Preço *<input id="preco" placeholder="129,90" value="${f.preco}" ${state.loading ? 'disabled' : ''}/>${state.fieldErrors.preco ? `<span class="nhpr-ferr">${state.fieldErrors.preco}</span>` : ''}</label>
            <label class="nhpr-field">Status<select id="status" ${state.loading ? 'disabled' : ''}><option value="ativo" ${f.status === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${f.status === 'inativo' ? 'selected' : ''}>inativo</option></select></label>
            <label class="nhpr-field">Descrição<textarea id="descricao" ${state.loading ? 'disabled' : ''}>${f.descricao}</textarea></label>
          </div>
        </div>
      </section>
      <section class="nhpr-row">
        <button class="nhpr-btn" id="nhpr-cancel" ${state.loading ? 'disabled' : ''}>Cancelar</button>
        <button class="nhpr-btn primary" id="nhpr-save" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Salvando...' : 'Salvar Produto'}</button>
      </section>
    `;

    root.querySelector('#nhpr-back').onclick = () => { window.location.hash = '#/produtos'; };
    root.querySelector('#nhpr-cancel').onclick = () => { window.location.hash = '#/produtos'; };
    ['nome', 'sku', 'categoria', 'preco', 'descricao'].forEach((id) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.oninput = (e) => { state.form[id] = e.target.value || ''; };
    });
    const status = root.querySelector('#status');
    if (status) status.onchange = (e) => { state.form.status = e.target.value || 'ativo'; };

    root.querySelector('#nhpr-save').onclick = async () => {
      if (state.loading) return;
      state.error = '';
      state.success = '';
      state.fieldErrors = validateProdutoCreateForm(state.form);
      if (Object.keys(state.fieldErrors).length > 0) { render(); return; }
      state.loading = true;
      render();
      try {
        const out = await createProduto(apiClient, state.form);
        state.success = 'Produto salvo com sucesso.';
        const id = out?.item?.id;
        state.loading = false;
        render();
        if (id) window.location.hash = `#/produtos/${id}`;
        else window.location.hash = '#/produtos';
      } catch (error) {
        state.error = error?.body?.error?.message || error?.message || 'Não foi possível salvar o produto.';
        state.loading = false;
        render();
      }
    };
  }

  render();
}
