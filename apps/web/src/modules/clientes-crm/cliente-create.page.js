import { createClienteCreateState } from './cliente-create.state.js';
import { createCliente } from './cliente-create.service.js';

function injectStyles() {
  if (document.getElementById('nh-cliente-create-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-cliente-create-style';
  style.textContent = `
  .nhcc-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .nhcc-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhcc-sub{color:#61708f;font-size:14px;margin-top:6px}
  .nhcc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .nhcc-card{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
  .nhcc-field{display:grid;gap:6px;margin-bottom:10px}
  .nhcc-field input,.nhcc-field select,.nhcc-field textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}
  .nhcc-field textarea{height:92px;padding:10px;resize:vertical}
  .nhcc-row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}
  .nhcc-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#fff;cursor:pointer}
  .nhcc-btn.primary{background:#1f56dc;border-color:#1f56dc;color:#fff;font-weight:700}
  .nhcc-btn[disabled]{opacity:.55;cursor:not-allowed}
  .nhcc-msg{padding:10px;border-radius:10px;font-size:13px;margin-bottom:12px}
  .nhcc-msg.error{background:#fff1f2;color:#b42318}
  .nhcc-msg.ok{background:#ecfdf3;color:#047857}
  @media (max-width:1024px){.nhcc-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function validate(state) {
  if (!String(state.empresa || '').trim()) return 'Informe a empresa do cliente.';
  if (!String(state.razao_social || '').trim() && !String(state.nome_contato || '').trim()) return 'Informe ao menos Razão Social ou Nome de Contato.';
  if (!isValidEmail(state.email)) return 'E-mail inválido.';
  if (state.uf && String(state.uf).trim().length !== 2) return 'UF deve ter 2 caracteres.';
  return '';
}

export function renderClienteCreatePage(root, { apiClient }) {
  injectStyles();
  const state = createClienteCreateState();

  function render() {
    root.innerHTML = `
      <section class="nhcc-head">
        <div><div class="nhcc-title">Novo Cliente</div><div class="nhcc-sub">Cadastro comercial para novos clientes.</div></div>
        <button class="nhcc-btn" id="nhcc-back">Voltar</button>
      </section>
      ${state.error ? `<div class="nhcc-msg error">${state.error}</div>` : ''}
      ${state.success ? `<div class="nhcc-msg ok">${state.success}</div>` : ''}
      <section class="nhcc-grid">
        <article class="nhcc-card">
          <label class="nhcc-field">Empresa<input id="empresa" value="${state.empresa}" ${state.saving ? 'disabled' : ''} /></label>
          <label class="nhcc-field">Razão Social<input id="razao_social" value="${state.razao_social}" ${state.saving ? 'disabled' : ''} /></label>
          <label class="nhcc-field">Nome de Contato<input id="nome_contato" value="${state.nome_contato}" ${state.saving ? 'disabled' : ''} /></label>
          <label class="nhcc-field">E-mail<input id="email" type="email" value="${state.email}" ${state.saving ? 'disabled' : ''} /></label>
          <label class="nhcc-field">Telefone<input id="telefone" value="${state.telefone}" ${state.saving ? 'disabled' : ''} /></label>
        </article>
        <article class="nhcc-card">
          <label class="nhcc-field">Cidade<input id="cidade" value="${state.cidade}" ${state.saving ? 'disabled' : ''} /></label>
          <label class="nhcc-field">UF<input id="uf" maxlength="2" value="${state.uf}" ${state.saving ? 'disabled' : ''} /></label>
          <label class="nhcc-field">Status
            <select id="status" ${state.saving ? 'disabled' : ''}>
              <option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>ativo</option>
              <option value="inativo" ${state.status === 'inativo' ? 'selected' : ''}>inativo</option>
              <option value="prospect" ${state.status === 'prospect' ? 'selected' : ''}>prospect</option>
            </select>
          </label>
          <label class="nhcc-field">Observações<textarea id="observacoes" ${state.saving ? 'disabled' : ''}>${state.observacoes}</textarea></label>
        </article>
      </section>
      <section class="nhcc-row">
        <button class="nhcc-btn" id="cancelar" ${state.saving ? 'disabled' : ''}>Cancelar</button>
        <button class="nhcc-btn primary" id="salvar" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Salvando...' : 'Salvar Cliente'}</button>
      </section>
    `;

    root.querySelector('#nhcc-back').onclick = () => { window.location.hash = '#/clientes'; };
    root.querySelector('#cancelar').onclick = () => { window.location.hash = '#/clientes'; };
    ['empresa', 'razao_social', 'nome_contato', 'email', 'telefone', 'cidade', 'uf', 'observacoes'].forEach((id) => {
      const el = root.querySelector(`#${id}`);
      if (el) el.oninput = (e) => { state[id] = e.target.value || ''; if (id === 'uf') state.uf = String(state.uf || '').toUpperCase(); };
    });
    const status = root.querySelector('#status');
    if (status) status.onchange = (e) => { state.status = e.target.value || 'ativo'; };

    root.querySelector('#salvar').onclick = async () => {
      if (state.saving) return;
      state.error = '';
      state.success = '';
      const error = validate(state);
      if (error) { state.error = error; render(); return; }
      state.saving = true;
      render();
      try {
        const out = await createCliente(apiClient, state);
        const id = out?.item?.id;
        state.success = 'Cliente criado com sucesso.';
        state.saving = false;
        render();
        if (id) window.location.hash = `#/clientes/${id}`;
      } catch (err) {
        state.error = err?.body?.error?.message || err?.message || 'Não foi possível criar cliente.';
        state.saving = false;
        render();
      }
    };
  }

  render();
}
