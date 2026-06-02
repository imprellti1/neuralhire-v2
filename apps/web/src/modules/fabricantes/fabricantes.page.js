import { createFabricantesState } from './fabricantes.state.js';
import { fetchCondicoesPagamento, fetchFabricanteData, fetchFabricantesData, saveCondicaoPagamento, saveFabricante } from './fabricantes.service.js';
import { mapFabricantesData } from './fabricantes.mapper.js';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function injectStyles() {
  if (document.getElementById('nh-fab-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-fab-style';
  style.textContent = `.nhf-wrap{max-width:1400px;margin:0 auto}.nhf-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}.nhf-title{font-size:30px;font-weight:700}.nhf-sub{color:#61708f}.nhf-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06);margin-bottom:14px}.nhf-tools{display:grid;grid-template-columns:minmax(280px,1fr) 150px 120px;gap:10px}.nhf-input,.nhf-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nhf-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;cursor:pointer}.nhf-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:14px}.nhf-table{width:100%;border-collapse:collapse;font-size:13px}.nhf-table td,.nhf-table th{padding:10px;border-bottom:1px solid #ebf0f8;text-align:left;white-space:nowrap}.nhf-row{cursor:pointer}.nhf-row:hover td{background:#f7faff}.nhf-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.nhf-kpis div{padding:10px;border:1px solid #e5ecf8;border-radius:12px}.nhf-kpis strong{display:block;font-size:18px}.nhf-field{display:grid;gap:6px;margin-bottom:10px}.nhf-field input,.nhf-field textarea,.nhf-field select{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px}.nhf-field textarea{height:80px;padding:10px;resize:vertical}.nhf-muted{color:#61708f;font-size:13px}.nhf-state{padding:24px;text-align:center;color:#61708f}@media (max-width:1024px){.nhf-grid,.nhf-tools,.nhf-kpis{grid-template-columns:1fr}.nhf-title{font-size:24px}}`;
  document.head.appendChild(style);
}

export function renderFabricantesPage(root, { apiClient, fabricanteId = null } = {}) {
  injectStyles();
  const state = createFabricantesState();
  const selectedId = fabricanteId;

  function counts() {
    return {
      total: state.items.length,
      ativos: state.items.filter((i) => i.status === 'ativo').length,
      inativos: state.items.filter((i) => i.status === 'inativo').length,
      semLogo: state.items.filter((i) => !i.logo_url).length,
      semPedido: state.items.filter((i) => Number(i.pedido_minimo || 0) <= 0).length
    };
  }

  function render() {
    const k = counts();
    const rows = state.items.map((item) => `<tr class="nhf-row" data-id="${item.id}"><td>${item.logo_url ? 'Logo' : '-'}</td><td>${item.nomeExibicao}</td><td>${item.cnpjExibicao}</td><td>${item.statusExibicao}</td><td>${brl(item.pedidoMinimoExibicao)}</td><td>${brl(item.boletoMinimoExibicao)}</td><td>${item.comissaoExibicao}%</td><td>${item.prazoMaximoExibicao ?? '-'}</td><td><button class="nhf-btn nhf-edit" data-edit="${item.id}">Editar</button></td></tr>`).join('');
    const condRows = (state.condicoes || []).map((c) => `<tr><td>${c.nome || '-'}</td><td>${c.codigo || '-'}</td><td>${c.parcelas || 1}</td><td>${c.prazo_medio_dias ?? '-'}</td><td>${brl(c.valor_minimo)}</td><td>${Number(c.percentual_acrescimo || 0)}%</td><td>${c.ativo ? 'Sim' : 'Não'}</td></tr>`).join('');

    root.innerHTML = `<div class="nhf-wrap"><div class="nhf-head"><div><div class="nhf-title">Fábricas</div><div class="nhf-sub">Cadastro de fabricantes e regras comerciais</div></div><div class="nhf-tools"><input id="nhf-search" class="nhf-input" placeholder="Pesquisar" value="${state.search}"/><select id="nhf-status" class="nhf-input"><option value="">Todos</option><option value="ativo" ${state.status === 'ativo' ? 'selected' : ''}>Ativos</option><option value="inativo" ${state.status === 'inativo' ? 'selected' : ''}>Inativos</option></select><button id="nhf-new" class="nhf-btn">Nova fábrica</button></div></div><div class="nhf-panel nhf-kpis"><div><strong>${k.total}</strong>Total fábricas</div><div><strong>${k.ativos}</strong>Ativas</div><div><strong>${k.inativos}</strong>Inativas</div><div><strong>${k.semLogo}</strong>Sem logo</div><div><strong>${k.semPedido}</strong>Sem pedido mínimo</div></div><div class="nhf-grid"><section class="nhf-panel"><table class="nhf-table"><tr><th>Logo</th><th>Nome</th><th>CNPJ</th><th>Status</th><th>Pedido mínimo</th><th>Boleto mínimo</th><th>Comissão</th><th>Prazo máximo</th><th>Ações</th></tr>${rows || '<tr><td colspan="9" class="nhf-state">Nenhuma fábrica encontrada.</td></tr>'}</table></section><section class="nhf-panel">${selectedId ? renderDetailPanel() : '<div class="nhf-state">Selecione uma fábrica para ver dados e condições de pagamento.</div>'}</section></div></div>`;

    root.querySelector('#nhf-search').oninput = (e) => { state.search = e.target.value || ''; load(); };
    root.querySelector('#nhf-status').onchange = (e) => { state.status = e.target.value || ''; load(); };
    root.querySelector('#nhf-new').onclick = () => openCreate();
    root.querySelectorAll('.nhf-row').forEach((row) => { row.onclick = () => { window.location.hash = `#/fabricantes/${row.getAttribute('data-id')}`; }; });
    root.querySelectorAll('.nhf-edit').forEach((btn) => { btn.onclick = (e) => { e.stopPropagation(); openEdit(btn.getAttribute('data-edit')); }; });
    const save = root.querySelector('#nhf-save');
    if (save) save.onclick = () => submitMainForm();
    const saveCond = root.querySelector('#nhf-save-cond');
    if (saveCond) saveCond.onclick = () => submitCondForm();
  }

  function renderDetailPanel() {
    const f = state.selected || {};
    const condRows = (state.condicoes || []).map((c) => `<tr><td>${c.nome || '-'}</td><td>${c.codigo || '-'}</td><td>${c.parcelas || 1}</td><td>${c.prazo_medio_dias ?? '-'}</td><td>${brl(c.valor_minimo)}</td><td>${Number(c.percentual_acrescimo || 0)}%</td><td>${c.ativo ? 'Sim' : 'Não'}</td></tr>`).join('');
    return `<div><h3>Dados da fábrica</h3><div class="nhf-muted">${f.nome || ''}</div><hr/><h3>Regras Comerciais</h3><div class="nhf-muted">Pedido mínimo: ${brl(f.pedido_minimo)} | Boleto mínimo: ${brl(f.boleto_minimo)} | Comissão: ${Number(f.comissao_padrao_percentual || 0)}% | Prazo: ${f.prazo_maximo_dias ?? '-'}</div><hr/><h3>Condições de Pagamento</h3><table class="nhf-table"><tr><th>Nome</th><th>Código</th><th>Parcelas</th><th>Prazo médio</th><th>Valor mínimo</th><th>Acréscimo</th><th>Ativo</th></tr>${condRows || '<tr><td colspan="7" class="nhf-state">Sem condições cadastradas.</td></tr>'}</table><div style="margin-top:10px"><button id="nhf-new-cond" class="nhf-btn">Nova condição</button></div>${renderForm()}</div>`;
  }

  function renderForm() {
    const f = state.form;
    return `<div style="margin-top:12px"><h3>${selectedId ? 'Editar fábrica' : 'Criar fábrica'}</h3><label class="nhf-field">Nome<input id="nhf-nome" value="${f.nome || ''}"></label><label class="nhf-field">Razão social<input id="nhf-razao_social" value="${f.razao_social || ''}"></label><label class="nhf-field">CNPJ<input id="nhf-cnpj" value="${f.cnpj || ''}"></label><label class="nhf-field">Logo URL<input id="nhf-logo_url" value="${f.logo_url || ''}"></label><label class="nhf-field">Status<select id="nhf-status-form"><option value="ativo" ${f.status === 'ativo' ? 'selected' : ''}>ativo</option><option value="inativo" ${f.status === 'inativo' ? 'selected' : ''}>inativo</option></select></label><label class="nhf-field">Pedido mínimo<input id="nhf-pedido_minimo" value="${f.pedido_minimo ?? 0}"></label><label class="nhf-field">Boleto mínimo<input id="nhf-boleto_minimo" value="${f.boleto_minimo ?? 0}"></label><label class="nhf-field">Comissão padrão<input id="nhf-comissao_padrao_percentual" value="${f.comissao_padrao_percentual ?? 0}"></label><label class="nhf-field">Prazo máximo<input id="nhf-prazo_maximo_dias" value="${f.prazo_maximo_dias ?? ''}"></label><label class="nhf-field">Observações<textarea id="nhf-observacoes">${f.observacoes || ''}</textarea></label><button id="nhf-save" class="nhf-btn">${state.saving ? 'Salvando...' : 'Salvar'}</button><div class="nhf-muted">${state.error ? 'Não foi possível concluir a operação.' : ''}</div></div>`;
  }

  function openCreate() {
    window.location.hash = '#/fabricantes/novo';
  }

  function openEdit(id) {
    window.location.hash = `#/fabricantes/${id}`;
  }

  function bindForm() {
    ['nome', 'razao_social', 'cnpj', 'logo_url', 'pedido_minimo', 'boleto_minimo', 'comissao_padrao_percentual', 'prazo_maximo_dias'].forEach((key) => {
      const el = root.querySelector(`#nhf-${key}`);
      if (el) el.oninput = (e) => { state.form[key] = e.target.value; };
    });
    const status = root.querySelector('#nhf-status-form');
    if (status) status.onchange = (e) => { state.form.status = e.target.value; };
  }

  async function load() {
    state.loading = true; render();
    try {
      const response = await fetchFabricantesData(apiClient, { search: state.search, status: state.status });
      state.items = mapFabricantesData(response).items;
      state.empty = !state.items.length;
      if (selectedId && selectedId !== 'novo') {
        state.selected = await fetchFabricanteData(apiClient, selectedId);
        const cond = await fetchCondicoesPagamento(apiClient, selectedId);
        state.condicoes = cond.items || [];
        state.form = { ...state.form, ...state.selected };
      }
    } catch {
      state.error = true;
    } finally {
      state.loading = false; render(); bindForm();
    }
  }

  async function submitMainForm() {
    state.saving = true; render(); bindForm();
    try {
      const payload = { ...state.form, pedido_minimo: Number(state.form.pedido_minimo || 0), boleto_minimo: Number(state.form.boleto_minimo || 0), comissao_padrao_percentual: Number(state.form.comissao_padrao_percentual || 0), prazo_maximo_dias: state.form.prazo_maximo_dias === '' ? null : Number(state.form.prazo_maximo_dias || 0) };
      await saveFabricante(apiClient, payload, selectedId && selectedId !== 'novo' ? selectedId : null);
      window.location.hash = '#/fabricantes';
    } catch {
      state.error = true;
    } finally { state.saving = false; render(); }
  }

  async function submitCondForm() {
    if (!selectedId || selectedId === 'novo') return;
    state.saving = true; render(); bindForm();
    try {
      await saveCondicaoPagamento(apiClient, selectedId, {
        ...state.condicaoForm,
        parcelas: Number(state.condicaoForm.parcelas || 1),
        prazo_medio_dias: Number(state.condicaoForm.prazo_medio_dias || 0),
        valor_minimo: Number(state.condicaoForm.valor_minimo || 0),
        percentual_acrescimo: Number(state.condicaoForm.percentual_acrescimo || 0)
      });
      await load();
    } catch {
      state.error = true;
    } finally { state.saving = false; render(); }
  }

  load();
}
