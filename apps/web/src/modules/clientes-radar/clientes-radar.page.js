import { createClientesRadarState } from './clientes-radar.state.js';
import { fetchClientesRadarData, recalcularClientesRadarData } from './clientes-radar.service.js';
import { fetchVendedoresData } from '../vendedores/vendedores.service.js';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR');

function brl(value) {
  return money.format(Number(value || 0));
}

function injectStyles() {
  if (document.getElementById('nh-clientes-radar-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-clientes-radar-style';
  style.textContent = `
    .nhr-wrap{display:grid;gap:16px}
    .nhr-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap}
    .nhr-title{font-size:32px;font-weight:800;letter-spacing:-.03em}
    .nhr-sub{margin-top:6px;color:#91a4c4;max-width:70ch}
    .nhr-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;min-width:min(100%,760px)}
    .nhr-input,.nhr-btn,.nhr-link{height:40px;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:#0b1628;color:#e7eefb;padding:0 12px}
    .nhr-btn{background:#4f8cff;border-color:#4f8cff;font-weight:700;cursor:pointer}
    .nhr-link{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:rgba(79,140,255,.12);border-color:rgba(79,140,255,.22)}
    .nhr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .nhr-kpi{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:16px;padding:16px}
    .nhr-kpi small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#91a4c4}
    .nhr-kpi b{display:block;margin-top:8px;font-size:28px;letter-spacing:-.02em}
    .nhr-section{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px}
    .nhr-section-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap}
    .nhr-section-head h3{margin:0;font-size:18px}
    .nhr-list{display:grid;gap:12px}
    .nhr-card{border:1px solid rgba(148,163,184,.16);border-radius:16px;padding:16px;background:linear-gradient(180deg,rgba(255,255,255,.02),rgba(255,255,255,0))}
    .nhr-card-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    .nhr-name{font-size:18px;font-weight:800}
    .nhr-meta{margin-top:6px;color:#91a4c4;font-size:13px}
    .nhr-badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:rgba(79,140,255,.16);color:#cfe0ff;font-size:12px;font-weight:700}
    .nhr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
    .nhr-loading .s{height:16px;background:linear-gradient(90deg,#10233d,#173055,#10233d);background-size:200% 100%;animation:sh 1.1s infinite;border-radius:8px;margin:8px 0}
    .nhr-empty,.nhr-error{padding:24px;text-align:center;color:#91a4c4}
    @keyframes sh{0%{background-position:0 0}100%{background-position:200% 0}}
    @media (max-width:1100px){.nhr-kpis,.nhr-filters{grid-template-columns:repeat(2,minmax(0,1fr))}.nhr-title{font-size:28px}}
    @media (max-width:720px){.nhr-kpis,.nhr-filters{grid-template-columns:1fr}.nhr-title{font-size:24px}}
  `;
  document.head.appendChild(style);
}

function renderCards(items, tone, emptyLabel) {
  if (!items.length) return `<div class="nhr-empty">${emptyLabel}</div>`;
  return `<div class="nhr-list">${items.map((item) => `
    <article class="nhr-card">
      <div class="nhr-card-top">
        <div>
          <div class="nhr-name">${tone.prefix} ${item.nome}</div>
          <div class="nhr-meta">${tone.subtitle(item)}</div>
        </div>
        <span class="nhr-badge">${tone.badge(item)}</span>
      </div>
      <div class="nhr-meta" style="margin-top:12px">${brl(item.faturamento_total)} • ${num.format(item.total_pedidos || 0)} pedidos • ${item.alertas_ativos || 0} alertas</div>
      <div class="nhr-actions">
        <a class="nhr-link" href="#/clientes/${item.id}">Abrir Cliente</a>
        <a class="nhr-link" href="#/clientes/${item.id}">CRM</a>
      </div>
    </article>
  `).join('')}</div>`;
}

export function renderClientesRadarPage(root, { apiClient }) {
  injectStyles();
  const state = createClientesRadarState();

  function toneFor(group) {
    const map = {
      vip: { prefix: '🟢', badge: (item) => `Score ${item.score_classificacao || 'A'}`, subtitle: (item) => `${brl(item.faturamento_total)} • ${num.format(item.total_pedidos || 0)} pedidos` },
      recorrentes: { prefix: '🔵', badge: (item) => `${item.dias_sem_compra ?? '-'} dias`, subtitle: (item) => `Última compra ${item.ultima_compra ? new Date(item.ultima_compra).toLocaleDateString('pt-BR') : '-'}` },
      potenciais: { prefix: '🟣', badge: (item) => 'Potencial Alto', subtitle: (item) => `Score ${item.score || 0}` },
      recuperacao: { prefix: '🟡', badge: (item) => 'Recuperação', subtitle: (item) => `Última compra ${item.ultima_compra ? new Date(item.ultima_compra).toLocaleDateString('pt-BR') : '-'}` },
      risco: { prefix: '🔴', badge: (item) => `${item.dias_sem_compra ?? '-'} dias sem compra`, subtitle: (item) => `Alertas ativos: ${item.alertas_ativos || 0}` },
      inativos: { prefix: '⚫', badge: (item) => `${item.dias_sem_compra ?? '-'} dias sem compra`, subtitle: (item) => `Faturamento ${brl(item.faturamento_total)}` }
    };
    return map[group];
  }

  function render() {
    const d = state.data;
    root.innerHTML = `
      <section class="nhr-wrap">
        <div class="nhr-top">
          <div>
            <div class="nhr-title">Radar Comercial</div>
            <div class="nhr-sub">Visão executiva consolidada da carteira com score, alertas, segmentação e histórico comercial.</div>
          </div>
          <div class="nhr-filters">
            <select id="nhr-vendedor" class="nhr-input"><option value="">Vendedor</option></select>
            <input id="nhr-cidade" class="nhr-input" placeholder="Cidade" value="${state.filters.cidade}" />
            <input id="nhr-estado" class="nhr-input" placeholder="Estado" value="${state.filters.estado}" />
            <select id="nhr-segmento" class="nhr-input">
              <option value="">Segmento</option>
              <option value="VIP" ${state.filters.segmento === 'VIP' ? 'selected' : ''}>VIP</option>
              <option value="RECORRENTE" ${state.filters.segmento === 'RECORRENTE' ? 'selected' : ''}>Recorrente</option>
              <option value="POTENCIAL" ${state.filters.segmento === 'POTENCIAL' ? 'selected' : ''}>Potencial</option>
              <option value="RECUPERACAO" ${state.filters.segmento === 'RECUPERACAO' ? 'selected' : ''}>Recuperação</option>
              <option value="EM_RISCO" ${state.filters.segmento === 'EM_RISCO' ? 'selected' : ''}>Em Risco</option>
              <option value="INATIVO" ${state.filters.segmento === 'INATIVO' ? 'selected' : ''}>Inativo</option>
            </select>
            <button id="nhr-recalculate" class="nhr-btn">Atualizar Radar</button>
            <button id="nhr-apply" class="nhr-btn">Atualizar</button>
          </div>
        </div>
        ${state.message ? `<div class="nhr-section">${state.message}</div>` : ''}
        ${state.loading ? `<div class="nhr-section nhr-loading"><div class="s"></div><div class="s"></div><div class="s"></div></div>` : ''}
        ${state.error ? `<div class="nhr-section nhr-error">Erro ao carregar o radar.<br/><br/><button id="nhr-retry" class="nhr-btn">Tentar novamente</button></div>` : ''}
        ${!state.loading && !state.error && d ? `
          <section class="nhr-kpis">
            <article class="nhr-kpi"><small>Clientes</small><b>${num.format(d.resumo.total_clientes || 0)}</b></article>
            <article class="nhr-kpi"><small>VIP</small><b>${num.format(d.resumo.total_vip || 0)}</b></article>
            <article class="nhr-kpi"><small>Em Risco</small><b>${num.format(d.resumo.total_risco || 0)}</b></article>
            <article class="nhr-kpi"><small>Potenciais</small><b>${num.format(d.resumo.total_potenciais || 0)}</b></article>
          </section>
          <section class="nhr-kpi" style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px">
            <article class="nhr-kpi"><small>Faturamento</small><b>${brl(d.resumo.faturamento_total || 0)}</b></article>
            <article class="nhr-kpi"><small>Ticket Médio</small><b>${brl(d.resumo.ticket_medio_geral || 0)}</b></article>
            <article class="nhr-kpi"><small>Recuperação</small><b>${num.format(d.resumo.total_recuperacao || 0)}</b></article>
            <article class="nhr-kpi"><small>Inativos</small><b>${num.format(d.resumo.total_inativos || 0)}</b></article>
            <article class="nhr-kpi"><small>Com Alertas</small><b>${num.format(d.resumo.clientes_com_alertas || 0)}</b></article>
          </section>
          <section class="nhr-section">
            <div class="nhr-section-head"><h3>VIP</h3><span class="nhr-badge">${num.format(d.grupos.vip.length || 0)} clientes</span></div>
            ${renderCards(d.grupos.vip || [], toneFor('vip'), 'Nenhum cliente VIP encontrado.')}
          </section>
          <section class="nhr-section">
            <div class="nhr-section-head"><h3>Em Risco</h3><span class="nhr-badge">${num.format(d.grupos.risco.length || 0)} clientes</span></div>
            ${renderCards(d.grupos.risco || [], toneFor('risco'), 'Nenhum cliente em risco encontrado.')}
          </section>
          <section class="nhr-section">
            <div class="nhr-section-head"><h3>Potenciais</h3><span class="nhr-badge">${num.format(d.grupos.potenciais.length || 0)} clientes</span></div>
            ${renderCards(d.grupos.potenciais || [], toneFor('potenciais'), 'Nenhum cliente potencial encontrado.')}
          </section>
        ` : ''}
      </section>
    `;

    const vendedor = root.querySelector('#nhr-vendedor');
    if (vendedor) {
      vendedor.innerHTML = `<option value="">Vendedor</option>${(state.vendedores || []).map((v) => `<option value="${v.id}" ${state.filters.vendedor_id === v.id ? 'selected' : ''}>${v.nome || v.id}</option>`).join('')}`;
      vendedor.value = state.filters.vendedor_id || '';
      vendedor.onchange = () => { state.filters.vendedor_id = vendedor.value || ''; load(); };
    }
    root.querySelector('#nhr-cidade')?.addEventListener('change', (e) => { state.filters.cidade = e.target.value || ''; });
    root.querySelector('#nhr-estado')?.addEventListener('change', (e) => { state.filters.estado = e.target.value || ''; });
    root.querySelector('#nhr-segmento')?.addEventListener('change', (e) => { state.filters.segmento = e.target.value || ''; });
    root.querySelector('#nhr-recalculate')?.addEventListener('click', () => recalculate());
    root.querySelector('#nhr-apply')?.addEventListener('click', () => load());
    root.querySelector('#nhr-retry')?.addEventListener('click', () => load());
  }

  async function load() {
    state.loading = true;
    state.error = null;
    render();
    try {
      state.data = await fetchClientesRadarData(apiClient, state.filters);
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function recalculate() {
    state.loading = true;
    state.error = null;
    state.message = '';
    render();
    try {
      const result = await recalcularClientesRadarData(apiClient, state.filters);
      state.message = `Radar atualizado: ${result.processados || 0} clientes processados, ${result.falhas || 0} falhas`;
      state.data = await fetchClientesRadarData(apiClient, state.filters);
    } catch {
      state.error = true;
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadVendedores() {
    try {
      const data = await fetchVendedoresData(apiClient, { status: 'ativo' });
      state.vendedores = data.items || [];
    } catch {
      state.vendedores = [];
    }
  }

  render();
  loadVendedores().finally(() => load());
}
