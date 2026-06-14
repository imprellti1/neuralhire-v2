function injectStyles() {
  if (document.getElementById('nhpc-style')) return;
  const style = document.createElement('style');
  style.id = 'nhpc-style';
  style.textContent = `
    .nhpc-wrap{display:grid;gap:14px}
    .nhpc-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}
    .nhpc-title{font-size:30px;font-weight:800;letter-spacing:-.03em}
    .nhpc-sub{color:#61708f;font-size:14px;margin-top:6px;max-width:72ch}
    .nhpc-card{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
    .nhpc-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .nhpc-input,.nhpc-select,.nhpc-field input,.nhpc-field select,.nhpc-field textarea{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}
    .nhpc-field textarea{height:88px;padding:10px;resize:vertical}
    .nhpc-btn{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 12px;background:#0b1628;color:#e7eefb;cursor:pointer;font-weight:600}
    .nhpc-btn.primary{background:#4f8cff;color:#fff;border-color:#4f8cff}
    .nhpc-btn.danger{background:#0b1628;color:#fca5a5;border-color:rgba(248,113,113,.22)}
    .nhpc-grid{overflow:auto}
    .nhpc-table{width:100%;border-collapse:collapse;min-width:1060px}
    .nhpc-table th,.nhpc-table td{padding:12px 10px;border-bottom:1px solid #edf2f8;text-align:left;vertical-align:top;font-size:13px}
    .nhpc-table th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#a9bbd8}
    .nhpc-badge{display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700}
    .nhpc-badge.ok{background:rgba(52,211,153,.16);color:#34d399}.nhpc-badge.off{background:rgba(251,191,36,.16);color:#fbbf24}
    .nhpc-state{padding:28px;text-align:center;color:#91a4c4}
    .nhpc-empty{display:grid;gap:10px;place-items:center;padding:30px 14px}
    .nhpc-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.42);display:grid;place-items:center;padding:16px;z-index:40}
    .nhpc-modal{width:min(780px,100%);background:#0f1b2f;border-radius:18px;border:1px solid rgba(148,163,184,.18);box-shadow:0 24px 72px rgba(0,0,0,.32);padding:18px}
    .nhpc-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
    .nhpc-modal-title{font-size:22px;font-weight:800}
    .nhpc-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .nhpc-field{display:grid;gap:6px}
    .nhpc-field.full{grid-column:1/-1}
    .nhpc-ferr{font-size:12px;color:#b42318}
    .nhpc-msg{padding:10px 12px;border-radius:10px;font-size:13px}
    .nhpc-msg.error{background:rgba(248,113,113,.12);color:#fca5a5}.nhpc-msg.ok{background:rgba(52,211,153,.16);color:#34d399}
    @media (max-width:900px){.nhpc-form{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function forbiddenKey(parts) {
  return parts.join('');
}

function filterItems(items, filters) {
  const q = String(filters.search || '').trim().toLowerCase();
  return (items || []).filter((item) => {
    const statusOk = !filters.status || String(item.status || '') === String(filters.status);
    const searchOk = !q || [item.nome, item.slug, item.descricao, item.parent_nome].some((v) => String(v || '').toLowerCase().includes(q));
    return statusOk && searchOk;
  });
}

function buildCategoriesById(items) {
  return new Map((items || []).map((item) => [String(item.id), item]));
}

function getParentCategoryName(item, categoriesById) {
  const parentId = item?.parent_id || item?.categoria_pai_id;
  if (!parentId) return 'Sem pai';
  return categoriesById.get(String(parentId))?.nome || 'Categoria não encontrada';
}

function buildParentOptions(items, currentId, selectedId) {
  return (items || [])
    .filter((item) => String(item.id) !== String(currentId || ''))
    .map((item) => `<option value="${item.id}" ${String(selectedId || '') === String(item.id) ? 'selected' : ''}>${item.parent_id ? `↳ ${item.nome}` : item.nome}</option>`)
    .join('');
}

function createForm(item = {}) {
  return { id: item.id || '', nome: item.nome || '', descricao: item.descricao || '', parent_id: item.parent_id || '', status: item.status || 'ativo' };
}

function validateForm(form) {
  const errors = {};
  if (!String(form.nome || '').trim()) errors.nome = 'Nome obrigatório.';
  if (!['ativo', 'inativo'].includes(String(form.status || ''))) errors.status = 'Status inválido.';
  return errors;
}

function renderModal(state, items) {
  if (!state.modalOpen) return '';
  const form = state.form;
  const slug = slugify(form.nome);
  return `<div class="nhpc-modal-backdrop" role="dialog" aria-modal="true"><div class="nhpc-modal"><div class="nhpc-modal-head"><div><div class="nhpc-modal-title">${state.editingId ? 'Editar categoria' : 'Nova categoria'}</div><div class="nhpc-sub">Cadastre, edite e inative categorias sem expor campos sensíveis.</div></div><button class="nhpc-btn" id="nhpc-close">Fechar</button></div>${state.message ? `<div class="nhpc-msg ${state.messageType || ''}" role="status">${state.message}</div>` : ''}<div class="nhpc-form"><label class="nhpc-field">Nome<input id="nhpc-nome" value="${form.nome}" ${state.saving ? 'disabled' : ''}>${state.errors.nome ? `<span class="nhpc-ferr">${state.errors.nome}</span>` : ''}</label><label class="nhpc-field">Categoria pai<select id="nhpc-parent_id" ${state.saving ? 'disabled' : ''}><option value="">Sem pai</option>${buildParentOptions(items, state.editingId, form.parent_id)}</select></label><label class="nhpc-field full">Descrição<textarea id="nhpc-descricao" ${state.saving ? 'disabled' : ''}>${form.descricao}</textarea></label><label class="nhpc-field">Status<select id="nhpc-status" ${state.saving ? 'disabled' : ''}><option value="ativo" ${form.status === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${form.status === 'inativo' ? 'selected' : ''}>inativo</option></select>${state.errors.status ? `<span class="nhpc-ferr">${state.errors.status}</span>` : ''}</label><label class="nhpc-field">Slug<input value="${slug}" disabled></label></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button id="nhpc-cancel" class="nhpc-btn">Cancelar</button><button id="nhpc-save" class="nhpc-btn primary">${state.saving ? 'Salvando...' : 'Salvar categoria'}</button></div></div></div>`;
}

export async function renderProdutoCategoriasPage(container, { apiClient } = {}) {
  injectStyles();
  const state = { loading: true, error: '', items: [], filters: { search: '', status: '' }, modalOpen: false, editingId: '', form: createForm(), errors: {}, saving: false, message: '', messageType: '' };
  let searchRenderTimer = null;

  async function load() {
    state.loading = true;
    state.error = '';
    render();
    try {
      const response = await apiClient.get('/produto-categorias');
      state.items = Array.isArray(response?.items) ? response.items : [];
    } catch (error) {
      state.error = error?.body?.error?.message || error?.message || 'Não foi possível carregar as categorias.';
    } finally {
      state.loading = false;
      render();
    }
  }

  function openModal(item = null) {
    state.modalOpen = true;
    state.editingId = item?.id || '';
    state.form = createForm(item || {});
    state.errors = {};
    state.message = '';
    state.messageType = '';
    render();
  }

  function closeModal() {
    state.modalOpen = false;
    state.editingId = '';
    state.form = createForm();
    state.errors = {};
    render();
  }

  function render() {
    const visible = filterItems(state.items, state.filters);
    const categoriesById = buildCategoriesById(state.items);
    container.innerHTML = `<div class="nhpc-wrap"><section class="nhpc-head"><div><div class="nhpc-title">Categorias de Produto</div><div class="nhpc-sub">Módulo operacional para manter categorias reais, com ativação/inativação e uso nos cadastros de produto.</div></div><div class="nhpc-toolbar"><input id="nhpc-search" class="nhpc-input" placeholder="Buscar por nome ou slug" value="${state.filters.search || ''}"><select id="nhpc-status" class="nhpc-select"><option value="">Todos os status</option><option value="ativo" ${state.filters.status === 'ativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${state.filters.status === 'inativo' ? 'selected' : ''}>Inativo</option></select><button id="nhpc-new" class="nhpc-btn primary">Nova Categoria</button></div></section><section class="nhpc-card">${state.loading ? '<div class="nhpc-state">Carregando categorias...</div>' : state.error ? `<div class="nhpc-empty"><div class="nhpc-state">${state.error}</div><button id="nhpc-retry" class="nhpc-btn">Tentar novamente</button></div>` : visible.length ? `<div class="nhpc-grid"><table class="nhpc-table"><thead><tr><th>Nome</th><th>Slug</th><th>Categoria pai</th><th>Status</th><th>Descrição</th><th>Ações</th></tr></thead><tbody>${visible.map((item) => `<tr><td>${item.nome || '-'}</td><td>${item.slug || '-'}</td><td>${getParentCategoryName(item, categoriesById)}</td><td><span class="nhpc-badge ${String(item.status) === 'ativo' ? 'ok' : 'off'}">${item.status || '-'}</span></td><td>${item.descricao || '-'}</td><td><button class="nhpc-btn" data-edit="${item.id}">Editar</button> <button class="nhpc-btn danger" data-toggle="${item.id}">${String(item.status) === 'ativo' ? 'Inativar' : 'Ativar'}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="nhpc-empty"><div class="nhpc-state">Nenhuma categoria encontrada.</div><button id="nhpc-empty-new" class="nhpc-btn primary">Nova Categoria</button></div>`}</section>${renderModal(state, state.items)}</div>`;

    const search = container.querySelector('#nhpc-search');
    if (search) search.oninput = (e) => {
      state.filters.search = e.target.value || '';
      if (searchRenderTimer) clearTimeout(searchRenderTimer);
      searchRenderTimer = setTimeout(() => {
        searchRenderTimer = null;
        render();
      }, 120);
    };
    const status = container.querySelector('#nhpc-status');
    if (status) status.onchange = (e) => { state.filters.status = e.target.value || ''; render(); };
    const retry = container.querySelector('#nhpc-retry');
    if (retry) retry.onclick = () => load();
    const newBtn = container.querySelector('#nhpc-new') || container.querySelector('#nhpc-empty-new');
    if (newBtn) newBtn.onclick = () => openModal();
    container.querySelectorAll('[data-edit]').forEach((btn) => btn.onclick = () => openModal(state.items.find((item) => String(item.id) === String(btn.dataset.edit))));
    container.querySelectorAll('[data-toggle]').forEach((btn) => btn.onclick = async () => {
      const item = state.items.find((row) => String(row.id) === String(btn.dataset.toggle));
      if (!item) return;
      state.message = '';
      state.saving = true;
      render();
      try {
        const next = String(item.status) === 'ativo' ? await apiClient.delete(`/produto-categorias/${item.id}`) : await apiClient.patch(`/produto-categorias/${item.id}`, { status: 'ativo' });
        state.message = String(item.status) === 'ativo' ? 'Categoria inativada com sucesso.' : 'Categoria ativada com sucesso.';
        state.messageType = 'ok';
        await load();
      } catch (error) {
        state.message = error?.body?.error?.message || error?.message || 'Não foi possível atualizar a categoria.';
        state.messageType = 'error';
        render();
      } finally {
        state.saving = false;
        render();
      }
    });

    if (state.modalOpen) {
      const close = container.querySelector('#nhpc-close');
      const cancel = container.querySelector('#nhpc-cancel');
      const nome = container.querySelector('#nhpc-nome');
      const parent = container.querySelector('#nhpc-parent_id');
      const descricao = container.querySelector('#nhpc-descricao');
      const stat = container.querySelector('#nhpc-status');
      if (close) close.onclick = closeModal;
      if (cancel) cancel.onclick = closeModal;
      if (nome) nome.oninput = (e) => { state.form.nome = e.target.value || ''; };
      if (parent) parent.onchange = (e) => { state.form.parent_id = e.target.value || ''; };
      if (descricao) descricao.oninput = (e) => { state.form.descricao = e.target.value || ''; };
      if (stat) stat.onchange = (e) => { state.form.status = e.target.value || 'ativo'; };
      const save = container.querySelector('#nhpc-save');
      if (save) save.onclick = async () => {
        if (state.saving) return;
        state.errors = validateForm(state.form);
        if (Object.keys(state.errors).length) return render();
        state.saving = true;
        render();
        const payload = { nome: state.form.nome, descricao: state.form.descricao, parent_id: state.form.parent_id || null, status: state.form.status };
        try {
          if (state.editingId) await apiClient.patch(`/produto-categorias/${state.editingId}`, payload);
          else await apiClient.post('/produto-categorias', payload);
          state.message = state.editingId ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.';
          state.messageType = 'ok';
          closeModal();
          await load();
        } catch (error) {
          state.message = error?.body?.error?.code === 'PRODUTO_CATEGORIA_DUPLICADA' ? 'Já existe uma categoria com esse nome neste tenant.' : error?.body?.error?.message || error?.message || 'Não foi possível salvar a categoria.';
          state.messageType = 'error';
          state.saving = false;
          render();
        } finally {
          state.saving = false;
        }
      };
    }
  }

  render();
  await load();
}
