import { createVendedoresState } from './vendedores.state.js';
import { fetchFabricantesLookup, fetchVendedorFabricantes, fetchVendedoresData, saveVendedor, saveVendedorFabricantes } from './vendedores.service.js';

function injectStyles() {
  if (document.getElementById('nh-vendedores-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-vendedores-style';
  style.textContent = `.nhv-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06)}.nhv-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhv-title{font-size:30px;font-weight:700}.nhv-sub{color:#61708f}.nhv-tools{display:grid;grid-template-columns:minmax(280px,1fr) 160px 140px;gap:10px}.nhv-input,.nhv-btn,.nhv-select,.nhv-textarea,.nhv-chip-input{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff}.nhv-btn{background:#1f56dc;border-color:#1f56dc;color:#fff;cursor:pointer;font-weight:600}.nhv-btn-secondary{background:#fff;color:#1f56dc;border-color:#cdd9ee}.nhv-btn-danger{background:#fff;color:#b42318;border-color:#efc5c0}.nhv-btn[disabled]{opacity:.55;cursor:not-allowed}.nhv-table{width:100%;border-collapse:collapse;font-size:13px}.nhv-table td,.nhv-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nhv-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#eef4ff;color:#1f56dc;font-size:12px;font-weight:600}.nhv-pill-inactive{background:#fff4e5;color:#b45309}.nhv-state{padding:24px;text-align:center;color:#61708f}.nhv-badges{display:flex;flex-wrap:wrap;gap:6px}.nhv-badge{padding:4px 8px;background:#f1f5ff;border-radius:999px;color:#234}.nhv-modal-backdrop{position:fixed;inset:0;background:rgba(8,15,30,.44);display:flex;align-items:center;justify-content:center;padding:16px;z-index:90}.nhv-modal{width:min(960px,100%);max-height:92vh;overflow:auto;background:#fff;border:1px solid #dbe4f2;border-radius:18px;box-shadow:0 24px 64px rgba(16,34,68,.22)}.nhv-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:18px;border-bottom:1px solid #edf2f7;background:linear-gradient(180deg,#fff,#f8fbff)}.nhv-modal-body{padding:18px}.nhv-modal-kicker{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border-radius:999px;background:#eef4ff;color:#1f56dc;font-size:12px;font-weight:700;margin-bottom:8px}.nhv-modal-title{font-size:24px;font-weight:800;line-height:1.1}.nhv-modal-sub{color:#61708f;margin-top:6px;max-width:62ch}.nhv-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nhv-section{grid-column:1/-1;padding:14px;border:1px solid #e4ebf5;border-radius:14px;background:#fbfcff}.nhv-section-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}.nhv-section-title{font-size:14px;font-weight:700;color:#20304f}.nhv-section-help{color:#61708f;font-size:13px;margin-top:4px}.nhv-field{display:grid;gap:6px}.nhv-field input,.nhv-field textarea,.nhv-field select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nhv-field textarea{height:92px;padding:10px;resize:vertical}.nhv-field-full{grid-column:1/-1}.nhv-fabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:240px;overflow:auto;padding:0}.nhv-fab{display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid #e6edf9;border-radius:12px;background:#fff;transition:border-color .15s,box-shadow .15s,transform .15s}.nhv-fab:hover{border-color:#b9cdf2;box-shadow:0 8px 20px rgba(31,86,220,.08);transform:translateY(-1px)}.nhv-fab input{margin-top:3px}.nhv-fab small{display:block;color:#6b7b95}.nhv-fab-selected{border-color:#1f56dc;background:#eef4ff}.nhv-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.nhv-summary-card{padding:10px 12px;border:1px solid #e4ebf5;border-radius:12px;background:#fff}.nhv-summary-card b{display:block;font-size:18px}.nhv-summary-card small{color:#61708f}.nhv-feedback{margin-top:12px;padding:10px 12px;border-radius:12px;background:#eef4ff;color:#1f56dc;font-size:13px}.nhv-feedback.is-warning{background:#fff7ed;color:#b45309}.nhv-feedback.is-error{background:#fef2f2;color:#b42318}.nhv-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.nhv-muted{color:#61708f;font-size:13px}.nhv-empty-fab{padding:12px;border:1px dashed #cdd9ee;border-radius:12px;color:#61708f;background:#fff}@media (max-width:1024px){.nhv-tools,.nhv-form,.nhv-fabs,.nhv-summary{grid-template-columns:1fr}.nhv-title{font-size:24px}}`;
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
    const selectedCount = (state.form.fabricante_ids || []).length;
    const availableCount = state.fabricantes.length;
    const fabList = state.fabricantes.map((fab) => `
      <label class="nhv-fab ${fabIds.has(String(fab.id)) ? 'nhv-fab-selected' : ''}">
        <input type="checkbox" data-fab-id="${fab.id}" ${fabIds.has(String(fab.id)) ? 'checked' : ''}>
        <span><strong>${fab.nome || fab.nomeExibicao || '-'}</strong><small>${fab.cnpj || ''}</small></span>
      </label>`).join('');
    const modeText = state.selected ? 'Edição de vendedor' : 'Novo cadastro';
    const statusText = state.form.status === 'ativo' ? 'Ativo' : 'Inativo';
    const feedbackClass = selectedCount === 0 ? 'nhv-feedback is-warning' : 'nhv-feedback';
    const feedbackText = selectedCount === 0
      ? 'Nenhuma fábrica vinculada ainda. Você pode salvar assim mesmo ou selecionar ao menos uma para refletir o escopo comercial.'
      : `${selectedCount} fábrica(s) vinculada(s) de ${availableCount} disponível(is).`;
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
