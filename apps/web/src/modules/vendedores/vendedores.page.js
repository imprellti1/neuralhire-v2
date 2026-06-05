import { createVendedoresState } from './vendedores.state.js';
import { fetchFabricantesLookup, fetchVendedorFabricantes, fetchVendedoresData, saveVendedor, saveVendedorFabricantes } from './vendedores.service.js';

function injectStyles() {
  if (document.getElementById('nh-vendedores-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-vendedores-style';
  style.textContent = `.nhv-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06)}.nhv-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhv-title{font-size:30px;font-weight:700}.nhv-sub{color:#61708f}.nhv-tools{display:grid;grid-template-columns:minmax(280px,1fr) 160px 140px;gap:10px}.nhv-input,.nhv-btn,.nhv-select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff}.nhv-btn{background:#1f56dc;border-color:#1f56dc;color:#fff;cursor:pointer}.nhv-table{width:100%;border-collapse:collapse;font-size:13px}.nhv-table td,.nhv-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nhv-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#eef4ff;color:#1f56dc;font-size:12px;font-weight:600}.nhv-state{padding:24px;text-align:center;color:#61708f}.nhv-badges{display:flex;flex-wrap:wrap;gap:6px}.nhv-badge{padding:4px 8px;background:#f1f5ff;border-radius:999px;color:#234}.nhv-modal-backdrop{position:fixed;inset:0;background:rgba(8,15,30,.44);display:flex;align-items:center;justify-content:center;padding:16px;z-index:90}.nhv-modal{width:min(920px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe4f2;border-radius:18px;box-shadow:0 24px 64px rgba(16,34,68,.22)}.nhv-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px;border-bottom:1px solid #edf2f7}.nhv-modal-body{padding:18px}.nhv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nhv-field{display:grid;gap:6px}.nhv-field input,.nhv-field textarea,.nhv-field select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nhv-field textarea{height:92px;padding:10px;resize:vertical}.nhv-field-full{grid-column:1/-1}.nhv-fabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:220px;overflow:auto;padding:12px;border:1px solid #dbe4f2;border-radius:12px;background:#f9fbff}.nhv-fab{display:flex;gap:8px;align-items:flex-start;padding:8px;border:1px solid #e6edf9;border-radius:10px;background:#fff}.nhv-fab small{display:block;color:#6b7b95}.nhv-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.nhv-muted{color:#61708f;font-size:13px}@media (max-width:1024px){.nhv-tools,.nhv-form,.nhv-fabs{grid-template-columns:1fr}.nhv-title{font-size:24px}}`;
  document.head.appendChild(style);
}

function normalizeVendedorForm(item = null) {
  return {
    nome: item?.nome || '',
    email: item?.email || '',
    telefone: item?.telefone || '',
    status: item?.status || 'ativo',
    observacoes: item?.observacoes || '',
    fabricante_ids: []
  };
}

export function renderVendedoresPage(root, { apiClient }) {
  injectStyles();
  const state = createVendedoresState();
  state.form = normalizeVendedorForm();
  state.fabricantes = [];

  function selectedFabSet() {
    return new Set((state.form.fabricante_ids || []).map((id) => String(id)));
  }

  function openModal(item = null) {
    state.modalOpen = true;
    state.selected = item;
    state.form = normalizeVendedorForm(item);
    render();
    if (item?.id) loadFabricantesFor(item.id);
  }

  function closeModal() {
    state.modalOpen = false;
    state.selected = null;
    state.form = normalizeVendedorForm();
    render();
  }

  async function loadFabricantesFor(vendedorId) {
    try {
      const data = await fetchVendedorFabricantes(apiClient, vendedorId);
      state.form.fabricante_ids = (data.items || []).map((row) => row.fabricante_id || row.fabricantes?.id || row.fabricante?.id).filter(Boolean);
      render();
    } catch {
      state.error = true;
      render();
    }
  }

  function renderModal() {
    const fabIds = selectedFabSet();
    const fabList = state.fabricantes.map((fab) => `
      <label class="nhv-fab">
        <input type="checkbox" data-fab-id="${fab.id}" ${fabIds.has(String(fab.id)) ? 'checked' : ''}>
        <span><strong>${fab.nome || fab.nomeExibicao || '-'}</strong><small>${fab.cnpj || ''}</small></span>
      </label>`).join('');
    return `<div class="nhv-modal-backdrop" id="nhv-modal-backdrop" tabindex="0"><div class="nhv-modal"><div class="nhv-modal-head"><div><div class="nhv-title">${state.selected ? 'Editar vendedor' : 'Novo vendedor'}</div><div class="nhv-sub">Cadastre os dados e mantenha os vínculos de fábricas sincronizados.</div></div><button id="nhv-close" class="nhv-btn" type="button">Fechar</button></div><div class="nhv-modal-body"><div class="nhv-form"><label class="nhv-field"><span>Nome*</span><input id="nhv-nome" value="${state.form.nome}"></label><label class="nhv-field"><span>E-mail</span><input id="nhv-email" value="${state.form.email}"></label><label class="nhv-field"><span>Telefone</span><input id="nhv-telefone" value="${state.form.telefone}"></label><label class="nhv-field"><span>Status</span><select id="nhv-status-form"><option value="ativo" ${state.form.status === 'ativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${state.form.status === 'inativo' ? 'selected' : ''}>Inativo</option></select></label><label class="nhv-field nhv-field-full"><span>Observações</span><textarea id="nhv-observacoes">${state.form.observacoes}</textarea></label><div class="nhv-field nhv-field-full"><strong>Fábricas vinculadas</strong><div class="nhv-muted">Selecione uma ou mais fábricas para este vendedor.</div><div class="nhv-fabs">${fabList || '<div class="nhv-muted">Nenhuma fábrica disponível.</div>'}</div></div></div><div class="nhv-actions"><button id="nhv-save" class="nhv-btn" type="button">${state.saving ? 'Salvando...' : 'Salvar'}</button></div></div></div></div>`;
  }

  function render() {
    const rows = state.items.map((item) => `<tr><td>${item.nome || '-'}</td><td>${item.email || '-'}</td><td>${item.telefone || '-'}</td><td><span class="nhv-pill">${item.status || 'ativo'}</span></td><td><div class="nhv-badges">${(item.fabricantesText || '').split(', ').filter(Boolean).map((f) => `<span class="nhv-badge">${f}</span>`).join('') || '<span class="nhv-badge">Sem fábricas</span>'}</div></td><td><button class="nhv-btn" data-edit-id="${item.id}">Editar</button> <button class="nhv-btn" data-toggle-id="${item.id}">${item.status === 'ativo' ? 'Inativar' : 'Ativar'}</button></td></tr>`).join('');
    root.innerHTML = `<section class="nhv-head"><div><div class="nhv-title">Vendedores</div><div class="nhv-sub">Gestão de representantes e vínculos com fábricas.</div></div><div class="nhv-tools"><input id="nhv-search" class="nhv-input" placeholder="Pesquisar vendedor" value="${state.search}"><select id="nhv-status" class="nhv-select"><option value="">Todos</option><option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>Ativos</option><option value="inativo" ${state.status === 'inativo' ? 'selected' : ''}>Inativos</option></select><button id="nhv-new" class="nhv-btn">Novo vendedor</button></div></section><section class="nhv-panel">${state.loading ? '<div class="nhv-state">Carregando...</div>' : state.error ? '<div class="nhv-state">Falha ao carregar vendedores.</div>' : `<table class="nhv-table"><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Status</th><th>Fábricas vinculadas</th><th>Ações</th></tr>${rows || '<tr><td colspan="6" class="nhv-state">Nenhum vendedor cadastrado.</td></tr>'}</table>`}</section>${state.modalOpen ? renderModal() : ''}`;
    root.querySelector('#nhv-search')?.addEventListener('input', (e) => { state.search = e.target.value || ''; load(); });
    root.querySelector('#nhv-status')?.addEventListener('change', (e) => { state.status = e.target.value || ''; load(); });
    root.querySelector('#nhv-new')?.addEventListener('click', async () => { await loadFabricantes(); openModal(null); });
    root.querySelectorAll('[data-edit-id]').forEach((btn) => btn.addEventListener('click', async () => {
      const item = state.items.find((row) => row.id === btn.getAttribute('data-edit-id'));
      if (!item) return;
      await loadFabricantes();
      openModal(item);
    }));
    root.querySelectorAll('[data-toggle-id]').forEach((btn) => btn.addEventListener('click', async () => {
      const item = state.items.find((row) => row.id === btn.getAttribute('data-toggle-id'));
      if (!item) return;
      state.saving = true; render();
      try {
        await saveVendedor(apiClient, { status: item.status === 'ativo' ? 'inativo' : 'ativo' }, item.id);
        await load();
      } finally {
        state.saving = false;
        render();
      }
    }));
    root.querySelector('#nhv-close')?.addEventListener('click', closeModal);
    root.querySelector('#nhv-modal-backdrop')?.addEventListener('click', (e) => { if (e.target.id === 'nhv-modal-backdrop') closeModal(); });
    root.querySelectorAll('[data-fab-id]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const id = checkbox.getAttribute('data-fab-id');
        const set = new Set(state.form.fabricante_ids || []);
        if (checkbox.checked) set.add(id); else set.delete(id);
        state.form.fabricante_ids = [...set];
      });
    });
    root.querySelector('#nhv-save')?.addEventListener('click', async () => {
      state.saving = true; render();
      try {
        const payload = {
          nome: state.form.nome,
          email: state.form.email || null,
          telefone: state.form.telefone || null,
          status: state.form.status || 'ativo',
          observacoes: state.form.observacoes || null
        };
        const saved = await saveVendedor(apiClient, payload, state.selected?.id || null);
        await saveVendedorFabricantes(apiClient, saved.id || state.selected?.id, state.form.fabricante_ids || []);
        closeModal();
        await load();
      } finally {
        state.saving = false;
        render();
      }
    });
  }

  async function loadFabricantes() {
    const response = await fetchFabricantesLookup(apiClient);
    state.fabricantes = response.items || [];
  }

  async function load() {
    state.loading = true; render();
    try {
      const [vendedores, fabricantes] = await Promise.all([
        fetchVendedoresData(apiClient, { search: state.search, status: state.status }),
        fetchFabricantesLookup(apiClient)
      ]);
      state.items = vendedores.items || [];
      state.fabricantes = fabricantes.items || [];
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  render(); load();
}
