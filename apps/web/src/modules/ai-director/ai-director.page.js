import { askDirector, consultManager, createMemory, fetchAiDirectorDashboard, listExecutiveMemories, listManagers, listMemories } from './ai-director.service.js';
import { createAiDirectorState } from './ai-director.state.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function classifyDelegationFallback(question) {
  const normalized = String(question ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rules = [
    { intent: 'analise_clientes', keywords: ['cliente', 'clientes', 'risco', 'carteira', 'recompra'], managers: ['comercial', 'followup'] },
    { intent: 'analise_faturamento', keywords: ['faturamento', 'receita', 'venda', 'vendas', 'pedido', 'pedidos'], managers: ['comercial'] },
    { intent: 'analise_produtos', keywords: ['produto', 'produtos', 'categoria', 'categorias', 'fabricante', 'fabricantes', 'promoção', 'promoções', 'importação', 'importações'], managers: ['produtos'] },
    { intent: 'analise_auditoria', keywords: ['erro', 'erros', 'log', 'logs', 'auditoria', 'inconsistência', 'inconsistencias', 'integridade'], managers: ['auditoria'] },
    { intent: 'analise_administrativa', keywords: ['usuário', 'usuarios', 'permissão', 'permissoes', 'configuração', 'configuracoes', 'tenant', 'conta'], managers: ['administrativo'] }
  ];
  const match = rules.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)));
  return match || { intent: 'analise_geral', managers: ['comercial', 'produtos'] };
}

function managerNamesFor(ids, managers = []) {
  const map = new Map(managers.map((manager) => [manager.id, manager.nome]));
  return ids.map((id) => map.get(id) || id);
}

function formatCompactDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(numeric);
}

function formatCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(numeric);
}

function executiveMemoryMatchesFilter(memory, filter) {
  if (!filter || filter === 'all') return true;
  return String(memory?.categoria || '').toLowerCase() === filter;
}

function severityClass(value) {
  const normalized = String(value || '').toLowerCase();
  if (['high', 'alta', 'critica', 'crítica'].includes(normalized)) return 'danger';
  if (['medium', 'media', 'média'].includes(normalized)) return 'warning';
  if (['low', 'baixa'].includes(normalized)) return 'success';
  return 'muted';
}

function badgeClass(value) {
  const normalized = String(value || '').toLowerCase();
  if (['high', 'alta', 'critica', 'crítica', 'critico', 'crítico'].includes(normalized)) return 'danger';
  if (['medium', 'media', 'média', 'atencao', 'atenção', 'bom'].includes(normalized)) return 'warning';
  if (['low', 'baixa', 'excelente'].includes(normalized)) return 'success';
  return 'muted';
}

function moduleBadgeClass(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'saudavel') return 'success';
  if (normalized === 'atencao') return 'warning';
  if (normalized === 'critico') return 'danger';
  return 'muted';
}

function normalizeModuleStatus(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'saudavel') return 'Saudável';
  if (normalized === 'atencao') return 'Atenção';
  if (normalized === 'critico') return 'Crítico';
  return value || '—';
}

function normalizeClassificacao(value) {
  const normalized = String(value || '').toLowerCase();
  if (['excelente'].includes(normalized)) return 'Excelente';
  if (['boa'].includes(normalized)) return 'Boa';
  if (['atencao', 'atenção'].includes(normalized)) return 'Atenção';
  if (['critica', 'crítica'].includes(normalized)) return 'Crítica';
  return value || '—';
}

function formatRadarMetric(value) {
  if (value === null || value === undefined || value === '') return '0';
  return formatCount(value);
}

function safeSlice(list = [], max = 3) {
  const items = Array.isArray(list) ? list : [];
  const shown = items.slice(0, max);
  const rest = Math.max(items.length - shown.length, 0);
  return { shown, rest };
}

function executiveFactsSummary(facts) {
  if (!facts || typeof facts !== 'object') return [];
  const entries = [];
  for (const [key, value] of Object.entries(facts)) {
    let display = '—';
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      display = Object.keys(value).slice(0, 3).map((innerKey) => `${innerKey}: ${value[innerKey]}`).join(' · ') || '—';
    } else if (Array.isArray(value)) {
      display = value.slice(0, 3).map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join(' · ') || '—';
    } else {
      display = String(value);
    }
    entries.push({ key, value: display });
    if (entries.length >= 4) break;
  }
  return entries;
}

function normalizeRadarSnapshot(radar = {}) {
  const scoreExecutivo = radar.scoreExecutivo && typeof radar.scoreExecutivo === 'object' ? radar.scoreExecutivo : {};
  const pilares = scoreExecutivo.pilares && typeof scoreExecutivo.pilares === 'object' ? scoreExecutivo.pilares : {};
  const auditoria = radar.auditoria && typeof radar.auditoria === 'object' ? radar.auditoria : {};
  const consistencia = auditoria.consistencia && typeof auditoria.consistencia === 'object' ? auditoria.consistencia : {};
  const qualidade = auditoria.qualidade && typeof auditoria.qualidade === 'object' ? auditoria.qualidade : {};
  const monitoramento = radar.monitoramento && typeof radar.monitoramento === 'object' ? radar.monitoramento : {};
  return {
    resumoExecutivo: String(radar.resumoExecutivo || ''),
    resumoModular: String(radar.resumoModular || ''),
    observacoesPorModulo: Array.isArray(radar.observacoesPorModulo) ? radar.observacoesPorModulo : [],
    prioridades: Array.isArray(radar.prioridades) ? radar.prioridades : [],
    acoesSugeridas: Array.isArray(radar.acoesSugeridas) ? radar.acoesSugeridas : [],
    alteracoesRelevantes: Array.isArray(radar.alteracoesRelevantes) ? radar.alteracoesRelevantes : [],
    resumoAlteracoes: String(radar.resumoAlteracoes || ''),
    monitoramento: {
      janelaHoras: Number(monitoramento.janelaHoras) || 24,
      geradoEm: String(monitoramento.geradoEm || ''),
      totalAlteracoes: Number(monitoramento.totalAlteracoes) || 0
    },
    alertas: Array.isArray(radar.alertas) ? radar.alertas : [],
    oportunidades: Array.isArray(radar.oportunidades) ? radar.oportunidades : [],
    persistenciaInsights: radar.persistenciaInsights && typeof radar.persistenciaInsights === 'object' ? radar.persistenciaInsights : {},
    auditoria: {
      versao: String(auditoria.versao || ''),
      geradoEm: String(auditoria.geradoEm || ''),
      tempoGeracaoMs: Number(auditoria.tempoGeracaoMs) || 0,
      fontesUtilizadas: Array.isArray(auditoria.fontesUtilizadas) ? auditoria.fontesUtilizadas : [],
      consistencia: {
        scoreValido: Boolean(consistencia.scoreValido),
        prioridadesValidas: Boolean(consistencia.prioridadesValidas),
        acoesValidas: Boolean(consistencia.acoesValidas),
        limitesRespeitados: Boolean(consistencia.limitesRespeitados)
      },
      qualidade: {
        percentualPrioridadesComAcao: Number(qualidade.percentualPrioridadesComAcao) || 0,
        percentualPrioridadesComGerente: Number(qualidade.percentualPrioridadesComGerente) || 0,
        percentualObservacoesComResumo: Number(qualidade.percentualObservacoesComResumo) || 0
      }
    },
    scoreExecutivo: {
      valor: Number(scoreExecutivo.valor) || 0,
      classificacao: String(scoreExecutivo.classificacao || ''),
      diagnostico: String(scoreExecutivo.diagnostico || ''),
      penalidades: Array.isArray(scoreExecutivo.penalidades) ? scoreExecutivo.penalidades : [],
      pilares: {
        comercial: pilares.comercial && typeof pilares.comercial === 'object' ? pilares.comercial : null,
        operacional: pilares.operacional && typeof pilares.operacional === 'object' ? pilares.operacional : null,
        produtos: pilares.produtos && typeof pilares.produtos === 'object' ? pilares.produtos : null,
        inteligencia: pilares.inteligencia && typeof pilares.inteligencia === 'object' ? pilares.inteligencia : null
      }
    }
  };
}

export async function renderAiDirectorPage(container, { apiClient } = {}) {
  const state = createAiDirectorState();
  const AUTO_REFRESH_INTERVAL_MS = 30000;
  let autoRefreshTimer = null;
  let autoRefreshInFlight = false;
  let destroyed = false;

  const formatClockTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const clearAutoRefreshTimer = () => {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  };

  const cleanup = () => {
    destroyed = true;
    clearAutoRefreshTimer();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };

  function scheduleAutoRefresh() {
    if (destroyed) return;
    clearAutoRefreshTimer();
    if (!state.autoRefreshEnabled) return;
    autoRefreshTimer = setInterval(() => {
      void refreshDashboard({ silent: true });
    }, AUTO_REFRESH_INTERVAL_MS);
  }

  function isPageVisible() {
    if (typeof document === 'undefined' || !('visibilityState' in document)) return true;
    return document.visibilityState !== 'hidden';
  }

  function handleVisibilityChange() {
    if (destroyed || !state.autoRefreshEnabled) return;
    if (isPageVisible()) {
      void refreshDashboard({ silent: true });
    }
  }

  async function refreshDashboard({ silent = false } = {}) {
    if (!apiClient || destroyed) return false;
    if (autoRefreshInFlight) return false;
    if (!silent) {
      state.autoRefreshError = null;
    }
    if (!isPageVisible()) {
      state.autoRefreshEnabled = true;
      if (!silent) render();
      return false;
    }
    autoRefreshInFlight = true;
    state.autoRefreshLoading = true;
    if (!silent) render();
    try {
      const dashboardResult = await fetchAiDirectorDashboard(apiClient);
      state.dashboard = dashboardResult;
      state.lastAutoRefreshAt = new Date().toISOString();
      state.autoRefreshError = null;
      return true;
    } catch (error) {
      state.autoRefreshError = 'Falha ao atualizar radar automaticamente';
      return false;
    } finally {
      autoRefreshInFlight = false;
      state.autoRefreshLoading = false;
      if (!destroyed) render();
    }
  }

  const render = () => {
    if (state.loading) {
      container.innerHTML = '<section><h1>Diretor IA</h1><p>Carregando...</p></section>';
      return;
    }
    if (state.error) {
      container.innerHTML = '<section><h1>Diretor IA</h1><p>Erro ao carregar o dashboard.</p></section>';
      return;
    }

    const dashboard = state.dashboard || {};
    const health = dashboard.health || {};
    const radar = normalizeRadarSnapshot(dashboard.radar || {});
    const scoreExecutivo = radar.scoreExecutivo;
    const prioridades = radar.prioridades;
    const observacoesPorModulo = radar.observacoesPorModulo;
    const acoesSugeridas = radar.acoesSugeridas;
    const alteracoesRelevantes = radar.alteracoesRelevantes;
    const persistenciaInsights = radar.persistenciaInsights;
    const auditoriaRadar = radar.auditoria;
    const penalidades = scoreExecutivo.penalidades;
    const pilares = scoreExecutivo.pilares || {};
    const pillarEntries = [
      ['Comercial', pilares.comercial],
      ['Operacional', pilares.operacional],
      ['Produtos', pilares.produtos],
      ['Inteligência', pilares.inteligencia]
    ];
    const pillarsHtml = pillarEntries.map(([label, pillar]) => pillar ? `
      <section class="nh-card" style="padding: 16px;">
        <div class="nh-between">
          <strong>${esc(label)}</strong>
          <span class="nh-badge ${badgeClass(pillar.status)}">${esc(normalizeClassificacao(pillar.status))}</span>
        </div>
        <div style="font-size: 2rem; font-weight: 800; margin-top: 10px;">${esc(formatRadarMetric(pillar.valor))}</div>
        <div class="nh-mini" style="margin-top: 4px;">Valor do pilar</div>
          <div class="nh-mini" style="margin-top: 10px;">${esc((Array.isArray(pillar.fatores) ? pillar.fatores : []).slice(0, 2).join(' · ') || 'Sem dados suficientes')}</div>
      </section>
    ` : `
      <section class="nh-card" style="padding: 16px;">
        <strong>${esc(label)}</strong>
        <div class="nh-mini" style="margin-top: 10px;">Sem dados suficientes</div>
      </section>
    `).join('');
    const prioritiesHtml = prioridades.slice(0, 7).map((item) => `
      <div class="nh-list-item" style="${Number(item.ordem) === 1 ? 'border-color: rgba(76,227,138,.45); box-shadow: 0 0 0 1px rgba(76,227,138,.18) inset;' : ''}">
        <div class="nh-between">
          <div class="nh-badge ${Number(item.ordem) === 1 ? 'success' : 'muted'}">Prioridade ${esc(item.ordem || '—')}</div>
          <div class="nh-mini">Peso ${esc(formatRadarMetric(item.peso))}</div>
        </div>
        <div style="margin-top: 10px; font-size: 1.05rem; font-weight: 700;">${esc(item.titulo)}</div>
        <div class="nh-flex" style="margin-top: 10px; flex-wrap: wrap;">
          <span class="nh-badge ${badgeClass(item.impacto)}">Impacto: ${esc(normalizeClassificacao(item.impacto))}</span>
          <span class="nh-badge ${badgeClass(item.urgencia)}">Urgência: ${esc(normalizeClassificacao(item.urgencia))}</span>
        </div>
        <div class="nh-mini" style="margin-top: 10px;">Motivo: ${esc(item.motivo || '—')}</div>
        <div class="nh-mini" style="margin-top: 6px;">Ação recomendada: ${esc(item.acaoRecomendada || '—')}</div>
        ${item.gerenteSugerido ? `<div class="nh-mini" style="margin-top: 6px;">Gerente sugerido: ${esc(item.gerenteSugerido)}</div>` : ''}
      </div>
    `).join('');
    const actionsHtml = acoesSugeridas.slice(0, 5).length ? acoesSugeridas.slice(0, 5).map((item) => `
      <div class="nh-list-item">
        <div class="nh-between">
          <div>
            <div class="nh-badge ${badgeClass(item.prioridade)}">Prioridade ${esc(normalizeClassificacao(item.prioridade))}</div>
            <div style="margin-top: 8px; font-size: 1.02rem; font-weight: 700;">${esc(item.ordem)}. ${esc(item.titulo)}</div>
          </div>
          <div class="nh-mini">${esc(item.prazoSugerido || 'sem_prazo')}</div>
        </div>
        <div class="nh-mini" style="margin-top: 10px;">Tipo: ${esc(item.tipo || 'geral')} · Origem: ${esc(item.origem || '—')}</div>
        <div style="margin-top: 8px;">${esc(item.descricao || '—')}</div>
        ${item.gerenteSugerido ? `<div class="nh-mini" style="margin-top: 8px;">Gerente sugerido: ${esc(item.gerenteSugerido)}</div>` : ''}
        <div class="nh-mini" style="margin-top: 8px;">Critério de conclusão: ${esc(item.criterioConclusao || '—')}</div>
      </div>
    `).join('') : '<div class="nh-mini">Sem ações sugeridas no momento.</div>';
    const persistenciaHtml = `
      <div class="nh-grid-3" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
        <div class="nh-list-item">
          <div class="nh-mini">Candidatos</div>
          <div style="margin-top: 6px; font-size: 1.5rem; font-weight: 800;">${esc(formatRadarMetric(persistenciaInsights?.candidatos ?? 0))}</div>
        </div>
        <div class="nh-list-item">
          <div class="nh-mini">Persistidos</div>
          <div style="margin-top: 6px; font-size: 1.5rem; font-weight: 800;">${esc(formatRadarMetric(persistenciaInsights?.persistidos ?? 0))}</div>
        </div>
        <div class="nh-list-item">
          <div class="nh-mini">Ignorados</div>
          <div style="margin-top: 6px; font-size: 1.5rem; font-weight: 800;">${esc(formatRadarMetric(persistenciaInsights?.ignorados ?? 0))}</div>
        </div>
      </div>
    `;
    const auditoriaHtml = `
      <div class="nh-grid-2" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
        <div class="nh-list-item">
          <div class="nh-mini">Versão</div>
          <div style="margin-top: 6px; font-size: 1.2rem; font-weight: 800;">${esc(auditoriaRadar?.versao || '—')}</div>
        </div>
        <div class="nh-list-item">
          <div class="nh-mini">Tempo de geração</div>
          <div style="margin-top: 6px; font-size: 1.2rem; font-weight: 800;">${esc(formatRadarMetric(auditoriaRadar?.tempoGeracaoMs ?? 0))} ms</div>
        </div>
        <div class="nh-list-item">
          <div class="nh-mini">Score validado</div>
          <div style="margin-top: 6px; font-size: 1.2rem; font-weight: 800;">${esc(auditoriaRadar?.consistencia?.scoreValido ? 'Sim' : 'Não')}</div>
        </div>
        <div class="nh-list-item">
          <div class="nh-mini">Total de fontes</div>
          <div style="margin-top: 6px; font-size: 1.2rem; font-weight: 800;">${esc(formatRadarMetric(Array.isArray(auditoriaRadar?.fontesUtilizadas) ? auditoriaRadar.fontesUtilizadas.length : 0))}</div>
        </div>
        <div class="nh-list-item" style="grid-column: 1 / -1;">
          <div class="nh-mini">Qualidade</div>
          <div style="margin-top: 6px; font-size: 1.2rem; font-weight: 800;">${esc(formatRadarMetric(Math.round(((auditoriaRadar?.qualidade?.percentualPrioridadesComAcao ?? 0) + (auditoriaRadar?.qualidade?.percentualPrioridadesComGerente ?? 0) + (auditoriaRadar?.qualidade?.percentualObservacoesComResumo ?? 0)) / 3)))}%</div>
          <div class="nh-mini" style="margin-top: 6px;">Ações, gerente e resumo modular</div>
        </div>
      </div>
    `;
    const alteracoesHtml = alteracoesRelevantes.length ? alteracoesRelevantes.slice(0, 10).map((item) => `
      <div class="nh-list-item">
        <div class="nh-between">
          <div class="nh-badge ${badgeClass(item.severidade)}">${esc(item.modulo || '—')} · ${esc(item.severidade || '—')}</div>
          <div class="nh-mini">${esc(formatCompactDate(item.ocorridoEm))}</div>
        </div>
        <div style="margin-top: 10px; font-size: 1.02rem; font-weight: 700;">${esc(item.titulo || '—')}</div>
        <div class="nh-mini" style="margin-top: 6px;">${esc(item.descricao || '—')}</div>
        <div class="nh-mini" style="margin-top: 6px;">Gerente sugerido: ${esc(item.gerenteSugerido || '—')}</div>
        <div class="nh-mini" style="margin-top: 6px;">Impacto no radar: ${esc(item.impactoNoRadar || '—')}</div>
      </div>
    `).join('') : '<div class="nh-mini">Sem alterações relevantes na janela monitorada.</div>';
    const modulesHtml = observacoesPorModulo.length ? observacoesPorModulo.map((item) => `
      <section class="nh-card" style="padding: 16px;">
        <div class="nh-between">
          <div>
            <strong>${esc(item.modulo || '—')}</strong>
            <div class="nh-mini" style="margin-top: 4px;">${esc(item.resumo || '—')}</div>
          </div>
          <span class="nh-badge ${moduleBadgeClass(item.status)}">${esc(normalizeModuleStatus(item.status))}</span>
        </div>
        <div style="font-size: 2rem; font-weight: 800; margin-top: 10px;">${esc(formatRadarMetric(item.score))}</div>
        <div class="nh-mini" style="margin-top: 4px;">Score do módulo</div>
        <div class="nh-mini" style="margin-top: 10px;">Gerente responsável: ${esc(item.gerenteResponsavel || '—')}</div>
        <div class="nh-list" style="margin-top: 10px;">
          ${(Array.isArray(item.observacoes) ? item.observacoes : []).map((obs) => `<div class="nh-mini">• ${esc(obs)}</div>`).join('')}
        </div>
      </section>
    `).join('') : '<div class="nh-mini">Nenhuma observação modular disponível no momento.</div>';
    const penalidadesHtml = penalidades.slice(0, 5).length ? penalidades.slice(0, 5).map((item) => `
      <div class="nh-list-item">
        <div class="nh-between">
          <strong>${esc(item.origem || 'origem desconhecida')}</strong>
          <span class="nh-badge danger">-${esc(formatRadarMetric(item.pontos))}</span>
        </div>
        <div class="nh-mini" style="margin-top: 8px;">${esc(item.motivo || '—')}</div>
      </div>
    `).join('') : '<div class="nh-mini">Nenhuma penalidade crítica identificada no Score Executivo.</div>';
    const alerts = dashboard.alerts || [];
    const opportunities = dashboard.opportunities || [];
    const memories = state.memories || [];
    const executiveMemories = (state.executiveMemories || []).filter((memory) => executiveMemoryMatchesFilter(memory, state.executiveMemoriesFilter));
    const managers = state.managers || [];
    const form = state.memoryForm || {};
    const delegation = state.delegationResult || {};
    const askResult = state.askResult || {};
    const topManagers = managers;
    const executiveFacts = executiveFactsSummary(askResult.facts);
    const autoRefreshStatus = state.autoRefreshError
      ? state.autoRefreshError
      : state.autoRefreshLoading
        ? 'Atualizando radar...'
        : state.autoRefreshEnabled
          ? 'Atualização automática ativa'
          : 'Atualização automática pausada';

    container.innerHTML = `
      <section style="--nh-bg:#071129;--nh-panel:rgba(10,18,43,.82);--nh-panel-strong:rgba(8,15,35,.94);--nh-border:rgba(122,146,255,.18);--nh-text:#eaf1ff;--nh-muted:#9cb0db;--nh-accent:#7c5cff;--nh-good:#4ce38a;--nh-warn:#ffb347;--nh-bad:#ff6b6b;display:grid;gap:18px;padding:10px;color:var(--nh-text);background:radial-gradient(circle at top right, rgba(124,92,255,.24), transparent 30%), radial-gradient(circle at left center, rgba(0,212,255,.12), transparent 26%), linear-gradient(180deg, rgba(5,10,24,.98), rgba(8,14,33,.98));border:1px solid var(--nh-border);border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.35);">
        <style>
          .nh-shell { display: grid; gap: 18px; }
          .nh-card, .nh-panel, .nh-box { background: linear-gradient(180deg, rgba(12,22,48,.96), rgba(8,15,34,.92)); border: 1px solid var(--nh-border); border-radius: 20px; box-shadow: inset 0 1px 0 rgba(255,255,255,.03); }
          .nh-card { padding: 18px; }
          .nh-grid-4 { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
          .nh-grid-2 { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
          .nh-flex { display:flex; gap: 12px; }
          .nh-between { display:flex; justify-content:space-between; align-items:flex-start; gap: 12px; }
          .nh-muted { color: var(--nh-muted); }
          .nh-kpi-value { font-size: 2rem; font-weight: 700; line-height: 1.1; }
          .nh-kpi-label { font-size: .82rem; text-transform: uppercase; letter-spacing: .08em; color: var(--nh-muted); }
          .nh-kpi-delta { margin-top: 8px; color: #7bff9e; font-size: .9rem; }
          .nh-title { font-size: 2.8rem; line-height: .95; margin: 0; letter-spacing: -0.04em; }
          .nh-subtitle { margin: 6px 0 0; color: var(--nh-muted); font-size: 1rem; }
          .nh-pill { display:inline-flex; align-items:center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.04); border:1px solid var(--nh-border); color: var(--nh-muted); font-size: .84rem; }
          .nh-input, .nh-select, .nh-textarea { width:100%; box-sizing:border-box; border-radius: 16px; border: 1px solid rgba(124, 92, 255, .3); background: rgba(4, 10, 24, .85); color: var(--nh-text); padding: 14px 16px; outline: none; }
          .nh-button { border: 0; border-radius: 16px; padding: 14px 18px; color: white; background: linear-gradient(135deg, var(--nh-accent), #3f7cff); box-shadow: 0 18px 30px rgba(71, 102, 255, .24); cursor: pointer; }
          .nh-button:disabled { opacity: .65; cursor: wait; }
          .nh-section-title { margin: 0; font-size: 1.15rem; }
          .nh-section-subtitle { margin: 4px 0 0; color: var(--nh-muted); font-size: .92rem; }
          .nh-divider { border-top: 1px solid rgba(124,146,255,.12); margin: 16px 0; }
          .nh-badge { display:inline-flex; align-items:center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: .78rem; font-weight: 600; border: 1px solid transparent; }
          .nh-badge.danger { color: #ff8f8f; background: rgba(255, 91, 91, .12); border-color: rgba(255, 91, 91, .2); }
          .nh-badge.warning { color: #ffd08b; background: rgba(255, 179, 71, .12); border-color: rgba(255, 179, 71, .2); }
          .nh-badge.success { color: #85f0ad; background: rgba(76, 227, 138, .12); border-color: rgba(76, 227, 138, .2); }
          .nh-badge.muted { color: #c4d0f5; background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.08); }
          .nh-table { width:100%; border-collapse: collapse; }
          .nh-table th, .nh-table td { text-align:left; padding: 12px 10px; border-bottom: 1px solid rgba(124,146,255,.1); vertical-align: top; }
          .nh-table th { color: var(--nh-muted); font-size: .8rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
          .nh-mini { font-size: .82rem; color: var(--nh-muted); }
          .nh-scroll { max-height: 360px; overflow: auto; }
          .nh-manager-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
          .nh-manager-card { padding: 16px; border-radius: 18px; background: rgba(255,255,255,.03); border: 1px solid rgba(124,146,255,.12); display:grid; gap: 10px; }
          .nh-list { display:grid; gap: 10px; }
          .nh-list-item { padding: 14px; border-radius: 16px; border: 1px solid rgba(124,146,255,.1); background: rgba(255,255,255,.03); }
          @media (max-width: 1200px) { .nh-grid-4, .nh-manager-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .nh-grid-2 { grid-template-columns: 1fr; } .nh-title { font-size: 2.2rem; } }
          @media (max-width: 760px) { .nh-grid-4, .nh-manager-grid { grid-template-columns: 1fr; } .nh-between, .nh-flex { flex-direction: column; } }
        </style>
        <header class="nh-card nh-between">
          <div>
            <div class="nh-pill">Diretor IA <span aria-hidden="true">✦</span></div>
            <h1 class="nh-title">Diretor IA</h1>
            <p class="nh-subtitle">Seu cockpit executivo do NeuralHire</p>
          </div>
          <div class="nh-card" style="min-width: 280px; padding: 16px 18px;">
            <div class="nh-between">
              <div class="nh-mini">Última atualização</div>
              <div class="nh-mini">${esc(state.autoRefreshError ? 'warning' : 'online')}</div>
            </div>
            <div style="font-size: 1.05rem; font-weight: 600; margin-top: 6px;">${esc(formatCompactDate(health.updated_at || dashboard.updated_at || new Date()))}</div>
            <div class="nh-mini" style="margin-top: 6px;">Gerentes ativos: ${esc(formatCount(managers.filter((manager) => String(manager.status || '').toLowerCase() === 'ativo').length || managers.length || 0))}</div>
            <div class="nh-mini" style="margin-top: 8px;">${esc(autoRefreshStatus)}</div>
            <div class="nh-mini" style="margin-top: 4px;">Última atualização automática: ${esc(formatClockTime(state.lastAutoRefreshAt))}</div>
          </div>
        </header>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Radar Executivo</h2>
              <p class="nh-section-subtitle">Painel proativo com leitura consolidada do negócio.</p>
            </div>
            <span class="nh-badge ${badgeClass(scoreExecutivo.classificacao)}">${esc(normalizeClassificacao(scoreExecutivo.classificacao))}</span>
          </div>
          <div class="nh-grid-2" style="margin-top: 14px; align-items: stretch;">
            <div class="nh-card" style="padding: 22px; display:grid; gap: 12px; background: linear-gradient(180deg, rgba(124,92,255,.18), rgba(8,15,34,.96));">
              <div class="nh-mini">Score Executivo</div>
              <div style="font-size: 4rem; line-height: .9; font-weight: 800;">${esc(formatRadarMetric(scoreExecutivo.valor))}</div>
              <div class="nh-mini">Classificação: <strong>${esc(normalizeClassificacao(scoreExecutivo.classificacao))}</strong></div>
              <div style="font-size: 1rem; line-height: 1.65; color: var(--nh-text);">${esc(scoreExecutivo.diagnostico || 'Sem diagnóstico disponível.')}</div>
              <div class="nh-mini">Resumo executivo</div>
              <div style="line-height: 1.6;">${esc(radar.resumoExecutivo || 'Sem resumo executivo disponível.')}</div>
            </div>
            <div class="nh-grid-2">
              <div class="nh-card" style="padding: 18px;">
                <div class="nh-kpi-label">Alertas</div>
                <div class="nh-kpi-value">${esc(formatRadarMetric(Array.isArray(radar.alertas) ? radar.alertas.length : 0))}</div>
                <div class="nh-mini">Sinais críticos monitorados</div>
              </div>
              <div class="nh-card" style="padding: 18px;">
                <div class="nh-kpi-label">Oportunidades</div>
                <div class="nh-kpi-value">${esc(formatRadarMetric(Array.isArray(radar.oportunidades) ? radar.oportunidades.length : 0))}</div>
                <div class="nh-mini">Ganhos potenciais priorizados</div>
              </div>
              <div class="nh-card" style="padding: 18px;">
                <div class="nh-kpi-label">Prioridades</div>
                <div class="nh-kpi-value">${esc(formatRadarMetric(prioridades.length))}</div>
                <div class="nh-mini">Ações executivas recomendadas</div>
              </div>
              <div class="nh-card" style="padding: 18px;">
                <div class="nh-kpi-label">Penalidades</div>
                <div class="nh-kpi-value">${esc(formatRadarMetric(penalidades.length))}</div>
                <div class="nh-mini">Fatores que pressionam o score</div>
              </div>
            </div>
          </div>
        </article>
        <article class="nh-grid-4">
          <div class="nh-card"><div class="nh-kpi-label">Receita do mês</div><div class="nh-kpi-value">${esc(formatMoney(health.receita_mes ?? 0))}</div><div class="nh-kpi-delta">Saúde do Negócio</div></div>
          <div class="nh-card"><div class="nh-kpi-label">Pedidos do mês</div><div class="nh-kpi-value">${esc(formatCount(health.pedidos_mes ?? 0))}</div><div class="nh-kpi-delta">Fluxo operacional</div></div>
          <div class="nh-card"><div class="nh-kpi-label">Clientes ativos</div><div class="nh-kpi-value">${esc(formatCount(health.clientes_ativos ?? 0))}</div><div class="nh-kpi-delta">Base engajada</div></div>
          <div class="nh-card"><div class="nh-kpi-label">Clientes em risco</div><div class="nh-kpi-value">${esc(formatCount(health.clientes_risco ?? 0))}</div><div class="nh-kpi-delta" style="color:#ff9d7d">Monitoramento prioritário</div></div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Pergunte ao Diretor IA</h2>
              <p class="nh-section-subtitle">Faça perguntas sobre desempenho, riscos, oportunidades e decisões estratégicas.</p>
            </div>
            <div class="nh-pill">Resposta executiva em tempo real</div>
          </div>
          <div class="nh-flex" style="margin-top: 16px; align-items: end;">
            <input id="ai-director-question" class="nh-input" type="text" placeholder="Ex.: Quais clientes estão em risco e o motivo?" value="${esc(state.question)}" />
            <button id="ai-director-analyze" class="nh-button" type="button" ${state.askLoading ? 'disabled' : ''}>${state.askLoading ? 'Analisando...' : 'Analisar'}</button>
          </div>
          ${state.askError ? `<p class="nh-mini" style="color:#ff8d8d; margin-top: 10px;">${esc(state.askError)}</p>` : ''}
          <div class="nh-divider"></div>
          ${state.askResult ? `
            <div class="nh-grid-2">
              <div class="nh-box" style="padding: 16px;">
                <div class="nh-mini">Pergunta</div>
                <div style="margin-top: 6px; font-size: 1.02rem;">${esc(askResult.question)}</div>
                <div class="nh-mini" style="margin-top: 14px;">Resposta</div>
                <div style="margin-top: 6px; font-size: 1rem; line-height: 1.6;">${esc(askResult.answer)}</div>
                <div class="nh-mini" style="margin-top: 14px;">Gerentes consultados</div>
                <div style="margin-top: 6px;">${esc((askResult.consultedManagers || []).join(', ') || '—')}</div>
                ${Array.isArray(askResult.usedMemories) && askResult.usedMemories.length ? `<div class="nh-mini" style="margin-top: 14px;">Memórias usadas</div><div style="margin-top: 6px;">${esc(askResult.usedMemories.join(', '))}</div>` : ''}
              </div>
              <div class="nh-box" style="padding: 16px;">
                <div class="nh-mini">Fatos e dados técnicos (facts)</div>
                <div class="nh-list" style="margin-top: 10px;">
                  ${executiveFacts.length ? executiveFacts.map((item) => `<div class="nh-list-item"><strong>${esc(item.key)}</strong><div class="nh-mini">${esc(item.value)}</div></div>`).join('') : '<div class="nh-mini">Sem dados estruturados adicionais.</div>'}
                </div>
              </div>
            </div>
            <div class="nh-mini" style="margin-top: 14px;">Status: ${esc(askResult.status || 'answered')}</div>
            <div class="nh-mini">Resposta dos gerentes: ${(delegation.managerResponses || []).map((item) => `${esc(item.manager?.nome || '')} · ${esc(item.status || '')}`).join(' | ') || '—'}</div>
          ` : `<p id="ai-director-answer" class="nh-mini" style="margin-top: 12px;">${esc(state.answer)}</p>`}
        </article>
        <article class="nh-grid-2">
          <section class="nh-card">
            <div class="nh-between">
              <div>
                <h2 class="nh-section-title">Alertas Estratégicos</h2>
                <p class="nh-section-subtitle">Sinais críticos em observação contínua.</p>
              </div>
              <a href="#" class="nh-mini" style="color:#8ea2ff; text-decoration:none;">Ver todas</a>
            </div>
            <div class="nh-list" style="margin-top: 14px;">
              ${alerts.map((item) => `<div class="nh-list-item"><div class="nh-between"><span class="nh-badge ${severityClass(item.severity)}">${esc(item.severity || 'alerta')}</span><span class="nh-mini">${esc(formatCompactDate(item.created_at || item.criado_em))}</span></div><div style="margin-top: 10px; font-weight: 600;">${esc(item.title)}</div></div>`).join('')}
            </div>
          </section>
          <section class="nh-card">
            <div class="nh-between">
              <div>
                <h2 class="nh-section-title">Oportunidades</h2>
                <p class="nh-section-subtitle">Pontos de aceleração e expansão.</p>
              </div>
              <a href="#" class="nh-mini" style="color:#8ea2ff; text-decoration:none;">Ver todas</a>
            </div>
            <div class="nh-list" style="margin-top: 14px;">
              ${opportunities.map((item) => `<div class="nh-list-item"><div class="nh-badge success">oportunidade</div><div style="margin-top: 10px; font-weight: 600;">${esc(item.title)}</div><div class="nh-mini" style="margin-top: 6px;">${esc(item.description || item.summary || '')}</div></div>`).join('')}
            </div>
          </section>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Auditoria do Radar</h2>
              <p class="nh-section-subtitle">Sinais de higiene, rastreabilidade e consistência do radar executivo.</p>
            </div>
          </div>
          ${auditoriaHtml}
          <div class="nh-mini" style="margin-top: 10px;">Fontes: ${esc(Array.isArray(auditoriaRadar?.fontesUtilizadas) && auditoriaRadar.fontesUtilizadas.length ? auditoriaRadar.fontesUtilizadas.join(', ') : '—')}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Pilares Executivos</h2>
              <p class="nh-section-subtitle">Leitura dos quatro eixos que compõem o Score Executivo.</p>
            </div>
          </div>
          <div class="nh-grid-4" style="margin-top: 14px;">${pillarsHtml}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Prioridades Executivas</h2>
              <p class="nh-section-subtitle">Até sete iniciativas que exigem ação imediata.</p>
            </div>
          </div>
          <div class="nh-list" style="margin-top: 14px;">${prioritiesHtml || '<div class="nh-mini">Sem prioridades executivas no momento.</div>'}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Observação por Módulo</h2>
              <p class="nh-section-subtitle">Leitura contínua por domínio do negócio com base nos dados já disponíveis.</p>
            </div>
          </div>
          <div class="nh-card" style="margin-top: 14px; padding: 16px;">
            <h3 class="nh-section-title" style="font-size: 1rem;">Resumo Modular</h3>
            <p class="nh-mini" style="margin-top: 8px;">${esc(radar.resumoModular || 'Nenhum resumo modular disponível no momento.')}</p>
          </div>
          <div class="nh-grid-2" style="margin-top: 14px;">${modulesHtml}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Penalidades do Score</h2>
              <p class="nh-section-subtitle">Principais fatores que reduzem a leitura executiva.</p>
            </div>
          </div>
          <div class="nh-list" style="margin-top: 14px;">${penalidadesHtml}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Alterações Relevantes</h2>
              <p class="nh-section-subtitle">Mudanças observadas nas últimas ${esc(radar.monitoramento?.janelaHoras || 24)} horas.</p>
            </div>
          </div>
          <div class="nh-card" style="margin-top: 14px; padding: 16px;">
            <p class="nh-mini">${esc(radar.resumoAlteracoes || 'Sem alterações relevantes na janela monitorada.')}</p>
            <p class="nh-mini" style="margin-top: 6px;">Monitoramento: ${esc(formatRadarMetric(radar.monitoramento?.totalAlteracoes || 0))} alteração(ões) · gerado em ${esc(formatCompactDate(radar.monitoramento?.geradoEm))}</p>
          </div>
          <div class="nh-list" style="margin-top: 14px;">${alteracoesHtml}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Ações Sugeridas</h2>
              <p class="nh-section-subtitle">Próximos passos acionáveis derivados das prioridades do radar.</p>
            </div>
          </div>
          <div class="nh-list" style="margin-top: 14px;">${actionsHtml}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Persistência Inteligente</h2>
              <p class="nh-section-subtitle">Resumo da seleção automática de insights relevantes para a Memória Executiva.</p>
            </div>
          </div>
          <div style="margin-top: 14px;">${persistenciaHtml}</div>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Gerentes Especializados</h2>
              <p class="nh-section-subtitle">Rede de agentes operando com dados reais.</p>
            </div>
            <div class="nh-mini">Consultas sob demanda</div>
          </div>
          ${state.managersLoading ? '<p class="nh-mini" style="margin-top: 12px;">Carregando gerentes...</p>' : ''}
          <div class="nh-manager-grid" style="margin-top: 14px;">
            ${topManagers.map((manager) => {
              const consultation = state.managerConsultations?.[manager.id] || {};
              const { shown: modulesShown, rest: modulesRest } = safeSlice(manager.modulos, 3);
              const { shown: capabilitiesShown, rest: capabilitiesRest } = safeSlice(manager.capacidades, 3);
              return `
                <section data-manager-id="${esc(manager.id)}" class="nh-manager-card">
                  <div class="nh-between">
                    <div>
                      <div style="font-size: 1.05rem; font-weight: 700;">${esc(manager.nome)}</div>
                      <div class="nh-mini">${esc(manager.descricao)}</div>
                    </div>
                    <span class="nh-badge success">${esc(manager.status || 'ativo')}</span>
                  </div>
                  <div>
                    <div class="nh-mini">Módulos</div>
                    <div class="nh-mini" style="margin-top: 4px;">${esc([...modulesShown, modulesRest ? `+${modulesRest}` : null].filter(Boolean).join(' · '))}</div>
                  </div>
                  <div>
                    <div class="nh-mini">Capacidades</div>
                    <div class="nh-mini" style="margin-top: 4px;">${esc([...capabilitiesShown, capabilitiesRest ? `+${capabilitiesRest}` : null].filter(Boolean).join(' · '))}</div>
                  </div>
                  <label class="nh-mini" for="manager-question-${esc(manager.id)}">Pergunta</label>
                  <input id="manager-question-${esc(manager.id)}" class="nh-input" type="text" value="${esc(consultation.question || state.managerQuestion)}" />
                  <button class="manager-consult-button nh-button" data-manager-id="${esc(manager.id)}" type="button" style="padding: 12px 14px;">Consultar</button>
                  ${consultation.summary ? `<div class="nh-mini">Resumo: ${esc(consultation.summary)}</div>` : ''}
                  ${consultation.status ? `<div class="nh-mini">Status: ${esc(consultation.status)}</div>` : ''}
                </section>
              `;
            }).join('')}
          </div>
        </article>
        <article class="nh-grid-2">
          <section class="nh-card">
            <div class="nh-between">
              <div>
                <h2 class="nh-section-title">Memória Executiva</h2>
                <p class="nh-section-subtitle">Insights e fatos importantes identificados pela IA.</p>
              </div>
              <select id="ai-director-executive-filter" class="nh-select" style="max-width: 220px;">
                ${['all', 'comercial', 'produtos', 'auditoria', 'followup', 'administrativo', 'geral'].map((categoria) => `<option value="${categoria}"${state.executiveMemoriesFilter === categoria ? ' selected' : ''}>${categoria === 'all' ? 'Todas as categorias' : categoria}</option>`).join('')}
              </select>
            </div>
            <div class="nh-scroll" style="margin-top: 14px;">
              <table class="nh-table" data-testid="executive-memories-list">
                <thead>
                  <tr><th>Tipo</th><th>Categoria</th><th>Severidade</th><th>Título</th><th>Data</th></tr>
                </thead>
                <tbody>
                  ${executiveMemories.map((item) => `
                    <tr>
                      <td>${esc(item.tipo)}</td>
                      <td>${esc(item.categoria)}</td>
                      <td><span class="nh-badge ${severityClass(item.severidade)}">${esc(item.severidade)}</span></td>
                      <td><strong>${esc(item.titulo)}</strong><div class="nh-mini">${esc(item.descricao)}</div></td>
                      <td class="nh-mini">${esc(formatCompactDate(item.criado_em || item.created_at))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </section>
          <section class="nh-card">
            <div class="nh-between">
              <div>
                <h2 class="nh-section-title">Memória Estratégica</h2>
                <p class="nh-section-subtitle">Conhecimento armazenado manualmente.</p>
              </div>
              <span class="nh-mini">Atualização contínua</span>
            </div>
            ${state.memoryError ? `<p class="nh-mini" style="color:#ff8d8d; margin-top: 10px;">${esc(state.memoryError)}</p>` : ''}
            <div class="nh-list" style="margin-top: 14px;">
              ${memories.map((item) => `
                <div class="nh-list-item">
                  <div class="nh-between">
                    <strong>${esc(item.titulo)}</strong>
                    <span class="nh-badge ${severityClass(item.prioridade)}">${esc(item.prioridade)}</span>
                  </div>
                  <div class="nh-mini" style="margin-top: 6px;">${esc(item.tipo)} · ${esc(item.origem || 'diretor_ia')} · ${esc(formatCompactDate(item.created_at))}</div>
                  <div style="margin-top: 8px;">${esc(item.conteudo)}</div>
                </div>
              `).join('')}
            </div>
          </section>
        </article>
        <article class="nh-card">
          <div class="nh-between">
            <div>
              <h2 class="nh-section-title">Registrar memória</h2>
              <p class="nh-section-subtitle">Capture observações, diagnósticos e decisões.</p>
            </div>
          </div>
          <form id="ai-director-memory-form" style="display:grid;gap:10px;max-width:720px;margin-top: 14px;">
            <label class="nh-mini">Tipo
              <select id="ai-director-memory-tipo" class="nh-select">
                ${['observacao', 'alerta', 'oportunidade', 'diagnostico', 'decisao', 'plano_acao'].map((tipo) => `<option value="${tipo}"${form.tipo === tipo ? ' selected' : ''}>${tipo}</option>`).join('')}
              </select>
            </label>
            <label class="nh-mini">Prioridade
              <select id="ai-director-memory-prioridade" class="nh-select">
                ${['baixa', 'media', 'alta', 'critica'].map((prioridade) => `<option value="${prioridade}"${form.prioridade === prioridade ? ' selected' : ''}>${prioridade}</option>`).join('')}
              </select>
            </label>
            <label class="nh-mini" for="ai-director-memory-titulo">Título</label>
            <input id="ai-director-memory-titulo" class="nh-input" type="text" value="${esc(form.titulo)}" />
            <label class="nh-mini" for="ai-director-memory-conteudo">Conteúdo</label>
            <textarea id="ai-director-memory-conteudo" class="nh-textarea" rows="4">${esc(form.conteudo)}</textarea>
            <button id="ai-director-memory-submit" class="nh-button" type="submit" ${state.savingMemory ? 'disabled' : ''}>Registrar observação</button>
          </form>
        </article>
        <article class="nh-card nh-between">
          <div class="nh-mini">Diretor IA aprende continuamente com os dados do seu negócio para gerar insights cada vez melhores.</div>
          <div class="nh-pill">NeuralHire IA</div>
        </article>
      </section>
    `;

    const questionInput = container.querySelector('#ai-director-question');
    questionInput?.addEventListener('input', (event) => {
      state.question = event.target.value || '';
    });
    container.querySelector('#ai-director-analyze')?.addEventListener('click', async () => {
      state.question = questionInput?.value || '';
      if (!apiClient) return;
      state.askLoading = true;
      state.askError = null;
      state.askResult = null;
      render();
      try {
        const result = await askDirector(apiClient, { question: state.question });
        const fallback = classifyDelegationFallback(state.question);
        const selectedManagers = Array.isArray(result?.consultedManagers) && result.consultedManagers.length ? result.consultedManagers : fallback.managers;
        const selectedNames = managerNamesFor(selectedManagers, state.managers || []);
        state.askResult = {
          question: result?.question || state.question,
          answer: result?.answer || `O Diretor IA consultou ${selectedNames.join(' e ')} e consolidou uma resposta inicial.`,
          consultedManagers: selectedManagers,
          usedMemories: Array.isArray(result?.usedMemories) ? result.usedMemories : [],
          facts: result?.facts || {},
          status: result?.status || 'answered'
        };
        state.delegationResult = {
          question: result?.question || state.question,
          intent: fallback.intent,
          selectedManagers,
          managerResponses: Array.isArray(result?.consultedManagers) ? selectedNames.map((name) => ({ manager: { nome: name }, summary: 'Consulta concluida.', status: 'answered', sources: [] })) : []
        };
      } catch (error) {
        state.askError = 'Não foi possível consultar o Diretor IA.';
      } finally {
        state.askLoading = false;
        render();
      }
    });

    container.querySelectorAll('.manager-consult-button').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!apiClient) return;
        const managerId = button.getAttribute('data-manager-id');
        const input = container.querySelector(`[id="manager-question-${managerId}"]`);
        const question = input?.value || '';
        state.managerQuestion = question;
        state.managerConsultations = {
          ...state.managerConsultations,
          [managerId]: { ...(state.managerConsultations?.[managerId] || {}), loading: true, question }
        };
        render();
        try {
          const result = await consultManager(apiClient, managerId, { question });
          state.managerConsultations = {
            ...state.managerConsultations,
            [managerId]: { ...result, question }
          };
        } catch (error) {
          state.managerConsultations = {
            ...state.managerConsultations,
            [managerId]: { question, error: 'Não foi possível consultar o gerente.' }
          };
        } finally {
          render();
        }
      });
    });

    container.querySelector('#ai-director-executive-filter')?.addEventListener('change', async (event) => {
      state.executiveMemoriesFilter = event.target.value || 'all';
      render();
    });

    bindMemoryForm();
  };

  const load = async () => {
    state.loading = true;
    state.managersLoading = true;
    render();
    try {
      const [dashboardResult, memoriesResult, executiveMemoriesResult, managersResult] = await Promise.all([
        fetchAiDirectorDashboard(apiClient),
        listMemories(apiClient).catch(() => {
          state.memoryError = 'Não foi possível carregar as memórias.';
          return { items: [] };
        }),
        listExecutiveMemories(apiClient).catch(() => ({ items: [] })),
        listManagers(apiClient).catch(() => {
          return { managers: [] };
        })
      ]);
      state.dashboard = dashboardResult;
      state.memories = memoriesResult.items || [];
      state.executiveMemories = executiveMemoriesResult.items || [];
      state.managers = managersResult.managers || [];
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      state.managersLoading = false;
      render();
    }
  };

  function bindMemoryForm() {
    const form = container.querySelector('#ai-director-memory-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!apiClient) return;
      const payload = {
        tipo: container.querySelector('#ai-director-memory-tipo')?.value || 'observacao',
        prioridade: container.querySelector('#ai-director-memory-prioridade')?.value || 'media',
        titulo: container.querySelector('#ai-director-memory-titulo')?.value || '',
        conteudo: container.querySelector('#ai-director-memory-conteudo')?.value || ''
      };
      state.savingMemory = true;
      state.memoryError = null;
      render();
      try {
        await createMemory(apiClient, payload);
        const result = await listMemories(apiClient);
        state.memories = result.items || [];
        state.memoryForm = { tipo: 'observacao', titulo: '', conteudo: '', prioridade: 'media' };
      } catch (error) {
        state.memoryError = 'Não foi possível salvar a memória.';
      } finally {
        state.savingMemory = false;
        render();
        bindMemoryForm();
      }
    });
  }

  await load();
  bindMemoryForm();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  scheduleAutoRefresh();
  container.__aiDirectorCleanup = cleanup;
}
