import { createGruposComerciaisState } from './grupos-comerciais.state.js';
import { addGrupoComercialClientes, fetchGrupoComercialClientes, fetchGruposComerciais, removeGrupoComercialCliente, saveGrupoComercial, searchClientes } from './grupos-comerciais.service.js';

function injectStyles() {
  if (document.getElementById('nh-gc-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-gc-style';
  style.textContent = `.nhgc-wrap{max-width:1280px;margin:0 auto}.nhgc-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhgc-title{font-size:30px;font-weight:800}.nhgc-sub{color:#91a4c4}.nhgc-tools{display:flex;gap:10px;flex-wrap:wrap}.nhgc-input,.nhgc-btn{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 12px;background:#0b1628;color:#e7eefb}.nhgc-btn{background:#1f56dc;border-color:#1f56dc;cursor:pointer}.nhgc-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);margin-bottom:14px}.nhgc-table{width:100%;border-collapse:collapse}.nhgc-table td,.nhgc-table th{padding:10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left}.nhgc-row:hover td{background:rgba(79,140,255,.12)}.nhgc-modal-backdrop{position:fixed;inset:0;background:rgba(9,16,32,.46);display:flex;align-items:center;justify-content:center;padding:20px;z-index:90}.nhgc-modal{width:min(900px,100%);max-height:92vh;overflow:auto;background:linear-gradient(180deg,rgba(15,27,47,.98),rgba(11,21,37,.99));border:1px solid rgba(148,163,184,.18);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.38)}.nhgc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nhgc-field{display:grid;gap:6px}.nhgc-field input,.nhgc-field textarea{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nhgc-field textarea{height:84px;padding:10px;resize:vertical}.nhgc-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#0b1628;color:#91a4c4;font-size:12px}.nhgc-list{display:grid;gap:8px}.nhgc-card{border:1px solid rgba(148,163,184,.14);border-radius:12px;padding:12px;background:rgba(11,22,40,.72)}.nhgc-empty{color:#91a4c4;padding:10px 0}@media (max-width:900px){.nhgc-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}
function safe(v, f = '-') { const t = String(v || '').trim(); return t || f; }
function formatClienteVinculado(item) {
  const cliente = item?.cliente || {};
  const nome = cliente.nome || cliente.razao_social || item?.nome || item?.cliente_nome || 'Cliente sem nome';
  const detalhes = [cliente.codigo || item?.codigo, [cliente.cidade || item?.cidade, cliente.estado || item?.estado].filter(Boolean).join('/')]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' • ');
  return { nome, detalhes };
}
function createForm(selected = null) { return { nome: selected?.nome || '', descricao: selected?.descricao || '', ativo: selected?.ativo !== false }; }
function validateForm(form) { return String(form?.nome || '').trim().length >= 2 ? '' : 'Informe um nome para o grupo comercial.'; }

export function renderGruposComerciaisPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createGruposComerciaisState();
  let clientesSearchRequestId = 0;

  function render() {
    const filtered = state.items.filter((item) => [item.nome, item.descricao].some((v) => String(v || '').toLowerCase().includes(String(state.search || '').toLowerCase())));
    const rows = filtered.map((item) => `<tr class="nhgc-row"><td><strong>${safe(item.nome)}</strong></td><td>${safe(item.descricao)}</td><td><span class="nhgc-pill">${item.ativo ? 'Ativo' : 'Inativo'}</span></td><td><button class="nhgc-btn" data-edit="${item.id}">Editar</button> <button class="nhgc-btn" data-clients="${item.id}">Clientes do grupo</button></td></tr>`).join('');
    root.innerHTML = `<div class="nhgc-wrap"><div class="nhgc-head"><div><div class="nhgc-title">Grupos Comerciais</div><div class="nhgc-sub">Agrupe clientes por estratégia comercial.</div></div><div class="nhgc-tools"><input id="nhgc-search" class="nhgc-input" placeholder="Pesquisar" value="${state.search}"><button id="nhgc-new" class="nhgc-btn">Novo grupo</button></div></div><div class="nhgc-panel"><table class="nhgc-table"><thead><tr><th>Nome</th><th>Descrição</th><th>Status</th><th>Ações</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="nhgc-empty">Nenhum grupo cadastrado.</td></tr>'}</tbody></table></div>${state.modalOpen ? renderModal() : ''}${state.clientesModalOpen ? renderClientesModal() : ''}</div>`;
    bind();
  }
  function renderClientesResultados() {
    const target = root.querySelector('#nhgc-clientes-resultados');
    if (!target) return;
    target.innerHTML = (state.clientesDisponiveis || []).map((c) => `<label class="nhgc-card"><input type="checkbox" data-select-cliente="${c.id}" ${state.selectedClienteIds.has(c.id) ? 'checked' : ''}> <strong>${safe(c.nome)}</strong><div class="nhgc-sub">${safe(c.email)}</div></label>`).join('') || '<div class="nhgc-empty">Busque clientes para adicionar.</div>';
    bindClientesResultados();
  }
  function renderClientesSelecionados() {
    const target = root.querySelector('#nhgc-clientes-selecionados');
    if (!target) return;
    target.textContent = `${state.selectedClienteIds.size} cliente(s)`;
  }
  function renderClientesVinculados() {
    const target = root.querySelector('#nhgc-clientes-vinculados');
    if (!target) return;
    target.innerHTML = (state.clientesVinculados || []).map((c) => {
      const info = formatClienteVinculado(c);
      return `<div class="nhgc-card"><strong>${safe(info.nome)}</strong>${info.detalhes ? `<div class="nhgc-sub">${safe(info.detalhes)}</div>` : ''}<button class="nhgc-btn" data-remove-cliente="${c.cliente_id}">Remover</button></div>`;
    }).join('') || '<div class="nhgc-empty">Nenhum cliente vinculado.</div>';
    bindClientesVinculados();
  }
  function openModal(selected = null) { state.selected = selected; state.form = createForm(selected); state.formError = ''; state.modalOpen = true; render(); }
  function closeModal() { state.modalOpen = false; state.selected = null; state.form = null; state.formError = ''; render(); }
  function openClientesModal(selected = null) { state.selected = selected; state.clientesModalOpen = true; state.clienteSearch = ''; state.selectedClienteIds = new Set(); loadClientesDoGrupo(); render(); }
  function closeClientesModal() { state.clientesModalOpen = false; state.selected = null; render(); }
  function renderModal() {
    const g = state.form || createForm(state.selected);
    return `<div class="nhgc-modal-backdrop"><div class="nhgc-modal"><div class="nhgc-panel"><div class="nhgc-head"><div><div class="nhgc-title">${state.selected?.id ? 'Editar grupo' : 'Novo grupo'}</div></div><button class="nhgc-btn" data-close-modal>Fechar</button></div>${state.formError ? `<div class="nhgc-empty" role="alert">${state.formError}</div>` : ''}<div class="nhgc-grid"><label class="nhgc-field"><span>Nome</span><input id="nhgc-nome" value="${safe(g.nome, '')}"></label><label class="nhgc-field"><span>Ativo</span><select id="nhgc-ativo" class="nhgc-input"><option value="true" ${g.ativo !== false ? 'selected' : ''}>Sim</option><option value="false" ${g.ativo === false ? 'selected' : ''}>Não</option></select></label><label class="nhgc-field" style="grid-column:1/-1"><span>Descrição</span><textarea id="nhgc-descricao">${safe(g.descricao, '')}</textarea></label></div><div style="margin-top:14px;text-align:right"><button class="nhgc-btn" id="nhgc-save" ${state.saving ? 'disabled' : ''}>${state.saving ? 'Salvando...' : 'Salvar'}</button></div></div></div></div>`;
  }
  function renderClientesModal() {
    return `<div class="nhgc-modal-backdrop"><div class="nhgc-modal"><div class="nhgc-panel"><div class="nhgc-head"><div><div class="nhgc-title">Clientes do grupo</div><div class="nhgc-sub">${safe(state.selected?.nome, '')}</div></div><button class="nhgc-btn" data-close-clientes>Fechar</button></div><div class="nhgc-grid"><div class="nhgc-field"><span>Buscar clientes</span><input id="nhgc-cliente-search" value="${state.clienteSearch}" placeholder="Nome, documento, email..."></div><div class="nhgc-field"><span>Selecionados</span><div id="nhgc-clientes-selecionados" class="nhgc-pill">${state.selectedClienteIds.size} cliente(s)</div></div></div><div class="nhgc-grid" style="margin-top:12px"><div><div class="nhgc-sub">Resultados</div><div id="nhgc-clientes-resultados" class="nhgc-list"></div></div><div><div class="nhgc-sub">Já vinculados</div><div id="nhgc-clientes-vinculados" class="nhgc-list"></div></div></div><div style="margin-top:14px;text-align:right"><button class="nhgc-btn" id="nhgc-add-clientes">Adicionar selecionados</button></div></div></div></div>`;
  }
  function bind() {
    root.querySelector('#nhgc-search')?.addEventListener('input', (e) => { state.search = e.target.value || ''; render(); });
    root.querySelector('#nhgc-new')?.addEventListener('click', () => openModal(null));
    root.querySelector('[data-close-modal]')?.addEventListener('click', closeModal);
    root.querySelector('[data-close-clientes]')?.addEventListener('click', closeClientesModal);
    root.querySelector('#nhgc-save')?.addEventListener('click', saveCurrent);
    root.querySelector('#nhgc-nome')?.addEventListener('input', (e) => { state.form = { ...state.form, nome: e.target.value || '' }; state.formError = ''; });
    root.querySelector('#nhgc-descricao')?.addEventListener('input', (e) => { state.form = { ...state.form, descricao: e.target.value || '' }; });
    root.querySelector('#nhgc-ativo')?.addEventListener('change', (e) => { state.form = { ...state.form, ativo: e.target.value === 'true' }; });
    root.querySelector('#nhgc-add-clientes')?.addEventListener('click', addSelectedClientes);
    root.querySelector('#nhgc-cliente-search')?.addEventListener('input', (e) => {
      const value = e.target.value || '';
      state.clienteSearch = value;
      loadClientesBuscados(value);
    });
    root.querySelectorAll('[data-edit]').forEach((el) => el.addEventListener('click', () => openModal(state.items.find((item) => item.id === el.getAttribute('data-edit')))));
    root.querySelectorAll('[data-clients]').forEach((el) => el.addEventListener('click', () => openClientesModal(state.items.find((item) => item.id === el.getAttribute('data-clients')))));
    root.querySelectorAll('[data-select-cliente]').forEach((el) => el.addEventListener('change', () => { const id = el.getAttribute('data-select-cliente'); if (el.checked) state.selectedClienteIds.add(id); else state.selectedClienteIds.delete(id); render(); }));
    root.querySelectorAll('[data-remove-cliente]').forEach((el) => el.addEventListener('click', async () => { await removeGrupoComercialCliente(apiClient, state.selected.id, el.getAttribute('data-remove-cliente')); await loadClientesDoGrupo(); }));
  }
  function bindClientesResultados() {
    root.querySelectorAll('[data-select-cliente]').forEach((el) => el.addEventListener('change', () => {
      const id = el.getAttribute('data-select-cliente');
      if (el.checked) state.selectedClienteIds.add(id);
      else state.selectedClienteIds.delete(id);
      renderClientesSelecionados();
    }));
  }
  function bindClientesVinculados() {
    root.querySelectorAll('[data-remove-cliente]').forEach((el) => el.addEventListener('click', async () => {
      await removeGrupoComercialCliente(apiClient, state.selected.id, el.getAttribute('data-remove-cliente'));
      await loadClientesDoGrupo();
    }));
  }
  async function load() { state.loading = true; render(); try { const res = await fetchGruposComerciais(apiClient); state.items = res.items || []; } catch { state.error = true; } finally { state.loading = false; render(); } }
  async function saveCurrent() {
    const payload = {
      nome: root.querySelector('#nhgc-nome')?.value || '',
      descricao: root.querySelector('#nhgc-descricao')?.value || '',
      ativo: root.querySelector('#nhgc-ativo')?.value === 'true'
    };
    state.form = { ...state.form, ...payload };
    state.formError = validateForm(payload);
    if (state.formError) { render(); return; }
    state.saving = true;
    render();
    try {
      await saveGrupoComercial(apiClient, payload, state.selected?.id || null);
      closeModal();
      await load();
    } catch (error) {
      state.formError = error?.status === 422 ? 'Informe um nome para o grupo comercial.' : 'Não foi possível salvar o grupo comercial. Tente novamente.';
      render();
    } finally {
      state.saving = false;
      render();
    }
  }
  async function loadClientesBuscados(nextQuery = state.clienteSearch) {
    const query = String(nextQuery || '');
    const trimmedQuery = query.trim();
    const requestId = ++clientesSearchRequestId;
    if (trimmedQuery.length < 1) {
      state.clientesDisponiveis = [];
      state.clientesLoading = false;
      renderClientesResultados();
      return;
    }
    state.clientesLoading = true;
    try {
      const res = await searchClientes(apiClient, trimmedQuery);
      if (requestId !== clientesSearchRequestId) return;
      state.clientesDisponiveis = res.items || [];
      renderClientesResultados();
    } finally {
      if (requestId !== clientesSearchRequestId) return;
      state.clientesLoading = false;
    }
  }
  async function loadClientesDoGrupo() {
    if (!state.selected?.id) return;
    const res = await fetchGrupoComercialClientes(apiClient, state.selected.id);
    state.clientesVinculados = res.items || [];
    if (state.clientesModalOpen) renderClientesVinculados();
  }
  async function addSelectedClientes() {
    await addGrupoComercialClientes(apiClient, state.selected.id, Array.from(state.selectedClienteIds));
    state.selectedClienteIds = new Set();
    renderClientesSelecionados();
    await loadClientesDoGrupo();
  }
  render(); load();
}
