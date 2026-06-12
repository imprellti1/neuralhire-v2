import { fetchAiDirectorDashboard } from './ai-director.service.js';
import { createAiDirectorState } from './ai-director.state.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export async function renderAiDirectorPage(container, { apiClient } = {}) {
  const state = createAiDirectorState();

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
    const alerts = dashboard.alerts || [];
    const opportunities = dashboard.opportunities || [];

    container.innerHTML = `
      <section style="display:grid;gap:20px">
        <header>
          <h1>Diretor IA</h1>
          <p>Painel executivo de observação do negócio.</p>
        </header>
        <article>
          <h2>Saúde do Negócio</h2>
          <div data-testid="health-grid" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
            <div><strong>Receita do mês</strong><div>${esc(health.receita_mes ?? 0)}</div></div>
            <div><strong>Pedidos do mês</strong><div>${esc(health.pedidos_mes ?? 0)}</div></div>
            <div><strong>Clientes ativos</strong><div>${esc(health.clientes_ativos ?? 0)}</div></div>
            <div><strong>Clientes em risco</strong><div>${esc(health.clientes_risco ?? 0)}</div></div>
          </div>
        </article>
        <article>
          <h2>Alertas Estratégicos</h2>
          <ul>${alerts.map((item) => `<li><strong>${esc(item.severity)}</strong>: ${esc(item.title)}</li>`).join('')}</ul>
        </article>
        <article>
          <h2>Oportunidades</h2>
          <ul>${opportunities.map((item) => `<li>${esc(item.title)}</li>`).join('')}</ul>
        </article>
        <article>
          <h2>Pergunte ao Diretor</h2>
          <label for="ai-director-question">Pergunta</label>
          <input id="ai-director-question" type="text" value="${esc(state.question)}" />
          <button id="ai-director-analyze" type="button">Analisar</button>
          <p id="ai-director-answer">${esc(state.answer)}</p>
        </article>
      </section>
    `;

    const questionInput = container.querySelector('#ai-director-question');
    const answer = container.querySelector('#ai-director-answer');
    container.querySelector('#ai-director-analyze')?.addEventListener('click', () => {
      state.question = questionInput?.value || '';
      if (answer) answer.textContent = 'Módulo de perguntas será ativado na ETAPA 5.';
    });
  };

  const load = async () => {
    state.loading = true;
    render();
    try {
      state.dashboard = await fetchAiDirectorDashboard(apiClient);
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      render();
    }
  };

  await load();
}
