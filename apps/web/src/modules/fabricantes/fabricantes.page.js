import { createFabricantesState } from './fabricantes.state.js';
import { deleteCondicaoPagamento, deleteFabricanteVendedor, fetchCondicoesPagamento, fetchFabricanteData, fetchFabricanteVendedores, fetchFabricantesData, lookupCnpj, saveCondicaoPagamento, saveFabricante, saveFabricanteVendedor, saveFabricanteVendedores, uploadFabricanteLogo } from './fabricantes.service.js';
import { mapFabricantesData } from './fabricantes.mapper.js';
import { fetchVendedoresData } from '../vendedores/vendedores.service.js';

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function brl(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? currencyFormatter.format(num) : currencyFormatter.format(0);
}

function parseBrlInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function formatCurrencyFromNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? brl(num) : '';
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

function composeEnderecoCompleto(form = {}) {
  const parts = [
    [form.logradouro, form.numero].filter(Boolean).join(', ').trim(),
    form.complemento,
    [form.bairro, form.cidade, form.uf].filter(Boolean).join(' - ').trim(),
    form.cep
  ].filter(hasMeaningfulValue);
  return parts.join(' | ');
}

function isPersistableLogoUrl(value) {
  const raw = String(value || '').trim();
  return Boolean(raw) && !raw.startsWith('blob:');
}

function generateRowId() {
  return `row-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function isCnpjLookupComplete(data) {
  const primaryFields = [data?.razao_social, data?.nome_fantasia || data?.nome, data?.email, data?.telefone, data?.site];
  return primaryFields.filter(hasMeaningfulValue).length >= 3 && hasMeaningfulValue(data?.razao_social);
}

function normalizePaymentRow(row = {}) {
  const raw = String(row?.prazo ?? row?.descricao ?? row?.condicao_pagamento ?? row?.nome ?? '').replace(/\s+/g, '');
  return {
    id: row?.id || generateRowId(),
    prazo: raw,
    parcelas: Number(row?.parcelas ?? 0) || 0,
    prazo_medio_dias: Number(row?.prazo_medio_dias ?? row?.prazo_medio ?? 0) || 0
  };
}

function calculatePaymentRow(prazo) {
  const normalized = String(prazo || '').replace(/\s+/g, '');
  if (!normalized) return { valid: false, prazo: '', parcelas: '', prazo_medio_dias: '' };
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[1-9]\d*$/.test(part))) return { valid: false, prazo: normalized, parcelas: '', prazo_medio_dias: '' };
  const parcelas = parts.length;
  const prazo_medio_dias = Math.round(parts.reduce((sum, part) => sum + Number(part), 0) / parcelas);
  return { valid: true, prazo: parts.join('/'), parcelas, prazo_medio_dias };
}

function describePaymentRow(prazo) {
  const calc = calculatePaymentRow(prazo);
  return calc.valid ? `${calc.parcelas} parcelas · prazo médio ${calc.prazo_medio_dias} dias` : 'Digite um prazo valido';
}

function normalizePaymentInputValue(value) {
  return String(value || '').replace(/[^\d/\s]/g, '');
}

function normalizePaymentInputFinal(value) {
  const cleaned = normalizePaymentInputValue(value).replace(/\s+/g, '');
  if (!cleaned) return '';
  return cleaned.split('/').filter(Boolean).join('/');
}

function normalizePaymentRows(raw) {
  return Array.isArray(raw) ? raw.map((row) => normalizePaymentRow(row)) : [];
}

function normalizeVinculoRow(row = {}) {
  return {
    id: row?.id || generateRowId(),
    vendedor_id: row?.vendedor_id || row?.vendedor?.id || '',
    vendedor_nome: row?.vendedor_nome || row?.vendedor?.nome || '',
    vendedor_email: row?.vendedor_email || row?.vendedor?.email || '',
    principal: Boolean(row?.principal),
    status: row?.status || 'ativo',
    comissao_percentual: row?.comissao_percentual ?? '',
    pedido_minimo_valor: row?.pedido_minimo_valor ?? '',
    valor_minimo_duplicata: row?.valor_minimo_duplicata ?? '',
    condicoes_pagamento: Array.isArray(row?.condicoes_pagamento) ? row.condicoes_pagamento : [],
    observacoes: row?.observacoes || ''
  };
}

function normalizeVinculoRows(raw) {
  return Array.isArray(raw) ? raw.map((row) => normalizeVinculoRow(row)) : [];
}

function normalizeVinculoForm(row = {}) {
  return {
    vendedor_vinculo_id: row?.id || '',
    vendedor_vinculo_vendedor_id: row?.vendedor_id || '',
    vendedor_vinculo_principal: Boolean(row?.principal),
    vendedor_vinculo_status: row?.status || 'ativo',
    vendedor_vinculo_comissao_percentual: row?.comissao_percentual ?? '',
    vendedor_vinculo_pedido_minimo_valor: row?.pedido_minimo_valor ?? '',
    vendedor_vinculo_valor_minimo_duplicata: row?.valor_minimo_duplicata ?? '',
    vendedor_vinculo_observacoes: row?.observacoes || ''
  };
}

function calculatePaymentConditionMeta(value) {
  const raw = String(value || '').trim().replace(/\s+/g, '');
  if (!raw) return { valid: false, prazo: '', parcelas: '', prazo_medio_dias: '' };
  const parts = raw.split('/').filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[1-9]\d*$/.test(part))) return { valid: false, prazo: raw, parcelas: '', prazo_medio_dias: '' };
  const parcelas = parts.length;
  const prazo_medio_dias = Math.round(parts.reduce((sum, part) => sum + Number(part), 0) / parcelas);
  return { valid: true, prazo: parts.join('/'), parcelas, prazo_medio_dias };
}

function injectStyles() {
  if (document.getElementById('nh-fab-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-fab-style';
  style.textContent = `.nhf-wrap{max-width:1400px;margin:0 auto}.nhf-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhf-title{font-size:30px;font-weight:700}.nhf-sub{color:#91a4c4}.nhf-section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#91a4c4;padding-top:4px}.nhf-panel{background:linear-gradient(180deg,rgba(15,27,47,.96),rgba(11,21,37,.98));border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.22);margin-bottom:14px;color:#e7eefb}.nhf-tools{display:grid;grid-template-columns:minmax(280px,1fr) 150px 120px;gap:10px}.nhf-input,.nhf-btn,.nhf-tab{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nhf-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;cursor:pointer}.nhf-btn[disabled]{opacity:.55;cursor:not-allowed;background:#0f1b2f;color:#64748b;border-color:rgba(148,163,184,.14)}.nhf-grid{display:grid;grid-template-columns:1fr;gap:14px}.nhf-table{width:100%;border-collapse:collapse;font-size:13px}.nhf-table td,.nhf-table th{padding:10px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;white-space:nowrap}.nhf-table th{background:rgba(255,255,255,.03);color:#91a4c4}.nhf-row{cursor:pointer}.nhf-row:hover td{background:rgba(79,140,255,.14)}.nhf-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.nhf-kpis div{padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:rgba(11,22,40,.94)}.nhf-kpis strong{display:block;font-size:18px;color:#f8fafc}.nhf-modal-backdrop{position:fixed;inset:0;background:rgba(9,16,32,.46);display:flex;align-items:center;justify-content:center;padding:20px;z-index:90}.nhf-modal{width:min(1040px,100%);max-height:92vh;overflow:auto;background:linear-gradient(180deg,rgba(15,27,47,.98),rgba(11,21,37,.99));border:1px solid rgba(148,163,184,.18);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.38);color:#e7eefb}.nhf-modal-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 22px;border-bottom:1px solid rgba(148,163,184,.12);background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0))}.nhf-modal-tabs{display:flex;gap:8px;padding:14px 22px 0}.nhf-tab{background:#0b1628;color:#91a4c4;cursor:pointer}.nhf-tab[aria-selected="true"]{background:#1f56dc;color:#fff}.nhf-tab[aria-selected="false"]{opacity:.88}.nhf-modal-body{padding:18px 22px 22px}.nhf-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nhf-field{display:grid;gap:6px}.nhf-field input,.nhf-field textarea,.nhf-field select{height:38px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 10px;background:#0b1628;color:#e7eefb}.nhf-field textarea{height:80px;padding:10px;resize:vertical}.nhf-field input::placeholder,.nhf-field textarea::placeholder,.nhf-field select::placeholder{color:#7f93b4}.nhf-field input:disabled,.nhf-field textarea:disabled,.nhf-field select:disabled{background:#0f1b2f;color:#6c7a92}.nhf-field-full{grid-column:1/-1}.nhf-muted{color:#91a4c4;font-size:13px}.nhf-state{padding:24px;text-align:center;color:#91a4c4}.nhf-inline{display:flex;gap:10px;align-items:end}.nhf-inline > .nhf-field{flex:1}.nhf-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#0b1628;color:#91a4c4;font-size:12px;font-weight:600}.nhf-error{color:#fda4af}.nhf-success{color:#86efac}.nhf-info{color:#93c5fd}.nhf-warn{color:#fdba74}.nhf-inline-error{font-size:12px;color:#fda4af;margin-top:2px}.nhf-logo-miniature{width:64px;height:48px;border-radius:10px;background:#0b1628;border:1px solid rgba(148,163,184,.22);display:flex;align-items:center;justify-content:center;overflow:hidden}.nhf-logo-miniature img{max-width:100%;max-height:100%;object-fit:contain;display:block}.nhf-logo-box{display:flex;gap:12px;align-items:center}.nhf-logo-meta{display:grid;gap:4px}.nhf-lookup-success{color:#86efac}.nhf-lookup-partial{color:#93c5fd}.nhf-lookup-error{color:#fda4af}@media (max-width:1024px){.nhf-grid,.nhf-tools,.nhf-kpis,.nhf-form-grid{grid-template-columns:1fr}.nhf-title{font-size:24px}.nhf-modal{width:100%}.nhf-inline{flex-direction:column;align-items:stretch}}`;
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
    logo_upload: null,
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    endereco_completo: '',
    responsavel_vendedor_id: '',
    regiao_atendida: '',
    observacoes: '',
    pedido_minimo: 0,
    valor_minimo_duplicata: 0,
    pedido_minimo_itens: 0,
    prazo_entrega_dias: 0,
    comissao_padrao_percentual: 0,
    politica_troca: '',
    aceita_bonificacao: '',
    aceita_consignacao: '',
    condicoes_pagamento: '',
    observacoes_comerciais: '',
    tabela_precos_url: '',
    formErrors: {}
  };
}

export function renderFabricantesPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createFabricantesState();
  state.form = emptyForm();

  function isCnpjValid() {
    return onlyDigits(state.form.cnpj).length === 14;
  }

  function canEditCommercialFields() {
    return Boolean(state.cnpjValidated || state.cnpjManualUnlock);
  }

  function isLocked() {
    return !canEditCommercialFields();
  }

  function openModal(selected = null) {
    state.modalOpen = true;
    state.modalTab = 'gerais';
    state.error = false;
    state.selected = selected;
    state.condicoes = [];
    state.condicaoId = null;
    state.form = selected ? { ...emptyForm(), ...selected, cnpj: selected.cnpj || '' } : emptyForm();
    state.form.nome_fantasia = selected?.nome || selected?.nome_fantasia || state.form.nome_fantasia || '';
    state.form.valor_minimo_duplicata = selected?.valor_minimo_duplicata ?? selected?.pedido_minimo ?? 0;
    state.form.pedido_minimo_valor = selected?.pedido_minimo_valor ?? selected?.pedido_minimo ?? 0;
    state.form.pedido_minimo_display = selected?.valor_minimo_duplicata !== undefined || selected?.pedido_minimo !== undefined ? formatCurrencyFromNumber(selected.valor_minimo_duplicata ?? selected.pedido_minimo) : '';
    state.form.pedido_minimo_valor_display = selected?.pedido_minimo_valor !== undefined || selected?.pedido_minimo !== undefined ? formatCurrencyFromNumber(selected.pedido_minimo_valor ?? selected.pedido_minimo) : '';
    state.form.pedido_minimo_itens = selected?.pedido_minimo_itens ?? 0;
    state.form.prazo_entrega_dias = selected?.prazo_entrega_dias ?? 0;
    state.form.comissao_padrao_percentual = selected?.comissao_padrao_percentual ?? 0;
    state.form.politica_troca = selected?.politica_troca || '';
    state.form.aceita_bonificacao = typeof selected?.aceita_bonificacao === 'boolean' ? String(selected.aceita_bonificacao) : '';
    state.form.aceita_consignacao = typeof selected?.aceita_consignacao === 'boolean' ? String(selected.aceita_consignacao) : '';
    state.form.condicoes_pagamento = normalizePaymentRows(selected?.condicoes_pagamento || []);
    state.form.observacoes_comerciais = selected?.observacoes_comerciais || '';
    state.form.tabela_precos_url = selected?.tabela_precos_url || '';
    state.form.formErrors = {};
    state.form.logo_file_name = '';
    state.form.logo_file = null;
    state.form.logo_upload = null;
    state.form.logo_upload_error = '';
    state.form.logo_preview = isPersistableLogoUrl(selected?.logo_url) ? selected.logo_url : '';
    state.form.responsavel_vendedor_id = selected?.responsavel_vendedor_id || '';
    state.cnpjValidated = Boolean(selected?.cnpj);
    state.cnpjManualUnlock = false;
    state.cnpjMessage = '';
    state.cnpjMessageTone = '';
    state.cnpjLookupStatus = 'idle';
    state.vendedoresLoading = false;
    state.vendedoresError = '';
    state.vendedores = [];
    state.vendedoresVinculosLoading = false;
    state.vendedoresVinculosError = '';
    state.vendedoresVinculos = [];
    state.vendedorVinculoEditId = null;
    render();
    loadVendedores();
  }

  async function openEdit(selected) {
    if (!selected) return;
    openModal(selected);
    try {
      await loadVendedores();
      const detail = await fetchFabricanteData(apiClient, selected.id);
      state.selected = detail;
      state.form = { ...state.form, ...detail, nome_fantasia: detail.nome || detail.nome_fantasia || state.form.nome_fantasia || '', cnpj: detail.cnpj || '' };
      state.form.pedido_minimo_display = formatCurrencyFromNumber(detail.valor_minimo_duplicata ?? detail.pedido_minimo ?? 0);
      state.form.pedido_minimo_valor_display = formatCurrencyFromNumber(detail.pedido_minimo_valor ?? detail.pedido_minimo ?? 0);
      state.form.valor_minimo_duplicata = detail.valor_minimo_duplicata ?? detail.pedido_minimo ?? 0;
      state.form.pedido_minimo_valor = detail.pedido_minimo_valor ?? detail.pedido_minimo ?? 0;
      state.form.pedido_minimo_itens = detail.pedido_minimo_itens ?? 0;
      state.form.prazo_entrega_dias = detail.prazo_entrega_dias ?? 0;
      state.form.condicoes_pagamento = normalizePaymentRows(detail.condicoes_pagamento || []);
      state.form.aceita_bonificacao = typeof detail?.aceita_bonificacao === 'boolean' ? String(detail.aceita_bonificacao) : state.form.aceita_bonificacao || '';
      state.form.aceita_consignacao = typeof detail?.aceita_consignacao === 'boolean' ? String(detail.aceita_consignacao) : state.form.aceita_consignacao || '';
      state.form.logo_preview = isPersistableLogoUrl(detail.logo_url) ? detail.logo_url : state.form.logo_preview || '';
      state.form.logo_upload_error = '';
      state.form.responsavel_vendedor_id = detail.responsavel_vendedor_id || '';
      await fetchCondicoesPagamento(apiClient, selected.id);
      state.form.condicoes_pagamento = normalizePaymentRows(detail.condicoes_pagamento || []);
      try {
        const vinculos = await fetchFabricanteVendedores(apiClient, selected.id);
        state.vendedoresVinculos = normalizeVinculoRows(vinculos.items || []);
        state.vendedorVinculoEditId = null;
      } catch {
        state.vendedoresVinculos = [];
      }
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
    state.vendedorVinculoEditId = null;
    render();
  }

  async function loadVendedores() {
    state.vendedoresLoading = true;
    state.vendedoresError = '';
    render();
    try {
      const response = await fetchVendedoresData(apiClient, { status: 'ativo' });
      state.vendedores = response.items || [];
    } catch {
      state.vendedores = [];
      state.vendedoresError = 'Falha ao carregar vendedores. Você pode continuar sem responsável.';
    } finally {
      state.vendedoresLoading = false;
      render();
    }
  }

  async function loadFabricanteVinculos(fabricanteId) {
    if (!fabricanteId) return;
    state.vendedoresVinculosLoading = true;
    state.vendedoresVinculosError = '';
    render();
    try {
      const response = await fetchFabricanteVendedores(apiClient, fabricanteId);
      state.vendedoresVinculos = normalizeVinculoRows(response.items || []);
    } catch {
      state.vendedoresVinculos = [];
      state.vendedoresVinculosError = 'Falha ao carregar vínculos desta fábrica.';
    } finally {
      state.vendedoresVinculosLoading = false;
      render();
    }
  }

  function resetVinculoForm() {
    state.vendedorVinculoEditId = null;
    state.form.vendedor_vinculo_id = '';
    state.form.vendedor_vinculo_vendedor_id = '';
    state.form.vendedor_vinculo_principal = false;
    state.form.vendedor_vinculo_status = 'ativo';
    state.form.vendedor_vinculo_comissao_percentual = '';
    state.form.vendedor_vinculo_pedido_minimo_valor = '';
    state.form.vendedor_vinculo_valor_minimo_duplicata = '';
    state.form.vendedor_vinculo_observacoes = '';
  }

  function openVinculoForm(row = null) {
    const normalized = normalizeVinculoForm(row || {});
    state.vendedorVinculoEditId = normalized.vendedor_vinculo_id || '__new__';
    Object.assign(state.form, normalized);
    render();
  }

  function getVinculoFormPayload() {
    const rows = state.vendedoresVinculos || [];
    const vendedorId = state.form.vendedor_vinculo_vendedor_id || '';
    const editId = state.vendedorVinculoEditId || state.form.vendedor_vinculo_id || null;
    const existing = rows.find((row) => String(row.id) === String(editId)) || null;
    const normalizedPrincipal = Boolean(state.form.vendedor_vinculo_principal);
    const normalizedStatus = state.form.vendedor_vinculo_status === 'inativo' ? 'inativo' : 'ativo';
    const normalized = {
      id: editId || generateRowId(),
      vendedor_id: vendedorId,
      vendedor_nome: existing?.vendedor_nome || (state.vendedores.find((v) => String(v.id) === String(vendedorId))?.nome || ''),
      vendedor_email: existing?.vendedor_email || (state.vendedores.find((v) => String(v.id) === String(vendedorId))?.email || ''),
      principal: normalizedPrincipal,
      status: normalizedStatus,
      comissao_percentual: state.form.vendedor_vinculo_comissao_percentual === '' ? '' : Number(String(state.form.vendedor_vinculo_comissao_percentual).replace(',', '.')),
      pedido_minimo_valor: state.form.vendedor_vinculo_pedido_minimo_valor === '' ? '' : Number(String(state.form.vendedor_vinculo_pedido_minimo_valor).replace(',', '.')),
      valor_minimo_duplicata: state.form.vendedor_vinculo_valor_minimo_duplicata === '' ? '' : Number(String(state.form.vendedor_vinculo_valor_minimo_duplicata).replace(',', '.')),
      observacoes: state.form.vendedor_vinculo_observacoes || ''
    };
    if (normalized.principal) {
      return rows.map((row) => (String(row.id) === String(normalized.id) ? normalized : { ...row, principal: false })).filter(Boolean);
    }
    if (existing) {
      return rows.map((row) => (String(row.id) === String(normalized.id) ? normalized : row));
    }
    return [...rows, normalized];
  }

  function applyLookup(data) {
    const razaoSocial = data.razao_social || state.form.razao_social || '';
    const nomeFantasia = data.nome_fantasia || data.nome || razaoSocial || '';
    const email = data.email || state.form.email_comercial || '';
    const telefone = data.telefone || state.form.telefone || '';
    const site = data.site || state.form.site || '';
    const partial = !isCnpjLookupComplete({ ...data, nome_fantasia: nomeFantasia, nome: nomeFantasia, email, telefone, site, razao_social: razaoSocial });
    const endereco = data.endereco || {};
    state.form = {
      ...state.form,
      cnpj: data.cnpj || state.form.cnpj,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      nome: data.nome || state.form.nome || nomeFantasia || '',
      email_comercial: email,
      telefone,
      site,
      regiao_atendida: data.regiao_atendida || state.form.regiao_atendida || '',
      observacoes: state.form.observacoes || '',
      logradouro: data.logradouro || endereco.logradouro || state.form.logradouro || '',
      numero: data.numero || endereco.numero || state.form.numero || '',
      complemento: data.complemento || endereco.complemento || state.form.complemento || '',
      bairro: data.bairro || endereco.bairro || state.form.bairro || '',
      cidade: data.cidade || endereco.cidade || state.form.cidade || '',
      uf: data.uf || endereco.uf || state.form.uf || '',
      cep: data.cep || endereco.cep || state.form.cep || '',
      endereco_completo: data.endereco_completo || composeEnderecoCompleto({
        logradouro: data.logradouro || endereco.logradouro || state.form.logradouro || '',
        numero: data.numero || endereco.numero || state.form.numero || '',
        complemento: data.complemento || endereco.complemento || state.form.complemento || '',
        bairro: data.bairro || endereco.bairro || state.form.bairro || '',
        cidade: data.cidade || endereco.cidade || state.form.cidade || '',
        uf: data.uf || endereco.uf || state.form.uf || '',
        cep: data.cep || endereco.cep || state.form.cep || ''
      }),
      atividade_principal: data.atividade_principal || ''
    };
    if (!isPersistableLogoUrl(state.form.logo_preview)) state.form.logo_preview = '';
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
      state.cnpjManualUnlock = false;
      state.cnpjMessage = '';
      state.cnpjMessageTone = '';
      e.target.value = formatCnpj(raw);
      const buscarBtn = root.querySelector('#nhf-buscar-cnpj');
      if (buscarBtn) buscarBtn.disabled = raw.length !== 14;
      const unlockBtn = root.querySelector('#nhf-unlock-manual');
      if (unlockBtn) unlockBtn.disabled = raw.length !== 14;
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
    root.querySelector('[data-form-field="responsavel_vendedor_id"]')?.addEventListener('change', (e) => {
      state.form.responsavel_vendedor_id = e.target.value || '';
    });
    root.querySelector('[data-form-field="pedido_minimo_valor"]')?.addEventListener('input', (e) => {
      state.form.pedido_minimo_valor_display = String(e.target.value || '');
      const parsed = parseBrlInput(state.form.pedido_minimo_valor_display);
      state.form.pedido_minimo_valor = parsed ?? 0;
    });
    root.querySelector('[data-form-field="pedido_minimo_valor"]')?.addEventListener('blur', (e) => {
      const parsed = parseBrlInput(e.target.value);
      state.form.pedido_minimo_valor = parsed ?? 0;
      state.form.pedido_minimo_valor_display = parsed === null ? '' : brl(parsed);
      e.target.value = state.form.pedido_minimo_valor_display;
    });
    root.querySelector('[data-form-field="pedido_minimo"]')?.addEventListener('input', (e) => {
      state.form.pedido_minimo_display = String(e.target.value || '');
      const parsed = parseBrlInput(state.form.pedido_minimo_display);
      state.form.valor_minimo_duplicata = parsed ?? 0;
    });
    root.querySelector('[data-form-field="pedido_minimo"]')?.addEventListener('blur', (e) => {
      const parsed = parseBrlInput(e.target.value);
      state.form.valor_minimo_duplicata = parsed ?? 0;
      state.form.pedido_minimo_display = parsed === null ? '' : brl(parsed);
      e.target.value = state.form.pedido_minimo_display;
    });
    root.querySelector('[data-form-field="logo_upload"]')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0] || null;
      if (!file) return;
      if (!/image\/(png|jpeg|jpg|webp)/i.test(file.type)) {
        state.form.logo_upload_error = 'Formato de arquivo invalido. Use PNG, JPG/JPEG ou WebP.';
        render();
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        state.form.logo_upload_error = 'A logo deve ter no maximo 2MB.';
        render();
        return;
      }
      state.form.logo_file_name = file.name;
      state.form.logo_file = file;
      state.form.logo_upload_error = '';
      state.form.logo_url = '';
      state.form.logo_upload = file;
      const preview = window.URL && typeof window.URL.createObjectURL === 'function' ? window.URL.createObjectURL(file) : '';
      if (state.form.logo_preview && state.form.logo_preview.startsWith('blob:') && window.URL?.revokeObjectURL) {
        window.URL.revokeObjectURL(state.form.logo_preview);
      }
      state.form.logo_preview = preview;
      render();
    });
    root.querySelector('#nhf-save')?.addEventListener('click', async () => {
      if (!isCnpjValid() || !canEditCommercialFields()) return;
      const formErrors = {};
      const pedidoMinimoPedido = parseBrlInput(state.form.pedido_minimo_valor_display);
      const pedidoMinimoDuplicata = parseBrlInput(state.form.pedido_minimo_display);
      if (pedidoMinimoPedido !== null && pedidoMinimoPedido < 0) formErrors.pedido_minimo_valor = 'Valor nao pode ser negativo.';
      if (pedidoMinimoDuplicata !== null && pedidoMinimoDuplicata < 0) formErrors.valor_minimo_duplicata = 'Valor nao pode ser negativo.';
      if (Number(state.form.pedido_minimo_itens || 0) < 0) formErrors.pedido_minimo_itens = 'Valor nao pode ser negativo.';
      if (Number(state.form.prazo_entrega_dias || 0) < 0) formErrors.prazo_entrega_dias = 'Valor nao pode ser negativo.';
      const comissao = Number(state.form.comissao_padrao_percentual || 0);
      if (comissao < 0) formErrors.comissao_padrao_percentual = 'Valor nao pode ser negativo.';
      if (comissao > 100) formErrors.comissao_padrao_percentual = 'Comissao nao pode passar de 100%.';
      state.form.formErrors = formErrors;
      if (Object.keys(formErrors).length) {
        render();
        return;
      }
      state.saving = true;
      render();
      try {
        const paymentRows = (state.form.condicoes_pagamento || []).map((row) => calculatePaymentRow(row.prazo)).filter((row) => row.valid).map((row) => ({ prazo: row.prazo, parcelas: row.parcelas, prazo_medio_dias: row.prazo_medio_dias }));
      if ((state.form.condicoes_pagamento || []).some((row) => !calculatePaymentRow(row.prazo).valid)) {
        state.form.formErrors = { ...(state.form.formErrors || {}), condicoes_pagamento: 'Revise as condicoes de pagamento.' };
        state.saving = false;
        render();
        return;
      }
      const vinculosPayload = (state.vendedoresVinculos || []).map((row) => ({
        vendedor_id: row.vendedor_id || null,
        principal: Boolean(row.principal),
        status: row.status || 'ativo',
        comissao_percentual: row.comissao_percentual === '' || row.comissao_percentual === null ? null : Number(String(row.comissao_percentual).replace(',', '.')),
        pedido_minimo_valor: row.pedido_minimo_valor === '' || row.pedido_minimo_valor === null ? null : Number(String(row.pedido_minimo_valor).replace(',', '.')),
        valor_minimo_duplicata: row.valor_minimo_duplicata === '' || row.valor_minimo_duplicata === null ? null : Number(String(row.valor_minimo_duplicata).replace(',', '.')),
        condicoes_pagamento: String(row.condicoes_pagamento || '').trim() ? [calculatePaymentConditionMeta(row.condicoes_pagamento)].filter((item) => item.valid).map((item) => ({ prazo: item.prazo, parcelas: item.parcelas, prazo_medio_dias: item.prazo_medio_dias })) : [],
        observacoes: row.observacoes || null
      })).filter((row) => row.vendedor_id);
      const fabricantePayload = {
          nome: state.form.nome_fantasia || state.form.nome || state.form.razao_social || '',
          cnpj: onlyDigits(state.form.cnpj),
          nome_fantasia: state.form.nome_fantasia || state.form.nome || '',
          razao_social: state.form.razao_social || null,
          site: state.form.site || null,
          email_comercial: state.form.email_comercial || null,
          telefone: state.form.telefone || null,
          regiao_atendida: state.form.regiao_atendida || null,
          logradouro: state.form.logradouro || null,
          numero: state.form.numero || null,
          complemento: state.form.complemento || null,
          bairro: state.form.bairro || null,
          cidade: state.form.cidade || null,
          uf: state.form.uf || null,
          cep: state.form.cep || null,
          endereco_completo: state.form.endereco_completo || composeEnderecoCompleto(state.form) || null,
          valor_minimo_duplicata: Number.isFinite(Number(state.form.valor_minimo_duplicata)) ? Number(state.form.valor_minimo_duplicata) : (parseBrlInput(state.form.pedido_minimo_display) ?? 0),
          pedido_minimo_valor: Number.isFinite(Number(state.form.pedido_minimo_valor)) ? Number(state.form.pedido_minimo_valor) : (parseBrlInput(state.form.pedido_minimo_valor_display) ?? 0),
          pedido_minimo_itens: Number(state.form.pedido_minimo_itens || 0),
          prazo_entrega_dias: Number(state.form.prazo_entrega_dias || 0),
          comissao_padrao_percentual: Number(state.form.comissao_padrao_percentual || 0),
          politica_troca: state.form.politica_troca || null,
          aceita_bonificacao: state.form.aceita_bonificacao === '' ? undefined : state.form.aceita_bonificacao === 'true',
          aceita_consignacao: state.form.aceita_consignacao === '' ? undefined : state.form.aceita_consignacao === 'true',
          condicoes_pagamento: paymentRows,
          observacoes_comerciais: state.form.observacoes_comerciais || null,
          tabela_precos_url: state.form.tabela_precos_url || null,
          observacoes: state.form.observacoes || null,
          status: state.selected?.status === 'inativo' ? 'inativo' : 'ativo',
          responsavel_vendedor_id: state.form.responsavel_vendedor_id || null,
          vendedores: vinculosPayload
        };
        const saved = await saveFabricante(apiClient, fabricantePayload, state.selected?.id || null);
        if (saved?.id && vinculosPayload.length) await saveFabricanteVendedores(apiClient, saved.id, vinculosPayload);
        const fabricanteId = saved.id || state.selected?.id || null;
        let logoUploadError = '';
        if (state.form.logo_file && fabricanteId) {
          try {
            const logoResult = await uploadFabricanteLogo(apiClient, fabricanteId, state.form.logo_file);
            const logoUrl = logoResult?.data?.logo_url || logoResult?.logo_url || logoResult?.item?.logo_url || null;
            if (logoUrl) {
              saved.logo_url = logoUrl;
              state.form.logo_url = logoUrl;
              state.form.logo_preview = logoUrl;
              state.form.logo_file = null;
              state.form.logo_upload = null;
              state.form.logo_file_name = '';
            }
          } catch (error) {
            logoUploadError = error?.body?.error?.message || error?.message || 'Falha ao enviar a logo.';
          }
        }
        if (logoUploadError) {
          state.form.logo_upload_error = logoUploadError;
          state.error = true;
          state.saving = false;
          render();
          return;
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
      if (key === 'pedido_minimo' || key === 'pedido_minimo_valor' || key === 'logo_upload') return;
      el.addEventListener('input', (e) => { state.form[key] = e.target.value; });
      el.addEventListener('change', (e) => { state.form[key] = e.target.value; });
    });
    root.querySelector('[data-payment-add]')?.addEventListener('click', () => {
      state.form.condicoes_pagamento = [...(state.form.condicoes_pagamento || []), { id: generateRowId(), prazo: '' }];
      render();
    });
    root.querySelectorAll('[data-payment-prazo]').forEach((input) => {
      input.addEventListener('input', (e) => {
        const rowId = input.getAttribute('data-payment-prazo');
        const rawValue = String(e.target.value || '');
        state.form.condicoes_pagamento = (state.form.condicoes_pagamento || []).map((row) => String(row.id) === String(rowId) ? { ...row, prazo: rawValue } : row);
        const summary = root.querySelector(`[data-payment-summary="${rowId}"]`);
        const inlineError = root.querySelector(`[data-payment-error="${rowId}"]`);
        if (summary) summary.textContent = describePaymentRow(rawValue);
        if (inlineError) inlineError.textContent = '';
      });
      input.addEventListener('blur', (e) => {
        const rowId = input.getAttribute('data-payment-prazo');
        state.form.condicoes_pagamento = (state.form.condicoes_pagamento || []).map((row) => String(row.id) === String(rowId) ? { ...row, prazo: normalizePaymentInputFinal(e.target.value) } : row);
        render();
      });
    });
    root.querySelectorAll('[data-payment-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-payment-remove');
        state.form.condicoes_pagamento = (state.form.condicoes_pagamento || []).filter((row) => String(row.id) !== String(rowId));
        render();
      });
    });
    root.querySelector('[data-vinculo-add]')?.addEventListener('click', () => openVinculoForm(null));
    root.querySelectorAll('[data-vinculo-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rowId = btn.getAttribute('data-vinculo-edit');
        const row = (state.vendedoresVinculos || []).find((item) => String(item.id) === String(rowId));
        openVinculoForm(row || null);
      });
    });
    root.querySelectorAll('[data-vinculo-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rowId = btn.getAttribute('data-vinculo-remove');
        const row = (state.vendedoresVinculos || []).find((item) => String(item.id) === String(rowId));
        if (!state.selected?.id || !row) return;
        state.vendedoresVinculosLoading = true;
        render();
        try {
          await deleteFabricanteVendedor(apiClient, state.selected.id, row.vendedor_id);
          await loadFabricanteVinculos(state.selected.id);
          if (state.vendedorVinculoEditId === row.id) resetVinculoForm();
        } catch (error) {
          state.vendedoresVinculosError = error?.body?.error?.message || error?.message || 'Falha ao remover vínculo.';
        } finally {
          state.vendedoresVinculosLoading = false;
          render();
        }
      });
    });
    root.querySelectorAll('[data-vinculo-form-field]').forEach((el) => {
      const key = el.getAttribute('data-vinculo-form-field');
      const update = (value) => {
        if (key === 'vendedor_vinculo_principal') {
          state.form.vendedor_vinculo_principal = value === 'true' || value === true;
        } else {
          state.form[key] = value;
        }
      };
      el.addEventListener('input', (e) => update(e.target.value));
      el.addEventListener('change', (e) => update(e.target.value));
    });
    root.querySelector('[data-vinculo-form-cancel]')?.addEventListener('click', () => {
      resetVinculoForm();
      render();
    });
    root.querySelector('[data-vinculo-form-save]')?.addEventListener('click', async () => {
      if (!state.selected?.id) return;
      const vendedorId = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_vendedor_id"]')?.value || state.form.vendedor_vinculo_vendedor_id || '').trim();
      const principalValue = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_principal"]')?.value ?? state.form.vendedor_vinculo_principal ?? false);
      const statusValue = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_status"]')?.value || state.form.vendedor_vinculo_status || 'ativo');
      const comissaoValue = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_comissao_percentual"]')?.value ?? state.form.vendedor_vinculo_comissao_percentual ?? '');
      const pedidoMinimoValue = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_pedido_minimo_valor"]')?.value ?? state.form.vendedor_vinculo_pedido_minimo_valor ?? '');
      const duplicataValue = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_valor_minimo_duplicata"]')?.value ?? state.form.vendedor_vinculo_valor_minimo_duplicata ?? '');
      const observacoesValue = String(root.querySelector('[data-vinculo-form-field="vendedor_vinculo_observacoes"]')?.value ?? state.form.vendedor_vinculo_observacoes ?? '');
      if (!vendedorId) {
        state.vendedoresVinculosError = 'Selecione um vendedor.';
        render();
        return;
      }
      const duplicate = (state.vendedoresVinculos || []).some((row) => String(row.vendedor_id) === String(vendedorId) && String(row.id) !== String(state.form.vendedor_vinculo_id || ''));
      if (duplicate) {
        state.vendedoresVinculosError = 'Este vendedor já está vinculado a esta fábrica.';
        render();
        return;
      }
      state.vendedoresVinculosError = '';
      state.vendedoresVinculosLoading = true;
      render();
      try {
        const payload = {
          vendedor_id: vendedorId,
          principal: principalValue === 'true',
          status: statusValue === 'inativo' ? 'inativo' : 'ativo',
          comissao_percentual: comissaoValue === '' ? null : Number(comissaoValue.replace(',', '.')),
          pedido_minimo_valor: pedidoMinimoValue === '' ? null : Number(pedidoMinimoValue.replace(',', '.')),
          valor_minimo_duplicata: duplicataValue === '' ? null : Number(duplicataValue.replace(',', '.')),
          observacoes: observacoesValue || null
        };
        if (state.form.vendedor_vinculo_id) {
          await saveFabricanteVendedor(apiClient, state.selected.id, vendedorId, payload);
        } else {
          const nextVinculos = (state.vendedoresVinculos || [])
            .filter((row) => String(row.id) !== String(state.form.vendedor_vinculo_id || ''))
            .map((row) => ({
              vendedor_id: row.vendedor_id || null,
              principal: Boolean(row.principal),
              status: row.status || 'ativo',
              comissao_percentual: row.comissao_percentual === '' || row.comissao_percentual === null ? null : Number(String(row.comissao_percentual).replace(',', '.')),
              pedido_minimo_valor: row.pedido_minimo_valor === '' || row.pedido_minimo_valor === null ? null : Number(String(row.pedido_minimo_valor).replace(',', '.')),
              valor_minimo_duplicata: row.valor_minimo_duplicata === '' || row.valor_minimo_duplicata === null ? null : Number(String(row.valor_minimo_duplicata).replace(',', '.')),
              observacoes: row.observacoes || null
            }));
          const normalizedNewRow = {
            ...payload,
            principal: Boolean(payload.principal)
          };
          const mergedRows = normalizedNewRow.principal
            ? [...nextVinculos.map((row) => ({ ...row, principal: false })), normalizedNewRow]
            : [...nextVinculos, normalizedNewRow];
          await saveFabricanteVendedores(apiClient, state.selected.id, mergedRows);
        }
        await loadFabricanteVinculos(state.selected.id);
        resetVinculoForm();
      } catch (error) {
        state.vendedoresVinculosError = error?.body?.error?.message || error?.message || 'Falha ao salvar vínculo.';
      } finally {
        state.vendedoresVinculosLoading = false;
        render();
      }
    });
  }

  function renderFormTab() {
    const locked = isLocked();
    const lookupReady = isCnpjValid();
    const toneClass = state.cnpjMessageTone === 'success' ? 'nhf-lookup-success' : state.cnpjMessageTone === 'partial' ? 'nhf-lookup-partial' : state.cnpjMessageTone === 'error' ? 'nhf-lookup-error' : 'nhf-muted';
    const manualUnlockDisabled = state.cnpjManualUnlock;
    const cnpjHelp = lookupReady
      ? 'CNPJ com 14 dígitos pronto para consulta.'
      : 'O campo CNPJ precisa ter 14 dígitos reais para habilitar a consulta.';
    const vendorOptions = ['<option value="">Sem responsável definido</option>'].concat((state.vendedores || []).map((vendedor) => `<option value="${vendedor.id}" ${String(vendedor.id) === String(state.form.responsavel_vendedor_id || '') ? 'selected' : ''}>${vendedor.nome || '-'}${vendedor.email ? ` - ${vendedor.email}` : ''}</option>`)).join('');
    const vendorHelp = state.vendedoresLoading ? '<div class="nhf-muted">Carregando vendedores...</div>' : state.vendedoresError ? `<div class="nhf-warn">${state.vendedoresError}</div>` : '<div class="nhf-muted">Selecione um vendedor ativo da conta ou deixe sem responsável.</div>';
    const vendorDisabled = locked || state.vendedoresLoading;
    return `<div class="nhf-form-grid"><div class="nhf-field nhf-field-full"><div class="nhf-inline"><label class="nhf-field">CNPJ<input id="nhf-cnpj" value="${formatCnpj(state.form.cnpj || '')}" placeholder="00.000.000/0000-00" maxlength="18" inputmode="numeric"></label><button id="nhf-buscar-cnpj" class="nhf-btn" ${lookupReady ? '' : 'disabled'}>${state.cnpjLookupStatus === 'loading' ? 'Buscando...' : 'Buscar CNPJ'}</button></div><div class="nhf-muted">${cnpjHelp}</div>${state.cnpjMessage ? `<div class="${toneClass} nhf-muted">${state.cnpjMessage}</div>` : ''}</div><div class="nhf-field nhf-field-full"><div class="nhf-section-title">Endereço</div></div><label class="nhf-field"><span>CEP</span><input data-form-field="cep" value="${state.form.cep || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Logradouro</span><input data-form-field="logradouro" value="${state.form.logradouro || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Número</span><input data-form-field="numero" value="${state.form.numero || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Complemento</span><input data-form-field="complemento" value="${state.form.complemento || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Bairro</span><input data-form-field="bairro" value="${state.form.bairro || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Cidade</span><input data-form-field="cidade" value="${state.form.cidade || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>UF</span><input data-form-field="uf" value="${state.form.uf || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field nhf-field-full"><span>Endereço completo</span><textarea data-form-field="endereco_completo" ${locked ? 'disabled' : ''}>${state.form.endereco_completo || composeEnderecoCompleto(state.form)}</textarea></label><label class="nhf-field"><span>Nome fantasia</span><input data-form-field="nome_fantasia" value="${state.form.nome_fantasia || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Razão social</span><input data-form-field="razao_social" value="${state.form.razao_social || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>E-mail comercial</span><input data-form-field="email_comercial" value="${state.form.email_comercial || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Telefone</span><input data-form-field="telefone" value="${state.form.telefone || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Site</span><input data-form-field="site" value="${state.form.site || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Logo</span><input data-form-field="logo_upload" type="file" accept="image/png,image/jpeg,image/webp" ${locked ? 'disabled' : ''}></label><div class="nhf-field"><span>Preview</span><div class="nhf-logo-box">${state.form.logo_preview ? `<img class="nhf-logo-preview" src="${state.form.logo_preview}" alt="Preview do logo">` : '<div class="nhf-muted">Sem logo</div>'}<div class="nhf-logo-meta"><strong>${state.form.logo_file_name || 'Logo persistida'}</strong><span class="nhf-muted">PNG, JPG/JPEG ou WebP</span></div></div>${state.form.logo_upload_error ? `<div class="nhf-inline-error">${state.form.logo_upload_error}</div>` : ''}</div><label class="nhf-field"><span>Responsável comercial</span><select data-form-field="responsavel_vendedor_id" ${vendorDisabled ? 'disabled' : ''}>${vendorOptions}</select>${vendorHelp}</label><label class="nhf-field"><span>Região atendida</span><input data-form-field="regiao_atendida" value="${state.form.regiao_atendida || ''}" ${locked ? 'disabled' : ''}></label><label class="nhf-field nhf-field-full"><span>Observações</span><textarea data-form-field="observacoes" ${locked ? 'disabled' : ''}>${state.form.observacoes || ''}</textarea></label><div class="nhf-field nhf-field-full"><button id="nhf-unlock-manual" class="nhf-btn" type="button" ${manualUnlockDisabled ? 'disabled' : ''}>Liberar preenchimento manual</button></div></div>`;
  }

  function renderRulesTab() {
    const locked = isLocked();
    const errors = state.form.formErrors || {};
    const rows = (state.form.condicoes_pagamento || []).map((row) => {
      const calc = calculatePaymentRow(row.prazo);
      return `<div class="nhf-panel" data-payment-row="${row.id}" style="padding:12px"><div class="nhf-inline"><label class="nhf-field"><span>Prazo</span><input data-payment-prazo="${row.id}" value="${row.prazo || ''}" placeholder="30/60/90" ${locked ? 'disabled' : ''}></label><div class="nhf-muted" data-payment-summary="${row.id}" style="align-self:center">${calc.valid ? `${calc.parcelas} parcelas · prazo médio ${calc.prazo_medio_dias} dias` : 'Digite um prazo valido'}</div><button class="nhf-btn" type="button" data-payment-remove="${row.id}" ${locked ? 'disabled' : ''}>Remover</button></div><div class="nhf-inline-error" data-payment-error="${row.id}">${!calc.valid && row.prazo ? 'Formato invalido' : ''}</div></div>`;
    }).join('');
    return `<div class="nhf-form-grid"><label class="nhf-field"><span>Valor mínimo do pedido</span><input data-form-field="pedido_minimo_valor" value="${state.form.pedido_minimo_valor_display || formatCurrencyFromNumber(state.form.pedido_minimo_valor ?? 0)}" ${locked ? 'disabled' : ''} inputmode="decimal"><div class="nhf-inline-error">${errors.pedido_minimo_valor || ''}</div></label><label class="nhf-field"><span>Valor mínimo por duplicata</span><input data-form-field="pedido_minimo" value="${state.form.pedido_minimo_display || formatCurrencyFromNumber(state.form.valor_minimo_duplicata ?? 0)}" ${locked ? 'disabled' : ''} inputmode="decimal"><div class="nhf-inline-error">${errors.valor_minimo_duplicata || ''}</div></label><label class="nhf-field"><span>Quantidade mínima de itens</span><input data-form-field="pedido_minimo_itens" type="number" min="0" value="${state.form.pedido_minimo_itens ?? 0}" ${locked ? 'disabled' : ''}><div class="nhf-inline-error">${errors.pedido_minimo_itens || ''}</div></label><label class="nhf-field"><span>Prazo médio de entrega em dias</span><input data-form-field="prazo_entrega_dias" type="number" min="0" value="${state.form.prazo_entrega_dias ?? 0}" ${locked ? 'disabled' : ''}><div class="nhf-inline-error">${errors.prazo_entrega_dias || ''}</div></label><label class="nhf-field"><span>Comissão padrão %</span><input data-form-field="comissao_padrao_percentual" type="number" min="0" max="100" value="${state.form.comissao_padrao_percentual ?? 0}" ${locked ? 'disabled' : ''}><div class="nhf-inline-error">${errors.comissao_padrao_percentual || ''}</div></label><label class="nhf-field"><span>Aceita bonificação?</span><select data-form-field="aceita_bonificacao" ${locked ? 'disabled' : ''}><option value="">Selecione</option><option value="true" ${state.form.aceita_bonificacao === 'true' ? 'selected' : ''}>Sim</option><option value="false" ${state.form.aceita_bonificacao === 'false' ? 'selected' : ''}>Não</option></select></label><label class="nhf-field"><span>Aceita consignação?</span><select data-form-field="aceita_consignacao" ${locked ? 'disabled' : ''}><option value="">Selecione</option><option value="true" ${state.form.aceita_consignacao === 'true' ? 'selected' : ''}>Sim</option><option value="false" ${state.form.aceita_consignacao === 'false' ? 'selected' : ''}>Não</option></select></label><label class="nhf-field nhf-field-full"><span>Política de troca</span><textarea data-form-field="politica_troca" ${locked ? 'disabled' : ''}>${state.form.politica_troca || ''}</textarea></label><div class="nhf-field nhf-field-full"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><span>Condições de pagamento</span><div class="nhf-muted">Adicione linhas com prazos separados por /.</div></div><button class="nhf-btn" type="button" data-payment-add ${locked ? 'disabled' : ''}>+ Adicionar condição</button></div><div style="display:grid;gap:10px;margin-top:10px">${rows || '<div class="nhf-state">Nenhuma condição cadastrada.</div>'}</div><div class="nhf-inline-error">${errors.condicoes_pagamento || ''}</div></div><label class="nhf-field"><span>URL da tabela de preços</span><input data-form-field="tabela_precos_url" value="${state.form.tabela_precos_url || ''}" ${locked ? 'disabled' : ''}><div class="nhf-inline-error">${errors.tabela_precos_url || ''}</div></label><label class="nhf-field nhf-field-full"><span>Observações comerciais</span><textarea data-form-field="observacoes_comerciais" ${locked ? 'disabled' : ''}>${state.form.observacoes_comerciais || ''}</textarea></label></div>`;
  }

  function renderVinculosTab() {
    const locked = isLocked();
    const rows = (state.vendedoresVinculos || []).map((row) => {
      const principal = row.principal ? '<span class="nhf-pill">Sim</span>' : '<span class="nhf-muted">Não</span>';
      const vendedor = state.vendedores.find((item) => String(item.id) === String(row.vendedor_id));
      return `<tr><td>${row.vendedor_nome || vendedor?.nome || '-'}</td><td>${row.vendedor_email || vendedor?.email || '-'}</td><td><span class="nhf-pill">${row.status === 'inativo' ? 'Inativo' : 'Ativo'}</span></td><td>${principal}</td><td>${row.comissao_percentual === '' || row.comissao_percentual === null || row.comissao_percentual === undefined ? '<span class="nhf-muted">Herdada</span>' : `${row.comissao_percentual}%`}</td><td>${row.pedido_minimo_valor === '' || row.pedido_minimo_valor === null || row.pedido_minimo_valor === undefined ? '<span class="nhf-muted">Herdado</span>' : brl(Number(row.pedido_minimo_valor))}</td><td>${row.valor_minimo_duplicata === '' || row.valor_minimo_duplicata === null || row.valor_minimo_duplicata === undefined ? '<span class="nhf-muted">Herdado</span>' : brl(Number(row.valor_minimo_duplicata))}</td><td><button class="nhf-btn" type="button" data-vinculo-edit="${row.id}" ${locked ? 'disabled' : ''}>Editar</button> <button class="nhf-btn" type="button" data-vinculo-remove="${row.id}" ${locked ? 'disabled' : ''}>${row.status === 'ativo' ? 'Inativar' : 'Remover'}</button></td></tr>`;
    }).join('');
    const vendedorOptions = ['<option value="">Selecione um vendedor real</option>'].concat((state.vendedores || []).map((vendedor) => `<option value="${vendedor.id}" ${String(vendedor.id) === String(state.form.vendedor_vinculo_vendedor_id || '') ? 'selected' : ''}>${vendedor.nome || '-'}${vendedor.email ? ` - ${vendedor.email}` : ''}${(state.vendedoresVinculos || []).some((row) => String(row.vendedor_id) === String(vendedor.id) && String(row.id) !== String(state.form.vendedor_vinculo_id || '')) ? ' (já vinculado)' : ''}</option>`)).join('');
    const editorVisible = Boolean(state.vendedorVinculoEditId);
    return `<div class="nhf-form-grid"><div class="nhf-field nhf-field-full"><div class="nhf-inline"><div><div class="nhf-section-title">Vendedores</div><div class="nhf-muted">Selecione um vendedor da conta e ajuste apenas as regras específicas desta fábrica. Campos vazios herdam da fábrica.</div></div><button class="nhf-btn" type="button" data-vinculo-add ${locked ? 'disabled' : ''}>Adicionar vendedor</button></div>${state.vendedoresVinculosError ? `<div class="nhf-inline-error">${state.vendedoresVinculosError}</div>` : ''}${state.vendedoresVinculosLoading ? '<div class="nhf-muted">Carregando vínculos...</div>' : ''}<div style="overflow:auto;margin-top:10px"><table class="nhf-table"><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Principal</th><th>Comissão específica</th><th>Pedido mín.</th><th>Duplicata mín.</th><th>Ações</th></tr>${rows || '<tr><td colspan="8" class="nhf-state">Nenhum vendedor vinculado a esta fábrica.</td></tr>'}</table></div></div>${editorVisible ? `<div class="nhf-panel nhf-field-full" style="padding:14px"><div class="nhf-inline" style="justify-content:space-between"><div><div class="nhf-section-title">${state.vendedorVinculoEditId ? 'Editar vínculo' : 'Adicionar vínculo'}</div><div class="nhf-muted">As regras vazias herdam da fábrica.</div></div><button class="nhf-btn" type="button" data-vinculo-form-cancel>Cancelar</button></div><div class="nhf-form-grid" style="margin-top:12px"><label class="nhf-field"><span>Vendedor</span><select data-vinculo-form-field="vendedor_vinculo_vendedor_id" ${locked ? 'disabled' : ''}>${vendedorOptions}</select></label><label class="nhf-field"><span>Status</span><select data-vinculo-form-field="vendedor_vinculo_status" ${locked ? 'disabled' : ''}><option value="ativo" ${state.form.vendedor_vinculo_status === 'ativo' ? 'selected' : ''}>Ativo</option><option value="inativo" ${state.form.vendedor_vinculo_status === 'inativo' ? 'selected' : ''}>Inativo</option></select></label><label class="nhf-field"><span>Principal</span><select data-vinculo-form-field="vendedor_vinculo_principal" ${locked ? 'disabled' : ''}><option value="false" ${!state.form.vendedor_vinculo_principal ? 'selected' : ''}>Não</option><option value="true" ${state.form.vendedor_vinculo_principal ? 'selected' : ''}>Sim</option></select></label><label class="nhf-field"><span>Comissão %</span><input data-vinculo-form-field="vendedor_vinculo_comissao_percentual" value="${state.form.vendedor_vinculo_comissao_percentual ?? ''}" inputmode="decimal" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Pedido mínimo</span><input data-vinculo-form-field="vendedor_vinculo_pedido_minimo_valor" value="${state.form.vendedor_vinculo_pedido_minimo_valor ?? ''}" inputmode="decimal" ${locked ? 'disabled' : ''}></label><label class="nhf-field"><span>Duplicata mínima</span><input data-vinculo-form-field="vendedor_vinculo_valor_minimo_duplicata" value="${state.form.vendedor_vinculo_valor_minimo_duplicata ?? ''}" inputmode="decimal" ${locked ? 'disabled' : ''}></label><label class="nhf-field nhf-field-full"><span>Observações</span><textarea data-vinculo-form-field="vendedor_vinculo_observacoes" ${locked ? 'disabled' : ''}>${state.form.vendedor_vinculo_observacoes || ''}</textarea></label><div class="nhf-field nhf-field-full"><button class="nhf-btn" type="button" data-vinculo-form-save ${locked ? 'disabled' : ''}>Salvar vínculo</button></div></div></div>` : ''}</div>`;
  }

  function renderModal() {
    const actionLabel = state.selected ? 'Salvar alterações' : 'Salvar fábrica';
    return `<div id="nhf-modal-backdrop" class="nhf-modal-backdrop" tabindex="0"><div class="nhf-modal"><div class="nhf-modal-head"><div><div class="nhf-title">${state.selected ? 'Editar fábrica' : 'Nova fábrica'}</div><div class="nhf-sub">Cadastre a fábrica começando pelo CNPJ e siga com os dados comerciais.</div></div><button id="nhf-modal-close" class="nhf-btn" type="button">Fechar</button></div><div class="nhf-modal-tabs"><button class="nhf-tab" data-tab="gerais" aria-selected="${state.modalTab === 'gerais'}">Informações gerais</button><button class="nhf-tab" data-tab="regras" aria-selected="${state.modalTab === 'regras'}">Regras comerciais</button><button class="nhf-tab" data-tab="vinculos" aria-selected="${state.modalTab === 'vinculos'}">Vendedores</button></div><div class="nhf-modal-body">${state.modalTab === 'gerais' ? renderFormTab() : state.modalTab === 'regras' ? renderRulesTab() : renderVinculosTab()}<div style="margin-top:18px;display:flex;justify-content:flex-end;gap:10px"><button id="nhf-save" class="nhf-btn" type="button" ${(!isCnpjValid() || !canEditCommercialFields()) ? 'disabled' : ''}>${state.saving ? 'Salvando...' : actionLabel}</button></div></div></div></div>`;
  }

  function render() {
    const k = {
      total: state.items.length,
      ativos: state.items.filter((i) => i.status === 'ativo').length,
      inativos: state.items.filter((i) => i.status === 'inativo').length,
      semLogo: state.items.filter((i) => !i.logo_url).length,
      semPedido: state.items.filter((i) => Number(i.pedido_minimo || 0) <= 0).length
    };
    const rows = state.items.map((item) => {
      const logoCell = item.logo_url
        ? `<div class="nhf-logo-miniature"><img src="${item.logo_url}" alt="Logo de ${item.nomeExibicao || 'fábrica'}"></div>`
        : '<span class="nhf-muted">Sem logo</span>';
      const responsible = item.responsavel_comercial_nome
        ? `${item.responsavel_comercial_nome}${item.responsavel_comercial_email ? ` <span class="nhf-muted">(${item.responsavel_comercial_email})</span>` : ''}`
        : '<span class="nhf-muted">Sem responsável</span>';
      return `<tr class="nhf-row" data-id="${item.id}"><td>${logoCell}</td><td>${item.nomeExibicao}</td><td>${item.cnpjExibicao}</td><td>${responsible}</td><td><span class="nhf-pill">${item.statusExibicao === 'inativo' ? 'Inativa' : 'Ativa'}</span></td><td>${brl(item.pedidoMinimoExibicao)}</td><td>${item.pedidoMinimoItensExibicao}</td><td>${item.comissaoExibicao}%</td><td><button class="nhf-btn" type="button" data-edit-id="${item.id}">Editar</button> <button class="nhf-btn" type="button" data-toggle-id="${item.id}">${item.statusExibicao === 'ativo' ? 'Inativar' : 'Ativar'}</button></td></tr>`;
    }).join('');
    root.innerHTML = `<div class="nhf-wrap"><div class="nhf-head"><div><div class="nhf-title">Fábricas</div><div class="nhf-sub">Cadastro de fabricantes e regras comerciais</div></div><div class="nhf-tools"><input id="nhf-search" class="nhf-input" placeholder="Pesquisar" value="${state.search}"/><select id="nhf-status" class="nhf-input"><option value="">Todos</option><option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>Ativos</option><option value="inativo" ${state.status === 'inativo' ? 'selected' : ''}>Inativos</option></select><button id="nhf-new" class="nhf-btn">Nova fábrica</button></div></div><div class="nhf-panel nhf-kpis"><div><strong>${k.total}</strong>Total fábricas</div><div><strong>${k.ativos}</strong>Ativas</div><div><strong>${k.inativos}</strong>Inativas</div><div><strong>${k.semLogo}</strong>Sem logo</div><div><strong>${k.semPedido}</strong>Sem pedido mínimo</div></div><div class="nhf-grid"><section class="nhf-panel"><table class="nhf-table"><tr><th>Miniatura</th><th>Nome</th><th>CNPJ</th><th>Responsável</th><th>Status</th><th>Pedido mínimo</th><th>Itens mín.</th><th>Comissão</th><th>Ações</th></tr>${rows || '<tr><td colspan="9" class="nhf-state">Nenhuma fábrica cadastrada.</td></tr>'}</table></section></div></div>${state.modalOpen ? renderModal() : ''}`;
    bindEvents();
  }

  async function load() {
    try {
      const response = await fetchFabricantesData(apiClient, { search: state.search, status: state.status });
      state.items = mapFabricantesData(response).items;
      if (state.selected?.id) {
        state.selected = await fetchFabricanteData(apiClient, state.selected.id);
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
