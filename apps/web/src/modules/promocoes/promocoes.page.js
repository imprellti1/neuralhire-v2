import { createPromocoesState } from './promocoes.state.js';
import { calculatePrecoPromocional, mapPromocoesData } from './promocoes.mapper.js';
import { deletePromocao, fetchPromocoesData, savePromocao } from './promocoes.service.js';

function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('pt-BR');
}

function normalizeStatus(status, ativaAgora) {
  const raw = String(status || '').toLowerCase();
  if (raw === 'agendada' || raw === 'scheduled') return 'agendada';
  if (raw === 'encerrada' || raw === 'finalizada' || raw === 'expired') return 'encerrada';
  if (raw === 'inativa' || raw === 'inactive' || ativaAgora === false) return 'inativa';
  if (raw === 'ativa' || raw === 'active' || ativaAgora === true) return 'ativa';
  return raw || 'inativa';
}

function statusLabel(status, ativaAgora) {
  const normalized = normalizeStatus(status, ativaAgora);
  if (normalized === 'ativa') return 'Ativa';
  if (normalized === 'agendada') return 'Agendada';
  if (normalized === 'encerrada') return 'Encerrada';
  return 'Inativa';
}

function statusClass(status, ativaAgora) {
  const normalized = normalizeStatus(status, ativaAgora);
  if (normalized === 'ativa') return 'is-active';
  if (normalized === 'agendada') return 'is-scheduled';
  if (normalized === 'encerrada') return 'is-finished';
  return 'is-inactive';
}

function scopeLabel(item) {
  return item?.aplicar_em_todas_variacoes === false ? 'Variações específicas' : 'Todas as variações';
}

function scopeClass(item) {
  return item?.aplicar_em_todas_variacoes === false ? 'is-specific' : 'is-all';
}

function toPercent(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function computeStats(items) {
  const list = Array.isArray(items) ? items : [];
  const stats = { ativa: 0, agendada: 0, encerrada: 0, inativa: 0, descontoTotal: 0, descontoCount: 0 };
  list.forEach((item) => {
    const normalized = normalizeStatus(item?.status, item?.ativaAgora);
    if (stats[normalized] !== undefined) stats[normalized] += 1;
    const desconto = Number(item?.percentual_desconto);
    if (Number.isFinite(desconto)) {
      stats.descontoTotal += desconto;
      stats.descontoCount += 1;
    }
  });
  return { ...stats, descontoMedio: stats.descontoCount ? stats.descontoTotal / stats.descontoCount : 0 };
}

function injectStyles() {
  if (document.getElementById('nh-promocoes-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-promocoes-style';
  style.textContent = `
  .nhp-wrap{max-width:1320px;width:100%;margin:0 auto;display:grid;gap:16px}
  .nhp-panel{background:#fff;border:1px solid #dbe4f2;border-radius:18px;padding:20px;box-shadow:0 8px 24px rgba(16,34,68,.06)}
  .nhp-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .nhp-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
  .nhp-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
  .nhp-btn,.nhp-input,.nhp-select,.nhp-textarea{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#fff;color:#16284a}
  .nhp-btn{background:#1f56dc;color:#fff;border-color:#1f56dc;font-weight:600;cursor:pointer}
  .nhp-btn.secondary{background:#fff;color:#1f56dc}
  .nhp-btn[disabled]{opacity:.6;cursor:not-allowed}
  .nhp-grid-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .nhp-kpi{padding:16px;border:1px solid #e5ecf8;border-radius:16px;background:linear-gradient(180deg,#fff,#f9fbff)}
  .nhp-kpi small{display:block;color:#61708f;font-size:12px}
  .nhp-kpi strong{display:block;margin-top:8px;font-size:26px;color:#0f172a;letter-spacing:-.02em}
  .nhp-kpi span{display:block;margin-top:6px;color:#61708f;font-size:13px}
  .nhp-table-wrap{overflow:auto}
  .nhp-table{width:100%;border-collapse:collapse;min-width:980px}
  .nhp-table th,.nhp-table td{padding:12px 10px;border-bottom:1px solid #edf2f8;text-align:left;vertical-align:top;font-size:13px}
  .nhp-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#61708f;background:#f8fbff}
  .nhp-row:hover td{background:#f8fbff}
  .nhp-badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
  .nhp-badge.is-active{background:#ecfdf3;color:#047857}
  .nhp-badge.is-scheduled{background:#eff6ff;color:#1d4ed8}
  .nhp-badge.is-finished{background:#fff7ed;color:#b45309}
  .nhp-badge.is-inactive{background:#f1f5f9;color:#475569}
  .nhp-badge.is-all{background:#eaf1ff;color:#1d4ed8}
  .nhp-badge.is-specific{background:#eef2ff;color:#4338ca}
  .nhp-actions{display:flex;gap:8px;flex-wrap:wrap}
  .nhp-state{padding:28px;text-align:center;color:#607091}
  .nhp-state-card{display:grid;gap:12px;place-items:center;min-height:260px}
  .nhp-loading .s{height:16px;background:linear-gradient(90deg,#eef2f8,#f9fbff,#eef2f8);background-size:200% 100%;animation:nhp-sh 1.1s infinite;border-radius:8px;margin:8px 0}
  @keyframes nhp-sh{0%{background-position:0% 0}100%{background-position:200% 0}}
  .nhp-error{padding:24px;text-align:center;color:#607091}
  .nhp-form{display:grid;gap:16px}
  .nhp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
  .nhp-form-card{border:1px solid #e5ecf8;border-radius:16px;padding:16px;background:#fff;display:grid;gap:12px}
  .nhp-form-card h3{margin:0;font-size:18px}
  .nhp-field{display:grid;gap:6px}
  .nhp-field small{color:#61708f}
  .nhp-field .nhp-input,.nhp-field .nhp-select,.nhp-field .nhp-textarea{width:100%}
  .nhp-field .nhp-textarea{height:88px;padding:10px;resize:vertical}
  .nhp-radio-group{display:grid;gap:10px}
  .nhp-radio{display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid #dbe4f2;border-radius:12px;background:#f8fbff;cursor:pointer}
  .nhp-radio input{margin-top:3px}
  .nhp-variation-box{display:grid;gap:10px;padding:12px;border:1px dashed #cbd7ea;border-radius:14px;background:#fbfdff}
  .nhp-variation-list{display:grid;gap:8px}
  .nhp-variation-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #e5ecf8;border-radius:12px;background:#fff}
  .nhp-variation-meta{display:grid;gap:2px}
  .nhp-variation-meta strong{font-size:13px}
  .nhp-variation-meta small{color:#61708f}
  .nhp-form-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
  .nhp-muted{color:#61708f}
  @media (max-width:1280px){.nhp-grid-kpi{grid-template-columns:repeat(2,minmax(0,1fr))}.nhp-title{font-size:28px}}
  @media (max-width:1024px){.nhp-form-grid{grid-template-columns:1fr}.nhp-table{min-width:860px}}
  `;
  document.head.appendChild(style);
}

function renderBadge(text, className) {
  return `<span class="nhp-badge ${className}">${text}</span>`;
}

function renderEmptyState(onCreate) {
  return `<section class="nhp-panel nhp-state-card"><div class="nhp-state">Nenhuma promoção cadastrada.</div><button id="nhp-create-first" class="nhp-btn">Criar primeira promoção</button></section>`;
}

function renderForm(state) {
  const showSpecific = state.form.aplicar_em_todas_variacoes === false;
  const variacoes = Array.isArray(state.form.variacoes_disponiveis) ? state.form.variacoes_disponiveis : [];
  return `<section class="nhp-panel nhp-form">
    <div>
      <h2 style="margin:0;font-size:20px">Formulário</h2>
      <div class="nhp-sub">Organize a promoção, o período e o escopo de variações em blocos claros.</div>
    </div>
    <div class="nhp-form-grid">
      <article class="nhp-form-card">
        <h3>Dados da promoção</h3>
        <label class="nhp-field">Nome da promoção<input id="nhp-nome" class="nhp-input" value="${state.form.nome || ''}"></label>
        <label class="nhp-field">Status<select id="nhp-status" class="nhp-select"><option value="ativa" ${String(state.form.status || 'ativa') === 'ativa' ? 'selected' : ''}>Ativa</option><option value="agendada" ${String(state.form.status || '') === 'agendada' ? 'selected' : ''}>Agendada</option><option value="encerrada" ${String(state.form.status || '') === 'encerrada' ? 'selected' : ''}>Encerrada</option><option value="inativa" ${String(state.form.status || '') === 'inativa' ? 'selected' : ''}>Inativa</option></select></label>
      </article>
      <article class="nhp-form-card">
        <h3>Período e desconto</h3>
        <div class="nhp-form-grid" style="grid-template-columns:1fr 1fr">
          <label class="nhp-field">Data inicial<input id="nhp-data_inicio" type="date" class="nhp-input" value="${state.form.data_inicio || ''}"></label>
          <label class="nhp-field">Data final<input id="nhp-data_fim" type="date" class="nhp-input" value="${state.form.data_fim || ''}"></label>
        </div>
        <label class="nhp-field">Desconto percentual<input id="nhp-percentual_desconto" type="number" min="0" max="100" class="nhp-input" value="${state.form.percentual_desconto ?? ''}"></label>
      </article>
      <article class="nhp-form-card">
        <h3>Produto e variações</h3>
        <label class="nhp-field">Produto<input id="nhp-produto_id" class="nhp-input" value="${state.form.produto_id || ''}"></label>
        <div class="nhp-radio-group" role="radiogroup" aria-label="Escopo da promoção">
          <label class="nhp-radio"><input type="radio" name="nhp-escopo" id="nhp-escopo-all" value="all" ${state.form.aplicar_em_todas_variacoes !== false ? 'checked' : ''}><span><strong>Todas as variações</strong><br/><small class="nhp-muted">Aplica o desconto automaticamente em toda a grade do produto.</small></span></label>
          <label class="nhp-radio"><input type="radio" name="nhp-escopo" id="nhp-escopo-specific" value="specific" ${showSpecific ? 'checked' : ''}><span><strong>Variações específicas</strong><br/><small class="nhp-muted">Selecione ou informe as variações que recebem a promoção.</small></span></label>
        </div>
        ${showSpecific ? `<div class="nhp-variation-box" id="nhp-variacoes"><strong>Variações específicas</strong><div class="nhp-muted">Lista clara de variações selecionadas.</div>${variacoes.length ? `<div class="nhp-variation-list">${variacoes.map((variacao, index) => `<label class="nhp-variation-item"><span class="nhp-variation-meta"><strong>${variacao.nome || `Variação ${index + 1}`}</strong><small>${variacao.id || 'sem id'}</small></span><input type="checkbox" class="nhp-variacao-check" data-variacao-id="${variacao.id || ''}" ${Array.isArray(state.form.variacao_ids) && state.form.variacao_ids.some((id) => String(id) === String(variacao.id)) ? 'checked' : ''}></label>`).join('')}</div>` : `<textarea id="nhp-variacao_ids" class="nhp-textarea" placeholder="Informe os IDs das variações separados por vírgula">${Array.isArray(state.form.variacao_ids) ? state.form.variacao_ids.join(', ') : ''}</textarea>`}</div>` : `<div class="nhp-variation-box" id="nhp-variacoes"><strong>Todas as variações</strong><div class="nhp-muted">Nenhuma seleção manual necessária.</div></div>`}
      </article>
    </div>
    <div class="nhp-form-actions"><button id="nhp-cancel" class="nhp-btn secondary">Cancelar</button><button id="nhp-save" class="nhp-btn">Salvar</button></div>
  </section>`;
}

function renderList(items) {
  const rows = items.map((item) => {
    const scope = scopeLabel(item);
    const desconto = toPercent(item?.percentual_desconto);
    const price = Number(item?.preco_base || item?.preco || 0);
    const promoPrice = calculatePrecoPromocional(price, desconto);
    return `<tr class="nhp-row" data-id="${item?.id || ''}">
      <td><strong>${item?.nome || '-'}</strong><div class="nhp-muted">${item?.id || ''}</div></td>
      <td>${item?.produto_nome || item?.produto || item?.produto_id || '-'}</td>
      <td><strong>${desconto}%</strong><div class="nhp-muted">${brl(price)} -> ${brl(promoPrice)}</div></td>
      <td>${formatDate(item?.data_inicio)} a ${formatDate(item?.data_fim)}</td>
      <td>${renderBadge(statusLabel(item?.status, item?.ativaAgora), statusClass(item?.status, item?.ativaAgora))}</td>
      <td>${renderBadge(scope, scopeClass(item))}</td>
      <td>
        <div class="nhp-actions">
          <button class="nhp-btn secondary" data-action="edit" data-id="${item?.id || ''}">Editar</button>
          <button class="nhp-btn secondary" data-action="disable" data-id="${item?.id || ''}">Inativar</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  return `<section class="nhp-panel"><div class="nhp-table-wrap"><table class="nhp-table"><thead><tr><th>Promoção</th><th>Produto</th><th>Desconto</th><th>Período</th><th>Status</th><th>Escopo</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export function renderPromocoesPage(root, { apiClient } = {}) {
  injectStyles();
  const state = createPromocoesState();
  state.form.variacoes_disponiveis = state.form.variacoes_disponiveis || [];

  function syncFormFromRadio() {
    const specific = root.querySelector('#nhp-escopo-specific');
    state.form.aplicar_em_todas_variacoes = !specific || !specific.checked ? true : false;
  }

  function render() {
    const items = Array.isArray(state.items) ? state.items : [];
    const stats = computeStats(items);
    const formSection = state.formOpen ? renderForm(state) : '';
    const listing = items.length ? renderList(items) : renderEmptyState();
    root.innerHTML = `
      <section class="nhp-wrap">
        <header class="nhp-panel nhp-header">
          <div>
            <div class="nhp-title">Promoções</div>
            <div class="nhp-sub">Gerencie descontos por período para produtos e variações.</div>
          </div>
          <div>
            <button id="nhp-new" class="nhp-btn">Nova promoção</button>
          </div>
        </header>
        <section class="nhp-grid-kpi" aria-label="Resumo de promoções">
          <article class="nhp-kpi"><small>Promoções ativas</small><strong>${stats.ativa}</strong><span>Em vigor no momento</span></article>
          <article class="nhp-kpi"><small>Agendadas</small><strong>${stats.agendada}</strong><span>Programadas para iniciar</span></article>
          <article class="nhp-kpi"><small>Encerradas/Inativas</small><strong>${stats.encerrada + stats.inativa}</strong><span>Fora do ar</span></article>
          <article class="nhp-kpi"><small>Desconto médio</small><strong>${stats.descontoMedio.toFixed(1)}%</strong><span>Baseado nas promoções carregadas</span></article>
        </section>
        ${state.loading ? '<section class="nhp-panel nhp-loading" aria-busy="true"><div class="s"></div><div class="s"></div><div class="s"></div><div class="s"></div></section>' : ''}
        ${state.error ? `<section class="nhp-panel nhp-error" role="alert" aria-live="assertive">Não foi possível carregar as promoções.<br/><br/><button id="nhp-retry" class="nhp-btn">Tentar novamente</button></section>` : ''}
        ${!state.loading && !state.error ? listing : ''}
        ${formSection}
      </section>
    `;

    root.querySelector('#nhp-new')?.addEventListener('click', () => { state.formOpen = true; render(); });
    root.querySelector('#nhp-create-first')?.addEventListener('click', () => { state.formOpen = true; render(); });
    root.querySelector('#nhp-retry')?.addEventListener('click', load);
    root.querySelectorAll('[data-action="disable"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        await deletePromocao(apiClient, id);
        await load();
      });
    });
    root.querySelectorAll('[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const selected = items.find((item) => String(item.id) === String(id));
        if (!selected) return;
        state.formOpen = true;
        state.form = {
          ...state.form,
          id: selected.id,
          nome: selected.nome || '',
          produto_id: selected.produto_id || '',
          percentual_desconto: selected.percentual_desconto ?? '',
          data_inicio: selected.data_inicio || '',
          data_fim: selected.data_fim || '',
          status: normalizeStatus(selected.status, selected.ativaAgora),
          aplicar_em_todas_variacoes: selected.aplicar_em_todas_variacoes !== false,
          variacao_ids: Array.isArray(selected.variacao_ids) ? selected.variacao_ids : (Array.isArray(selected.variacoesSelecionadas) ? selected.variacoesSelecionadas.map((item) => item.id).filter(Boolean) : [])
        };
        render();
      });
    });

    if (state.formOpen) {
      root.querySelector('#nhp-cancel')?.addEventListener('click', () => { state.formOpen = false; render(); });
      root.querySelector('#nhp-save')?.addEventListener('click', async () => {
        syncFormFromRadio();
        const selectedIds = Array.from(root.querySelectorAll('.nhp-variacao-check:checked')).map((el) => el.getAttribute('data-variacao-id')).filter(Boolean);
        const typedIds = (root.querySelector('#nhp-variacao_ids')?.value || '').split(',').map((value) => value.trim()).filter(Boolean);
        const payload = {
          nome: root.querySelector('#nhp-nome')?.value || '',
          produto_id: root.querySelector('#nhp-produto_id')?.value || '',
          percentual_desconto: Number(root.querySelector('#nhp-percentual_desconto')?.value || 0),
          data_inicio: root.querySelector('#nhp-data_inicio')?.value || '',
          data_fim: root.querySelector('#nhp-data_fim')?.value || '',
          status: root.querySelector('#nhp-status')?.value || 'ativa',
          aplicar_em_todas_variacoes: state.form.aplicar_em_todas_variacoes !== false,
          variacao_ids: state.form.aplicar_em_todas_variacoes === false ? (selectedIds.length ? selectedIds : typedIds) : []
        };
        await savePromocao(apiClient, payload, state.form.id || null);
        state.formOpen = false;
        await load();
      });
      root.querySelector('#nhp-escopo-all')?.addEventListener('change', () => { state.form.aplicar_em_todas_variacoes = true; render(); });
      root.querySelector('#nhp-escopo-specific')?.addEventListener('change', () => { state.form.aplicar_em_todas_variacoes = false; render(); });
    }
  }

  async function load() {
    state.loading = true;
    state.error = '';
    render();
    try {
      state.items = mapPromocoesData(await fetchPromocoesData(apiClient)).items;
    } catch {
      state.error = 'error';
    } finally {
      state.loading = false;
      render();
    }
  }

  render();
  load();
}
