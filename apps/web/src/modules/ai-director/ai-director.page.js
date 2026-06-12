import { createMemory, fetchAiDirectorDashboard, listMemories } from './ai-director.service.js';
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
    const memories = state.memories || [];
    const form = state.memoryForm || {};

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
          <h2>Memória Estratégica</h2>
          ${state.memoryError ? `<p>${esc(state.memoryError)}</p>` : ''}
          <ul>${memories.map((item) => `<li><strong>${esc(item.tipo)}</strong> <span>${esc(item.prioridade)}</span> <strong>${esc(item.titulo)}</strong><p>${esc(item.conteudo)}</p><small>${esc(item.origem || 'diretor_ia')} - ${esc(item.created_at || '')}</small></li>`).join('')}</ul>
          <form id="ai-director-memory-form" style="display:grid;gap:10px;max-width:640px">
            <label>Tipo
              <select id="ai-director-memory-tipo">
                ${['observacao', 'alerta', 'oportunidade', 'diagnostico', 'decisao', 'plano_acao'].map((tipo) => `<option value="${tipo}"${form.tipo === tipo ? ' selected' : ''}>${tipo}</option>`).join('')}
              </select>
            </label>
            <label>Prioridade
              <select id="ai-director-memory-prioridade">
                ${['baixa', 'media', 'alta', 'critica'].map((prioridade) => `<option value="${prioridade}"${form.prioridade === prioridade ? ' selected' : ''}>${prioridade}</option>`).join('')}
              </select>
            </label>
            <label for="ai-director-memory-titulo">Título</label>
            <input id="ai-director-memory-titulo" type="text" value="${esc(form.titulo)}" />
            <label for="ai-director-memory-conteudo">Conteúdo</label>
            <textarea id="ai-director-memory-conteudo" rows="4">${esc(form.conteudo)}</textarea>
            <button id="ai-director-memory-submit" type="submit" ${state.savingMemory ? 'disabled' : ''}>Registrar observação</button>
          </form>
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
      const [dashboardResult, memoriesResult] = await Promise.all([
        fetchAiDirectorDashboard(apiClient),
        listMemories(apiClient).catch((error) => {
          state.memoryError = 'Não foi possível carregar as memórias.';
          return { items: [] };
        })
      ]);
      state.dashboard = dashboardResult;
      state.memories = memoriesResult.items || [];
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      render();
    }
  };

  const bindMemoryForm = () => {
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
  };

  await load();
  bindMemoryForm();
}
