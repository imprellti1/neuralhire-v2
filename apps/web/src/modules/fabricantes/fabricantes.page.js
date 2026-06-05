import { createFabricantesState } from './fabricantes.state.js';
import { deleteCondicaoPagamento, fetchCondicoesPagamento, fetchFabricanteData, fetchFabricantesData, lookupCnpj, saveCondicaoPagamento, saveFabricante } from './fabricantes.service.js';
import { mapFabricantesData } from './fabricantes.mapper.js';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCurrencyInput(value) {
  const raw = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(raw);
  if (!Number.isFinite(num)) return '';
  return brl(num);
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8), digits.slice(8, 12), digits.slice(12, 14)];
  return [parts[0], parts[1], parts[2], parts[3], parts[4]].filter(Boolean).reduce((acc, part, index) => {
    if (index === 0) return part;
    if (index === 1 || index === 2) return `${acc}.${part}`;
    if (index === 3) return `${acc}/${part}`;
    return `${acc}-${part}`;
  }, '');
}

function parsePaymentCondition(value) {
  const raw = String(value || '').trim();
  if (!raw) return { valid: false, parcelas: '', prazoMedio: '', normalized: '' };
  const parts = raw.split('/').map((part) => Number(String(part).trim())).filter((part) => Number.isFinite(part) && part > 0);
  if (!parts.length) return { valid: false, parcelas: '', prazoMedio: '', normalized: '' };
  const parcelas = parts.length;
  const prazoMedio = parts.reduce((sum, part) => sum + part, 0) / parcelas;
  return { valid: true, parcelas, prazoMedio, normalized: parts.join('/') };
}

function formatPercentInput(value) {
  const raw = String(value || '').replace(/[^\d,.-]/g, '').replace(',', '.');
  if (raw === '') return '';
  return raw;
}

function formatPercentDisplay(value) {
  return value ? `${value}%` : '';
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hasMeaningfulValue(value) {
  return String(value || '').trim().length > 0;
}

function generateRowId() {
  return `row-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function isCnpjLookupComplete(data) {
  const primaryFields = [data?.razao_social, data?.nome_fantasia || data?.nome, data?.email, data?.telefone, data?.site];
  return primaryFields.filter(hasMeaningfulValue).length >= 3 && hasMeaningfulValue(data?.razao_social);
}

function parseCondicoes(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeCondicaoRow(row = {}) {
  const parsed = parsePaymentCondition(row.condicao_pagamento || row.nome || '');
  return {
    id: row.id || row.localId || generateRowId(),
    condicao_pagamento: parsed.valid ? parsed.normalized : String(row.condicao_pagamento || row.nome || ''),
    juros: String(row.juros ?? row.percentual_acrescimo ?? ''),
    parcelas: parsed.valid ? parsed.parcelas : Number(row.parcelas ?? 0) || 0,
    prazo_medio: parsed.valid ? Math.round(parsed.prazoMedio) : Number(row.prazo_medio ?? row.prazo_medio_dias ?? 0) || 0,
    savedId: row.savedId || row.id || null,
    fileName: row.fileName || '',
    preview: row.preview || ''
  };
}

function buildCondicaoPayload(row) {
  const parsed = parsePaymentCondition(row.condicao_pagamento);
  return {
    nome: parsed.valid ? parsed.normalized : String(row.condicao_pagamento || '').trim(),
    parcelas: parsed.valid ? parsed.parcelas : Number(row.parcelas || 0) || 0,
    prazo_medio_dias: parsed.valid ? parsed.prazoMedio : Number(row.prazo_medio || 0) || 0,
    valor_minimo: 0,
    percentual_acrescimo: Number(formatPercentInput(row.juros || 0)) || 0,
    observacoes: null
  };
}

function injectStyles() {
  if (document.getElementById('nh-fab-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-fab-style';
  style.textContent = `.nhf-wrap{max-width:1400px;margin:0 auto}.nhf-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhf-title{font-size:30px;font-weight:700}.nhf-sub{color:#61708f}.nhf-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06);margin-bottom:14px}.nhf-tools{display:grid;grid-template-columns:minmax(280px,1fr) 150px 120px;gap:10px}.nhf-input,.nhf-btn,.nhf-tab{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nhf-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;cursor:pointer}.nhf-btn[disabled]{opacity:.55;cursor:not-allowed}.nhf-grid{display:grid;grid-template-columns:1fr;gap:14px}.nhf-table{width:100%;border-collapse:collapse;font-size:13px}.nhf-table td,.nhf-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nhf-row{cursor:pointer}.nhf-row:hover td{background:#f7faff}.nhf-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.nhf-kpis div{padding:10px;border:1px solid #e5ecf8;border-radius:12px}.nhf-kpis strong{display:block;font-size:18px}.nhf-modal-backdrop{position:fixed;inset:0;background:rgba(9,16,32,.46);display:flex;align-items:center;justify-content:center;padding:20px;z-index:90}.nhf-modal{width:min(1040px,100%);max-height:92vh;overflow:auto;background:#f7f9fe;border:1px solid #dce6f5;border-radius:20px;box-shadow:0 30px 80px rgba(5,15,30,.32)}.nhf-modal-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 22px;border-bottom:1px solid #e6edf8;background:linear-gradient(180deg,#fff,#f8fbff)}.nhf-modal-tabs{display:flex;gap:8px;padding:14px 22px 0}.nhf-tab{background:#eef4ff;color:#1f56dc;cursor:pointer}.nhf-tab[aria-selected="true"]{background:#1f56dc;color:#fff}.nhf-tab[aria-selected="false"]{opacity:.88}.nhf-modal-body{padding:18px 22px 22px}.nhf-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nhf-field{display:grid;gap:6px}.nhf-field input,.nhf-field textarea,.nhf-field select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#fff}.nhf-field textarea{height:80px;padding:10px;resize:vertical}.nhf-field input:disabled,.nhf-field textarea:disabled,.nhf-field select:disabled{background:#edf2f7;color:#6c7a92}.nhf-field-full{grid-column:1/-1}.nhf-muted{color:#61708f;font-size:13px}.nhf-state{padding:24px;text-align:center;color:#61708f}.nhf-inline{display:flex;gap:10px;align-items:end}.nhf-inline > .nhf-field{flex:1}.nhf-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#eef4ff;color:#1f56dc;font-size:12px;font-weight:600}.nhf-error{color:#9f1239}.nhf-success{color:#166534}.nhf-info{color:#1d4ed8}.nhf-warn{color:#b45309}.nhf-inline-error{font-size:12px;color:#9f1239;margin-top:2px}.nhf-logo-preview{max-width:96px;max-height:64px;border-radius:10px;border:1px solid #d4deee;object-fit:cover;background:#fff}.nhf-logo-box{display:flex;gap:12px;align-items:center}.nhf-logo-meta{display:grid;gap:4px}.nhf-lookup-success{color:#166534}.nhf-lookup-partial{color:#1d4ed8}.nhf-lookup-error{color:#9f1239}@media (max-width:1024px){.nhf-grid,.nhf-tools,.nhf-kpis,.nhf-form-grid{grid-template-columns:1fr}.nhf-title{font-size:24px}.nhf-modal{width:100%}.nhf-inline{flex-direction:column;align-items:stretch}}`;
  document.head.appendChild(style);
}

function emptyForm() {
  return {
    cnpj: '',
    nome: '',
    razao_social: '',
    nome_fantasia: '',
    email_comercial: '',
    telefone: '',
    site: '',
    logo_url: '',
    responsavel_comercial: '',
    regiao_atendida: '',
    observacoes: '',
    pedido_minimo: 0,
    boleto_minimo: 0,
    comissao_padrao_percentual: 0,
    condicao_pagamento: '',
    parcelas_pagamento: '',
    prazo_medio_pagamento: '',
    juros_pagamento: '',
    condicoes_pagamento: []
  };
}

export function renderFabricantesPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createFabricantesState();
  state.form = emptyForm();

  function isCnpjValid() {
    return onlyDigits(state.form.cnpj).length === 14;
  }

  function isLocked() {
    return !state.cnpjValidated && !state.cnpjManualUnlock;
  }

  function openModal(selected = null) {
    state.modalOpen = true;
    state.modalTab = 'gerais';
    state.error = false;
    state.selected = selected;
    state.condicoes = [];
    state.condicaoId = null;
    state.form = selected ? { ...emptyForm(), ...selected, cnpj: selected.cnpj || '' } : emptyForm();
    state.form.pedido_minimo = selected?.pedido_minimo ?? 0;
    state.form.comissao_padrao_percentual = selected?.comissao_padrao_percentual ?? 0;
    state.form.condicoes_pagamento = [];
    state.form.logo_file_name = '';
    state.form.logo_preview = selected?.logo_url || '';
    state.cnpjValidated = Boolean(selected?.cnpj);
    state.cnpjManualUnlock = false;
    state.cnpjMessage = '';
    state.cnpjMessageTone = '';
    state.cnpjLookupStatus = 'idle';
    render();
  }

  async function openEdit(selected) {
    if (!selected) return;
    openModal(selected);
    try {
      const detail = await fetchFabricanteData(apiClient, selected.id);
      state.selected = detail;
      state.form = { ...state.form, ...detail, cnpj: detail.cnpj || '' };
      state.form.logo_preview = detail.logo_url || state.form.logo_preview || '';
      const condicoes = await fetchCondicoesPagamento(apiClient, selected.id);
      state.condicoes = (condicoes.items || []).map((row) => normalizeCondicaoRow({ ...row, juros: row.percentual_acrescimo, savedId: row.id }));
      state.form.condicoes_pagamento = state.condicoes.map((row) => ({ ...row }));
      render();
    } catch {
      state.error = true;
      render();
    }
  }

  function closeModal() {
    state.modalOpen = false;
    state.selected = null;
    state.condicoes = [];
    state.condicaoId = null;
    state.form = emptyForm();
    render();
  }

  function applyLookup(data) {
    const razaoSocial = data.razao_social || state.form.razao_social || '';
    const nomeFantasia = data.nome_fantasia || data.nome || razaoSocial || '';
    const email = data.email || state.form.email_comercial || '';
    const telefone = data.telefone || state.form.telefone || '';
    const site = data.site || state.form.site || '';
    const partial = !isCnpjLookupComplete({ ...data, nome_fantasia: nomeFantasia, nome: nomeFantasia, email, telefone, site, razao_social: razaoSocial });
    state.form = {
      ...state.form,
      cnpj: data.cnpj || state.form.cnpj,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      nome: data.nome || state.form.nome || nomeFantasia || '',
      email_comercial: email,
      telefone,
      site,
      observacoes: state.form.observacoes || '',
      endereco_logradouro: data.endereco?.logradouro || '',
      endereco_numero: data.endereco?.numero || '',
      endereco_complemento: data.endereco?.complemento || '',
      endereco_bairro: data.endereco?.bairro || '',
      endereco_cidade: data.endereco?.cidade || '',
      endereco_uf: data.endereco?.uf || '',
      endereco_cep: data.endereco?.cep || '',
      atividade_principal: data.atividade_principal || ''
    };
    state.cnpjValidated = true;
    state.cnpjManualUnlock = false;
    state.cnpjMessage = partial
      ? 'CNPJ localizado. Alguns campos foram preenchidos automaticamente. Complete os dados restantes manualmente.'
      : 'CNPJ localizado e campos preenchidos automaticamente.';
    state.cnpjMessageTone = partial ? 'partial' : 'success';
  }

  function bindEvents() {
    root.querySelector('#nhf-new')?.addEventListener('click', () => openModal(null));
    root.querySelectorAll('.nhf-row').forEach((row) => {
      row.addEventListener('click', () => openEdit(state.items.find((item) => item.id === row.getAttribute('data-id'))));
    });
    root.querySelectorAll('[data-edit-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEdit(state.items.find((item) => item.id === btn.getAttribute('data-edit-id')));
      });
    });
    root.querySelectorAll('[data-toggle-id]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const selected = state.items.find((item) => item.id === btn.getAttribute('data-toggle-id'));
        if (!selected) return;
        state.saving = true;
        render();
        try {
          await saveFabricante(apiClient, { status: selected.status === 'ativo' ? 'inativo' : 'ativo' }, selected.id);
          await load();
        } catch {
          state.error = true;
        } finally {
          state.saving = false;
          render();
        }
      });
    });
    root.querySelector('#nhf-modal-close')?.addEventListener('click', closeModal);
    root.querySelector('#nhf-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'nhf-modal-backdrop') closeModal();
    });
    root.querySelector('#nhf-modal-backdrop')?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
    root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => { state.modalTab = btn.getAttribute('data-tab'); render(); });
    });
    root.querySelector('#nhf-cnpj')?.addEventListener('input', (e) => {
      const raw = onlyDigits(e.target.value).slice(0, 14);
      state.form.cnpj = raw;
      state.cnpjValidated = false;
      state.cnpjMessage = '';
      state.cnpjMessageTone = '';
      e.target.value = formatCnpj(raw);
      const buscarBtn = root.querySelector('#nhf-buscar-cnpj');
      if (buscarBtn) buscarBtn.disabled = raw.length !== 14;
    });
    root.querySelector('#nhf-buscar-cnpj')?.addEventListener('click', async () => {
      if (!isCnpjValid()) return;
      state.cnpjLookupStatus = 'loading';
      state.cnpjMessage = '';
      render();
      try {
        const result = await lookupCnpj(apiClient, onlyDigits(state.form.cnpj));
      if (result?.found === false || result?.data === null) {
        state.cnpjMessage = result?.message || 'Nao foi possivel consultar o CNPJ agora. Voce pode continuar com preenchimento manual.';
        state.cnpjManualUnlock = true;
        state.cnpjMessageTone = 'error';
        } else {
          applyLookup(result?.data || result);
        }
      } catch {
        state.cnpjMessage = 'Nao foi possivel consultar o CNPJ agora. Voce pode continuar com preenchimento manual.';
        state.cnpjManualUnlock = true;
        state.cnpjMessageTone = 'error';
      } finally {
        state.cnpjLookupStatus = 'idle';
        render();
      }
    });
    root.querySelector('#nhf-unlock-manual')?.addEventListener('click', () => {
      state.cnpjManualUnlock = true;
      state.cnpjMessage = 'Preenchimento manual liberado.';
      state.cnpjMessageTone = 'partial';
      render();
    });
    root.querySelector('[data-form-field="pedido_minimo"]')?.addEventListener('input', (e) => {
      const raw = String(e.target.value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
      const num = Number(raw);
      state.form.pedido_minimo = Number.isFinite(num) ? String(num) : '';
      e.target.value = Number.isFinite(num) ? formatCurrencyInput(num) : '';
    });
    root.querySelector('[data-form-field="logo_upload"]')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0] || null;
      if (!file) return;
      if (!/image\/(png|jpeg|jpg|webp)/i.test(file.type)) {
        state.error = true;
        render();
        return;
      }
      state.form.logo_file_name = file.name;
      const preview = window.URL && typeof window.URL.createObjectURL === 'function' ? window.URL.createObjectURL(file) : '';
      state.form.logo_preview = preview;
      state.form.logo_url = preview || `local://${encodeURIComponent(file.name)}`;
      render();
    });
    root.querySelector('#nhf-save')?.addEventListener('click', async () => {
      if (!isCnpjValid()) return;
      state.saving = true;
      render();
      try {
        const condicoes = (state.form.condicoes_pagamento || []).map((row) => normalizeCondicaoRow(row)).filter((row) => row.condicao_pagamento);
        if (condicoes.some((row) => !parsePaymentCondition(row.condicao_pagamento).valid)) {
          state.error = true;
          state.saving = false;
          render();
          return;
        }
        const fabricantePayload = {
          nome: state.form.nome || state.form.nome_fantasia || state.form.razao_social || '',
          cnpj: onlyDigits(state.form.cnpj),
          razao_social: state.form.razao_social || null,
          logo_url: state.form.logo_url || null,
          pedido_minimo: Number(String(state.form.pedido_minimo || 0).replace(/[^\d.-]/g, '')) || 0,
          boleto_minimo: Number(state.form.boleto_minimo || 0),
          comissao_padrao_percentual: Number(state.form.comissao_padrao_percentual || 0),
          observacoes: state.form.observacoes || null,
          status: state.selected?.status === 'inativo' ? 'inativo' : 'ativo'
        };
        const saved = await saveFabricante(apiClient, fabricantePayload, state.selected?.id || null);
        const fabricanteId = saved.id || state.selected?.id || null;
        const existing = new Map((state.condicoes || []).map((row) => [String(row.id), row]));
        const desired = condicoes.map((row) => ({ ...row, savedId: row.savedId || null }));
        for (const row of desired) {
          const payload = buildCondicaoPayload(row);
          if (row.savedId && existing.has(String(row.savedId))) {
            await saveCondicaoPagamento(apiClient, fabricanteId, payload, row.savedId);
            existing.delete(String(row.savedId));
          } else {
            const created = await saveCondicaoPagamento(apiClient, fabricanteId, payload, null);
            row.savedId = created?.id || null;
          }
        }
        for (const row of existing.values()) {
          await deleteCondicaoPagamento(apiClient, fabricanteId, row.id);
        }
        closeModal();
        await load();
      } catch {
        state.error = true;
      } finally {
        state.saving = false;
        render();
      }
    });
    root.querySelectorAll('[data-form-field]').forEach((el) => {
      const key = el.getAttribute('data-form-field');
      el.addEventListener('input', (e) => { state.form[key] = e.target.value; });
      el.addEventListener('change', (e) => { state.form[key] = e.target.value; });
    });
    root.querySelector('[data-condicao-add]')?.addEventListener('click', () => {
      const rows = [...(state.form.condicoes_pagamento || [])];
      rows.push(normalizeCondicaoRow({ localId: generateRowId(), condicao_pagamento: '', juros: '' }));
      state.form.condicoes_pagamento = rows;
      render();
    });
    root.querySelectorAll('[data-condicao-field]').forEach((el) => {
      el.addEventListener('input', (e) => {
        const rowId = el.getAttribute('data-row-id');
        const field = el.getAttribute('data-condicao-field');
        const raw = String(e.target.value || '');
        updateCondicaoRow(rowId, field, field === 'juros' ? formatPercentInput(raw) : raw.replace(/\s+/g, '').replace(/[^0-9/]/g, '').replace(/\/+/g, '/').replace(/^\/|\/$/g, ''));
      });
    });
    root.querySelectorAll('[data-condicao-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-condicao-remove');
        const rows = [...(state.form.condicoes_pagamento || [])];
        state.form.condicoes_pagamento = rows.filter((row) => String(row.id) !== String(rowId));
        render();
      });
    });
  }

  function renderFormTab() {
    const locked = isLocked();
    const lookupReady = isCnpjValid();
    const toneClass = state.cnpjMessageTone === 'success' ? 'nhf-lookup-success' : state.cnpjMessageTone === 'partial' ? 'nhf-lookup-partial' : state.cnpjMessageTone === 'error' ? 'nhf-lookup-error' : 'nhf-muted';
    return `<div class="nhf-form-grid"><div class="nhf-field nhf-field-full"><div class="nhf-inline"><label class="nhf-field">CNPJ<input id="nhf-cnpj" value="${formatCnpj(state.form.cnpj || '')}" placeholder="00.000.000/0000-00" maxlength="18" inputmode="numeric"></label><button id="nhf-buscar-cnpj" class="nhf-btn" ${lookupReady ? '' : 'disabled'}>${state.cnpjLookupStatus === 'loading' ? 'Buscando...' : 'Buscar CNPJ'}</button></div><div class="nhf-muted">O campo CNPJ precisa ter 14 digitos para habilitar a consulta.</div>${state.cnpjMessage ? `<div class="${toneClass} nhf-muted">${state.cnpjMessage}</div>` : ''}</div><label class="nhf-field"><span>Nome fantasia</span><input data-form-field="nome_fantasia" value="${state.form.nome_fantasia || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Razão social</span><input data-form-field="razao_social" value="${state.form.razao_social || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>E-mail comercial</span><input data-form-field="email_comercial" value="${state.form.email_comercial || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Telefone</span><input data-form-field="telefone" value="${state.form.telefone || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Site</span><input data-form-field="site" value="${state.form.site || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Logo</span><input data-form-field="logo_upload" type="file" accept="image/png,image/jpeg,image/webp" ${locked ? 'disabled' : ''}></label><div class="nhf-field"><span>Preview</span><div class="nhf-logo-box">${state.form.logo_preview ? `<img class="nhf-logo-preview" src="${state.form.logo_preview}" alt="Preview do logo">` : '<div class="nhf-muted">Nenhum logo selecionado</div>'}<div class="nhf-logo-meta"><strong>${state.form.logo_file_name || 'Arquivo local'}</strong><span class="nhf-muted">PNG, JPG ou WebP</span></div></div></div><label class="nhf-field"><span>Responsável comercial</span><input data-form-field="responsavel_comercial" value="${state.form.responsavel_comercial || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Região atendida</span><input data-form-field="regiao_atendida" value="${state.form.regiao_atendida || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field nhf-field-full"><span>Observações</span><textarea data-form-field="observacoes" ${locked ? 'disabled' : ''}>${state.form.observacoes || ''}</textarea></label><div class="nhf-field nhf-field-full"><button id="nhf-unlock-manual" class="nhf-btn" type="button" ${state.cnpjValidated ? 'disabled' : ''}>Liberar preenchimento manual</button></div></div>`;
  }

  function updateCondicaoRow(rowId, field, value) {
    const rows = [...(state.form.condicoes_pagamento || [])];
    const index = rows.findIndex((row) => String(row.id) === String(rowId));
    if (index < 0) return;
    const current = rows[index];
    const next = normalizeCondicaoRow({ ...current, [field]: value, id: current.id, savedId: current.savedId });
    rows[index] = next;
    state.form.condicoes_pagamento = rows;
    const rowEl = root.querySelector(`tr[data-condicao-id="${String(rowId).replace(/"/g, '&quot;')}"]`);
    if (!rowEl) return;
    const parsed = parsePaymentCondition(next.condicao_pagamento);
    const parcelasInput = rowEl.querySelector('[data-condicao-output="parcelas"]');
    const prazoInput = rowEl.querySelector('[data-condicao-output="prazo"]');
    if (parcelasInput) parcelasInput.value = parsed.valid ? String(parsed.parcelas) : String(next.parcelas || '');
    if (prazoInput) prazoInput.value = parsed.valid ? String(Math.round(parsed.prazoMedio)) : String(next.prazo_medio || '');
  }

  function renderCondicaoRow(row, locked = false) {
    const parsed = parsePaymentCondition(row.condicao_pagamento);
    const parcelas = parsed.valid ? parsed.parcelas : row.parcelas;
    const prazo = parsed.valid ? Math.round(parsed.prazoMedio) : row.prazo_medio;
    return `<tr data-condicao-id="${row.id}"><td><input class="nhf-input" data-condicao-field="condicao_pagamento" data-row-id="${row.id}" value="${row.condicao_pagamento || ''}" placeholder="30/60/90" ${locked ? 'disabled' : ''}></td><td><input class="nhf-input" data-condicao-output="parcelas" value="${parcelas || ''}" readonly></td><td><input class="nhf-input" data-condicao-output="prazo" value="${prazo || ''}" readonly></td><td><input class="nhf-input" data-condicao-field="juros" data-row-id="${row.id}" value="${row.juros || ''}" placeholder="1%" ${locked ? 'disabled' : ''}></td><td><button class="nhf-btn" type="button" data-condicao-remove="${row.id}" ${locked ? 'disabled' : ''}>Remover</button></td></tr>`;
  }

  function renderRulesTab() {
    const locked = isLocked();
    const total = state.form.condicoes_pagamento?.length || 0;
    const pedido = `<label class="nhf-field"><span>Pedido mínimo</span><input data-form-field="pedido_minimo" value="${formatCurrencyInput(state.form.pedido_minimo ?? 0)}" ${locked ? 'disabled' : ''} inputmode="decimal"></label>`;
    const rows = (state.form.condicoes_pagamento || []).map((row) => renderCondicaoRow(row, locked)).join('');
    return `<div class="nhf-form-grid">${pedido}<div class="nhf-field nhf-field-full"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px"><div><strong>Condições de pagamento</strong><div class="nhf-muted">Adicione quantas linhas precisar. O sistema calcula parcelas e prazo médio automaticamente.</div></div><button class="nhf-btn" type="button" data-condicao-add ${locked ? 'disabled' : ''}>Adicionar linha</button></div><div class="nhf-table-wrap"><table class="nhf-table"><tr><th>Condição de pagamento</th><th>Quantidade de parcelas</th><th>Prazo médio</th><th>Juros</th><th>Ações</th></tr>${rows || '<tr><td colspan="5" class="nhf-state">Nenhuma condição cadastrada.</td></tr>'}</table></div><div class="nhf-muted" style="margin-top:8px">Total de linhas: ${total}</div></div></div>`;
  }

  function renderModal() {
    const actionLabel = state.selected ? 'Salvar alterações' : 'Salvar fábrica';
    return `<div id="nhf-modal-backdrop" class="nhf-modal-backdrop" tabindex="0"><div class="nhf-modal"><div class="nhf-modal-head"><div><div class="nhf-title">${state.selected ? 'Editar fábrica' : 'Nova fábrica'}</div><div class="nhf-sub">Cadastre a fábrica começando pelo CNPJ e siga com os dados comerciais.</div></div><button id="nhf-modal-close" class="nhf-btn" type="button">Fechar</button></div><div class="nhf-modal-tabs"><button class="nhf-tab" data-tab="gerais" aria-selected="${state.modalTab === 'gerais'}">Informações gerais</button><button class="nhf-tab" data-tab="regras" aria-selected="${state.modalTab === 'regras'}">Regras comerciais</button></div><div class="nhf-modal-body">${state.modalTab === 'gerais' ? renderFormTab() : renderRulesTab()}<div style="margin-top:18px;display:flex;justify-content:flex-end;gap:10px"><button id="nhf-save" class="nhf-btn" type="button" ${!isCnpjValid() ? 'disabled' : ''}>${state.saving ? 'Salvando...' : actionLabel}</button></div></div></div></div>`;
  }

  function render() {
    const k = {
      total: state.items.length,
      ativos: state.items.filter((i) => i.status === 'ativo').length,
      inativos: state.items.filter((i) => i.status === 'inativo').length,
      semLogo: state.items.filter((i) => !i.logo_url).length,
      semPedido: state.items.filter((i) => Number(i.pedido_minimo || 0) <= 0).length
    };
    const rows = state.items.map((item) => `<tr class="nhf-row" data-id="${item.id}"><td>${item.logo_url ? 'Logo' : '-'}</td><td>${item.nomeExibicao}</td><td>${item.cnpjExibicao}</td><td><span class="nhf-pill">${item.statusExibicao === 'inativo' ? 'Inativa' : 'Ativa'}</span></td><td>${brl(item.pedidoMinimoExibicao)}</td><td>${brl(item.boletoMinimoExibicao)}</td><td>${item.comissaoExibicao}%</td><td><button class="nhf-btn" type="button" data-edit-id="${item.id}">Editar</button> <button class="nhf-btn" type="button" data-toggle-id="${item.id}">${item.statusExibicao === 'ativo' ? 'Inativar' : 'Ativar'}</button></td></tr>`).join('');
    root.innerHTML = `<div class="nhf-wrap"><div class="nhf-head"><div><div class="nhf-title">Fábricas</div><div class="nhf-sub">Cadastro de fabricantes e regras comerciais</div></div><div class="nhf-tools"><input id="nhf-search" class="nhf-input" placeholder="Pesquisar" value="${state.search}"/><select id="nhf-status" class="nhf-input"><option value="">Todos</option><option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>Ativos</option><option value="inativo" ${state.status === 'inativo' ? 'selected' : ''}>Inativos</option></select><button id="nhf-new" class="nhf-btn">Nova fábrica</button></div></div><div class="nhf-panel nhf-kpis"><div><strong>${k.total}</strong>Total fábricas</div><div><strong>${k.ativos}</strong>Ativas</div><div><strong>${k.inativos}</strong>Inativas</div><div><strong>${k.semLogo}</strong>Sem logo</div><div><strong>${k.semPedido}</strong>Sem pedido mínimo</div></div><div class="nhf-grid"><section class="nhf-panel"><table class="nhf-table"><tr><th>Logo</th><th>Nome</th><th>CNPJ</th><th>Status</th><th>Pedido mínimo</th><th>Boleto mínimo</th><th>Comissão</th><th>Ações</th></tr>${rows || '<tr><td colspan="8" class="nhf-state">Nenhuma fábrica cadastrada.</td></tr>'}</table></section></div></div>${state.modalOpen ? renderModal() : ''}`;
    bindEvents();
  }

  async function load() {
    try {
      const response = await fetchFabricantesData(apiClient, { search: state.search, status: state.status });
      state.items = mapFabricantesData(response).items;
      if (state.selected?.id) {
        state.selected = await fetchFabricanteData(apiClient, state.selected.id);
        state.condicoes = ((await fetchCondicoesPagamento(apiClient, state.selected.id)).items || []).map((row) => normalizeCondicaoRow({ ...row, juros: row.percentual_acrescimo, savedId: row.id }));
      }
    } catch {
      state.error = true;
    } finally {
      render();
    }
  }

  root.addEventListener('input', (e) => {
    if (e.target?.id === 'nhf-search') {
      state.search = e.target.value || '';
      load();
    }
  });
  root.addEventListener('change', (e) => {
    if (e.target?.id === 'nhf-status') {
      state.status = e.target.value || '';
      load();
    }
  });

  render();
  load();
}
