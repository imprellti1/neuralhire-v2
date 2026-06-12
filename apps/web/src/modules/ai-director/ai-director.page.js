import { consultManager, createMemory, delegateQuestion, fetchAiDirectorDashboard, listManagers, listMemories } from './ai-director.service.js';
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
    const managers = state.managers || [];
    const form = state.memoryForm || {};
    const delegation = state.delegationResult || {};

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
          <h2>Gerentes Especializados</h2>
          ${state.managersLoading ? '<p>Carregando gerentes...</p>' : ''}
          <div style="display:grid;gap:14px">
            ${managers.map((manager) => {
              const consultation = state.managerConsultations?.[manager.id] || {};
              return `
                <section data-manager-id="${esc(manager.id)}" style="border:1px solid #ddd;padding:14px;border-radius:12px;display:grid;gap:10px">
                  <div>
                    <h3>${esc(manager.nome)}</h3>
                    <p>${esc(manager.descricao)}</p>
                    <p><strong>Status:</strong> ${esc(manager.status)}</p>
                  </div>
                  <div>
                    <strong>Módulos</strong>
                    <ul>${(manager.modulos || []).map((modulo) => `<li>${esc(modulo)}</li>`).join('')}</ul>
                  </div>
                  <div>
                    <strong>Capacidades</strong>
                    <ul>${(manager.capacidades || []).map((capacidade) => `<li>${esc(capacidade)}</li>`).join('')}</ul>
                  </div>
                  <label for="manager-question-${esc(manager.id)}">Pergunta</label>
                  <input id="manager-question-${esc(manager.id)}" type="text" value="${esc(consultation.question || state.managerQuestion)}" />
                  <button class="manager-consult-button" data-manager-id="${esc(manager.id)}" type="button">Consultar</button>
                  ${consultation.summary ? `<div><strong>Resumo:</strong> <p>${esc(consultation.summary)}</p></div>` : ''}
                  ${consultation.status ? `<div><strong>Status:</strong> <p>${esc(consultation.status)}</p></div>` : ''}
                  ${Array.isArray(consultation.sources) ? `<div><strong>Fontes:</strong> <p>${esc(consultation.sources.join(', '))}</p></div>` : ''}
                </section>
              `;
            }).join('')}
          </div>
        </article>
        <article>
          <h2>Pergunte ao Diretor</h2>
          <label for="ai-director-question">Pergunta</label>
          <input id="ai-director-question" type="text" value="${esc(state.question)}" />
          <button id="ai-director-analyze" type="button" ${state.delegationLoading ? 'disabled' : ''}>Analisar</button>
          ${state.delegationError ? `<p>${esc(state.delegationError)}</p>` : ''}
          ${state.delegationResult ? `
            <div data-testid="delegation-result" style="display:grid;gap:8px">
              <p><strong>Pergunta:</strong> ${esc(delegation.question)}</p>
              <p><strong>Intenção:</strong> ${esc(delegation.intent)}</p>
              <p><strong>Gerentes consultados:</strong> ${esc((delegation.selectedManagers || []).join(', '))}</p>
              <p><strong>Resumo consolidado:</strong> ${esc(delegation.summary)}</p>
              <p><strong>Status:</strong> ${esc(delegation.status)}</p>
              <div>
                <strong>Respostas dos gerentes</strong>
                <ul>
                  ${(delegation.managerResponses || []).map((item) => `<li><strong>${esc(item.manager?.nome || '')}</strong>: ${esc(item.summary)} <span>${esc(item.status)}</span><div>Fontes: ${esc((item.sources || []).join(', '))}</div></li>`).join('')}
                </ul>
              </div>
            </div>
          ` : `<p id="ai-director-answer">${esc(state.answer)}</p>`}
        </article>
      </section>
    `;

    const questionInput = container.querySelector('#ai-director-question');
    container.querySelector('#ai-director-analyze')?.addEventListener('click', async () => {
      state.question = questionInput?.value || '';
      if (!apiClient) return;
      state.delegationLoading = true;
      state.delegationError = null;
      state.delegationResult = null;
      render();
      try {
        const result = await delegateQuestion(apiClient, { question: state.question });
        const fallback = classifyDelegationFallback(state.question);
        const selectedManagers = Array.isArray(result?.selectedManagers) && result.selectedManagers.length ? result.selectedManagers : fallback.managers;
        const selectedNames = managerNamesFor(selectedManagers, state.managers || []);
        state.delegationResult = {
          question: result?.question || state.question,
          intent: result?.intent || fallback.intent,
          selectedManagers,
          managerResponses: Array.isArray(result?.managerResponses) ? result.managerResponses : [],
          summary: result?.summary || `O Diretor IA consultou ${selectedNames.join(' e ')} e consolidou uma resposta inicial.`,
          status: result?.status || 'delegated'
        };
      } catch (error) {
        state.delegationError = 'Não foi possível consultar o Diretor IA.';
      } finally {
        state.delegationLoading = false;
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

    bindMemoryForm();
  };

  const load = async () => {
    state.loading = true;
    state.managersLoading = true;
    render();
    try {
      const [dashboardResult, memoriesResult, managersResult] = await Promise.all([
        fetchAiDirectorDashboard(apiClient),
        listMemories(apiClient).catch((error) => {
          state.memoryError = 'Não foi possível carregar as memórias.';
          return { items: [] };
        }),
        listManagers(apiClient).catch(() => {
          return { managers: [] };
        })
      ]);
      state.dashboard = dashboardResult;
      state.memories = memoriesResult.items || [];
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
}
