import { createVendedoresState } from './vendedores.state.js';
import { fetchFabricantesLookup, fetchVendedorFabricantes, fetchVendedoresData, saveVendedor, saveVendedorFabricantes } from './vendedores.service.js';

function injectStyles() {
  if (document.getElementById('nh-vendedores-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-vendedores-style';
  style.textContent = `.nhv-panel{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22)}.nhv-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhv-title{font-size:30px;font-weight:700}.nhv-sub{color:#91a4c4}.nhv-tools{display:grid;grid-template-columns:minmax(280px,1fr) 160px 140px;gap:10px}.nhv-input,.nhv-btn,.nhv-select,.nhv-textarea,.nhv-chip-input{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nhv-btn{background:#4f8cff;border-color:#4f8cff;color:#fff;cursor:pointer;font-weight:600}.nhv-btn-secondary{background:#0b1628;color:#bcd0ff;border-color:rgba(148,163,184,.22)}.nhv-btn-danger{background:#0b1628;color:#fca5a5;border-color:rgba(248,113,113,.22)}.nhv-btn[disabled]{opacity:.55;cursor:not-allowed}.nhv-table{width:100%;border-collapse:collapse;font-size:13px}.nhv-table td,.nhv-table th{padding:10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;white-space:nowrap}.nhv-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:rgba(79,140,255,.16);color:#bcd0ff;font-size:12px;font-weight:600}.nhv-pill-inactive{background:rgba(251,191,36,.14);color:#fbbf24}.nhv-state{padding:24px;text-align:center;color:#91a4c4}.nhv-badges{display:flex;flex-wrap:wrap;gap:6px}.nhv-badge{padding:4px 8px;background:rgba(255,255,255,.04);border-radius:999px;color:#d7e4f8}.nhv-modal-backdrop{position:fixed;inset:0;background:rgba(8,15,30,.54);display:flex;align-items:center;justify-content:center;padding:16px;z-index:90}.nhv-modal{width:min(960px,100%);max-height:92vh;overflow:auto;background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.32)}.nhv-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px;border-bottom:1px solid rgba(148,163,184,.12);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0))}.nhv-modal-body{padding:18px}.nhv-modal-kicker{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border-radius:999px;background:rgba(79,140,255,.16);color:#bcd0ff;font-size:12px;font-weight:700;margin-bottom:8px}.nhv-modal-title{font-size:24px;font-weight:800;line-height:1.1}.nhv-modal-sub{color:#91a4c4;margin-top:6px;max-width:62ch}.nhv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nhv-section{grid-column:1/-1;padding:14px;border:1px solid rgba(148,163,184,.12);border-radius:14px;background:rgba(255,255,255,.03)}.nhv-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.nhv-section-title{font-size:14px;font-weight:700;color:#e7eefb}.nhv-section-help{color:#91a4c4;font-size:13px;margin-top:4px}.nhv-field{display:grid;gap:6px}.nhv-field input,.nhv-field textarea,.nhv-field select{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nhv-field textarea{height:92px;padding:10px;resize:vertical}.nhv-field-full{grid-column:1/-1}.nhv-fabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:240px;overflow:auto;padding:0}.nhv-fab{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid rgba(148,163,184,.12);border-radius:12px;background:#0b1628;transition:border-color .15s,box-shadow .15s,transform .15s}.nhv-fab:hover{border-color:rgba(79,140,255,.32);box-shadow:0 8px 20px rgba(79,140,255,.08);transform:translateY(-1px)}.nhv-fab input{margin-top:3px}.nhv-fab small{display:block;color:#91a4c4}.nhv-fab-selected{border-color:#4f8cff;background:rgba(79,140,255,.08)}.nhv-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.nhv-summary-card{padding:10px 12px;border:1px solid rgba(148,163,184,.12);border-radius:12px;background:rgba(255,255,255,.03)}.nhv-summary-card b{display:block;font-size:18px}.nhv-summary-card small{color:#91a4c4}.nhv-feedback{margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(79,140,255,.08);color:#bcd0ff;font-size:13px}.nhv-feedback.is-warning{background:rgba(251,191,36,.12);color:#fbbf24}.nhv-feedback.is-error{background:rgba(248,113,113,.12);color:#fca5a5}.nhv-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.nhv-muted{color:#91a4c4;font-size:13px}.nhv-empty-fab{padding:12px;border:1px dashed rgba(148,163,184,.24);border-radius:12px;color:#91a4c4;background:#0b1628}@media (max-width:1024px){.nhv-tools,.nhv-form,.nhv-fabs,.nhv-summary{grid-template-columns:1fr}.nhv-title{font-size:24px}}`;
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
    state.formError = '';
    render();
    if (item?.id) loadFabricantesFor(item.id);
  }

  function closeModal() {
    state.modalOpen = false;
    state.selected = null;
    state.form = normalizeVendedorForm();
    state.formError = '';
    render();
  }

  function validateVendedorForm() {
    const nome = String(state.form.nome || '').trim();
    if (!nome) return 'Informe o nome do vendedor.';
    if (nome.length < 2) return 'O nome do vendedor precisa ter pelo menos 2 caracteres.';
    return '';
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
    const selectedCount = (state.form.fabricante_ids || []).length;
    const availableCount = state.fabricantes.length;
    const fabList = state.fabricantes.map((fab) => `
      <label class="nhv-fab ${fabIds.has(String(fab.id)) ? 'nhv-fab-selected' : ''}">
        <input type="checkbox" data-fab-id="${fab.id}" ${fabIds.has(String(fab.id)) ? 'checked' : ''}>
        <span><strong>${fab.nome || fab.nomeExibicao || '-'}</strong><small>${fab.cnpj || ''}</small></span>
      </label>`).join('');
    const modeText = state.selected ? 'Edição de vendedor' : 'Novo cadastro';
    const statusText = state.form.status === 'ativo' ? 'Ativo' : 'Inativo';
    const feedbackClass = state.formError ? 'nhv-feedback is-error' : selectedCount === 0 ? 'nhv-feedback is-warning' : 'nhv-feedback';
    const feedbackText = state.formError || (selectedCount === 0
      ? 'Nenhuma fábrica vinculada ainda. Você pode salvar assim mesmo ou selecionar ao menos uma para refletir o escopo comercial.'
      : `${selectedCount} fábrica(s) vinculada(s) de ${availableCount} disponível(is).`);
    return `<div class="nhv-modal-backdrop" id="nhv-modal-backdrop" tabindex="0"><div class="nhv-modal"><div class="nhv-modal-head"><div><div class="nhv-modal-kicker">${modeText}</div><div class="nhv-modal-title">${state.selected ? 'Editar vendedor' : 'Cadastrar vendedor'}</div><div class="nhv-modal-sub">${state.selected ? 'Atualize o perfil, o status e os vínculos com fábricas.' : 'Preencha os dados básicos e selecione as fábricas que este vendedor poderá representar.'}</div></div><button id="nhv-close" class="nhv-btn nhv-btn-secondary" type="button">Fechar</button></div><div class="nhv-modal-body"><div class="nhv-form"><div class="nhv-section nhv-field-full"><div class="nhv-section-head"><div><div class="nhv-section-title">Dados do vendedor</div><div class="nhv-section-help">Esses dados identificam o responsável comercial e seu estado operacional.</div></div><span class="nhv-pill ${state.form.status === 'inativo' ? 'nhv-pill-inactive' : ''}">${statusText}</span></div><div class="nhv-form"><label class="nhv-field"><span>Nome completo *</span><input id="nhv-nome" value="${state.form.nome}" placeholder="Ex.: Ana Souza"></label><label class="nhv-field"><span>E-mail comercial</span><input id="nhv-email" value="${state.form.email}" placeholder="ana@empresa.com.br"></label><label class="nhv-field"><span>Telefone / WhatsApp</span><input id="nhv-telefone" value="${state.form.telefone}" placeholder="(11) 99999-9999"></label><label class="nhv-field"><span>Status operacional</span><select id="nhv-status-form"><option value="ativo" ${state.form.status === 'ativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${state.form.status === 'inativo' ? 'selected' : ''}>Inativo</option></select></label><label class="nhv-field nhv-field-full"><span>Observações internas</span><textarea id="nhv-observacoes" class="nhv-textarea" placeholder="Use para contexto de carteira, cobertura ou detalhes internos.">${state.form.observacoes}</textarea></label></div></div><div class="nhv-section nhv-field-full"><div class="nhv-section-head"><div><div class="nhv-section-title">Fábricas vinculadas</div><div class="nhv-section-help">Marque uma ou mais fábricas. Este vínculo define o escopo comercial do vendedor.</div></div><span class="nhv-pill">${selectedCount} selecionada(s)</span></div><div class="nhv-summary"><div class="nhv-summary-card"><b>${selectedCount}</b><small>Vínculos escolhidos</small></div><div class="nhv-summary-card"><b>${availableCount}</b><small>Fábricas disponíveis</small></div><div class="nhv-summary-card"><b>${state.selected ? 'Editar' : 'Criar'}</b><small>${state.selected ? 'Atualize o vínculo' : 'Salve e distribua a carteira'}</small></div></div><div class="${feedbackClass}">${feedbackText}</div><div class="nhv-fabs">${fabList || '<div class="nhv-empty-fab">Nenhuma fábrica disponível para seleção.</div>'}</div></div></div><div class="nhv-actions"><button id="nhv-save" class="nhv-btn" type="button">${state.saving ? 'Salvando...' : state.selected ? 'Salvar alterações' : 'Criar vendedor'}</button></div></div></div></div>`;
  }

  function render() {
    const rows = state.items.map((item) => `<tr><td>${item.nome || '-'}</td><td>${item.email || '-'}</td><td>${item.telefone || '-'}</td><td><span class="nhv-pill ${item.status === 'inativo' ? 'nhv-pill-inactive' : ''}">${item.status || 'ativo'}</span></td><td><div class="nhv-badges">${(item.fabricantesText || '').split(', ').filter(Boolean).map((f) => `<span class="nhv-badge">${f}</span>`).join('') || '<span class="nhv-badge">Sem fábricas</span>'}</div></td><td><button class="nhv-btn nhv-btn-secondary" data-edit-id="${item.id}">Editar</button> <button class="nhv-btn ${item.status === 'ativo' ? 'nhv-btn-danger' : 'nhv-btn'}" data-toggle-id="${item.id}">${item.status === 'ativo' ? 'Inativar' : 'Ativar'}</button></td></tr>`).join('');
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
    root.querySelector('#nhv-nome')?.addEventListener('input', (e) => {
      state.form.nome = e.target.value;
      if (state.formError) state.formError = '';
    });
    root.querySelector('#nhv-email')?.addEventListener('input', (e) => { state.form.email = e.target.value; });
    root.querySelector('#nhv-telefone')?.addEventListener('input', (e) => { state.form.telefone = e.target.value; });
    root.querySelector('#nhv-status-form')?.addEventListener('change', (e) => { state.form.status = e.target.value; });
    root.querySelector('#nhv-observacoes')?.addEventListener('input', (e) => { state.form.observacoes = e.target.value; });
    root.querySelectorAll('[data-fab-id]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const id = checkbox.getAttribute('data-fab-id');
        const set = new Set(state.form.fabricante_ids || []);
        if (checkbox.checked) set.add(id); else set.delete(id);
        state.form.fabricante_ids = [...set];
      });
    });
    root.querySelector('#nhv-save')?.addEventListener('click', async () => {
      const validationError = validateVendedorForm();
      if (validationError) {
        state.formError = validationError;
        render();
        return;
      }
      state.saving = true; render();
      try {
        const payload = {
          nome: String(state.form.nome || '').trim(),
          email: state.form.email || null,
          telefone: state.form.telefone || null,
          status: state.form.status || 'ativo',
          observacoes: state.form.observacoes || null
        };
        const saved = await saveVendedor(apiClient, payload, state.selected?.id || null);
        await saveVendedorFabricantes(apiClient, saved.id || state.selected?.id, state.form.fabricante_ids || []);
        closeModal();
        await load();
      } catch (error) {
        state.formError = 'Nao foi possivel salvar os vinculos com as fabricas. Tente novamente.';
        render();
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
