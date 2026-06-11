import { archiveAiDirectorEvent, createAiDirectorEvent, getAiDirectorAgents, getAiDirectorEvents, getAiDirectorOverview, getAiDirectorRecommendations, markAiDirectorEventRead } from './ai-director.service.js';
import { createAiDirectorState } from './ai-director.state.js';

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

export async function renderAiDirectorPage(container, { apiClient } = {}) {
  const state = createAiDirectorState();
  const render = () => {
    if (state.loading) { container.innerHTML = '<section><h1>Diretor IA</h1><p>Carregando...</p></section>'; return; }
    if (state.error) { container.innerHTML = '<section><h1>Diretor IA</h1><p>Erro ao carregar</p></section>'; return; }
    const overview = state.overview || {};
    const agents = state.agents || [];
    const events = state.events || [];
    const recommendations = state.recommendations || [];
    container.innerHTML = `<section style="display:grid;gap:18px">
      <header><h1>Diretor IA</h1><p>Central de inteligência e observação do NeuralHire</p></header>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
        ${[
          ['Gerentes ativos', (overview.gerentes || []).filter((item) => item.status === 'ativo').length],
          ['Eventos novos', (overview.contadoresPorStatus || {}).novo || 0],
          ['Recomendações pendentes', (overview.recomendacoesPendentes || []).length],
          ['Alertas críticos', (overview.contadoresPorCriticidade || {}).critica || 0]
        ].map(([label, value]) => `<article style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px"><div style="font-size:12px;color:#61708f">${label}</div><div style="font-size:28px;font-weight:700">${esc(value)}</div></article>`).join('')}
      </div>
      <article><h2>Agora no sistema</h2><div>${events.map((item) => `<div style="border:1px solid #e5ecf7;border-radius:12px;padding:12px;margin:0 0 10px 0"><strong>${esc(item.titulo)}</strong><div>${esc(item.resumo)}</div><div>${esc(item.origem)} | ${esc(item.criticidade)} | ${esc(item.status)} | ${esc(item.criado_em)}</div></div>`).join('') || '<p>Sem eventos</p>'}</div></article>
      <article><h2>Gerentes IA</h2><div>${agents.map((item) => `<div style="border:1px solid #e5ecf7;border-radius:12px;padding:12px;margin:0 0 10px 0"><strong>${esc(item.nome)}</strong><div>${esc(item.funcao)}</div><div>${esc(item.escopo)} | ${esc(item.status)} | ${esc(item.nivel_autonomia)}</div></div>`).join('')}</div></article>
      <article><h2>Recomendações do Diretor</h2><div>${recommendations.filter((item) => item.status === 'pendente').map((item) => `<div style="border:1px solid #e5ecf7;border-radius:12px;padding:12px;margin:0 0 10px 0"><strong>${esc(item.titulo)}</strong><div>${esc(item.descricao)}</div><div>${esc(item.gerente_origem)} | ${esc(item.prioridade)}</div></div>`).join('') || '<p>Sem recomendações pendentes</p>'}</div></article>
    </section>`;
  };
  const load = async () => {
    state.loading = true; render();
    try {
      const [overview, agents, events, recommendations] = await Promise.all([
        getAiDirectorOverview(apiClient),
        getAiDirectorAgents(apiClient),
        getAiDirectorEvents(apiClient),
        getAiDirectorRecommendations(apiClient)
      ]);
      state.overview = overview;
      state.agents = agents.gerentes || agents.items || [];
      state.events = events.items || [];
      state.recommendations = recommendations.items || [];
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      render();
    }
  };
  await load();
}
