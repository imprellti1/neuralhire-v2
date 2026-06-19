import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAiDirectorPage } from './ai-director.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

function createApiClient({ dashboards = [], askResult = {}, managers = [], memories = [], executiveMemories = [], observations = [], tasks = [], consultResult = {}, updateTaskResult = {}, completeTaskResult = {} } = {}) {
  const calls = [];
  let dashboardCall = 0;
  return {
    calls,
    apiClient: {
      get: async (url) => {
        if (url === '/ai-director/dashboard') {
          const result = dashboards[Math.min(dashboardCall, dashboards.length - 1)] || {};
          dashboardCall += 1;
          if (result instanceof Error) throw result;
          return result;
        }
        if (url === '/ai-director/memories') return { items: memories };
        if (url === '/ai-director/executive-memories') return { items: executiveMemories };
        if (url === '/ai-director/observations') return { items: observations };
        if (url === '/ai-director/tasks') return { items: tasks };
        if (url === '/ai-director/managers') return { managers };
        return {};
      },
      post: async (url, payload) => {
        calls.push({ url, payload });
        if (url === '/ai-director/ask') return askResult;
        if (url.startsWith('/ai-director/managers/') && url.endsWith('/consult')) return consultResult;
        return { item: { id: '2', ...payload } };
      },
      patch: async (url, payload) => {
        calls.push({ url, payload });
        if (url.endsWith('/complete')) return completeTaskResult || { item: { id: url.split('/')[3], status: 'done', cycleClosed: true } };
        if (url.startsWith('/ai-director/tasks/')) return updateTaskResult || { item: { id: url.split('/')[3], status: payload.status } };
        return {};
      }
    }
  };
}

function installIntervalHarness() {
  const timers = [];
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setInterval = (callback, delay) => {
    const timer = { callback, delay, active: true };
    timers.push(timer);
    return timer;
  };
  global.clearInterval = (timer) => {
    if (timer) timer.active = false;
  };
  return {
    timers,
    async tick(index = 0) {
      const timer = timers[index];
      if (!timer || !timer.active) return;
      await timer.callback();
    },
    restore() {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  };
}

async function waitForText(pattern, attempts = 10) {
  for (let index = 0; index < attempts; index += 1) {
    if (pattern.test(document.body.textContent)) return true;
    await flush();
  }
  return pattern.test(document.body.textContent);
}

test('ai director page dom with radar and auto refresh', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  const intervalHarness = installIntervalHarness();
  const { apiClient, calls } = createApiClient({
    dashboards: [
      {
        health: {
          receita_mes: 124550,
          pedidos_mes: 358,
          clientes_ativos: 78,
          clientes_risco: 15
        },
        alerts: [{ severity: 'high', title: 'Faturamento caiu 18% nos últimos 15 dias' }],
        opportunities: [{ title: '12 clientes demonstraram intenção de compra' }],
        radar: {
          resumoExecutivo: 'Receita estável, risco comercial em alta e oportunidade em produtos.',
          resumoModular: '4 módulos observados. 2 saudáveis, 1 em atenção e 1 crítico. O principal ponto de atenção está no módulo Comercial.',
          auditoria: {
            versao: '2.1',
            geradoEm: '2026-06-12T15:10:00.000Z',
            tempoGeracaoMs: 43,
            fontesUtilizadas: ['dashboard', 'executive_memories', 'managers'],
            consistencia: { scoreValido: true, prioridadesValidas: true, acoesValidas: true, limitesRespeitados: true },
            qualidade: { percentualPrioridadesComAcao: 100, percentualPrioridadesComGerente: 50, percentualObservacoesComResumo: 100 }
          },
          alertas: [{ id: 'a1' }, { id: 'a2' }],
          oportunidades: [{ id: 'o1' }],
          observacoesPorModulo: [
            { modulo: 'Comercial', status: 'atencao', score: 74, resumo: 'Clientes em risco exigem monitoramento.', observacoes: ['Clientes ativos: 78'], gerenteResponsavel: 'Gerente Comercial' },
            { modulo: 'Produtos', status: 'saudavel', score: 92, resumo: 'Catálogo sem pendências relevantes.', observacoes: ['Produtos totais: 24'], gerenteResponsavel: 'Gerente de Produtos' },
            { modulo: 'Follow-up', status: 'critico', score: 48, resumo: 'Clientes em risco exigem ação imediata.', observacoes: ['Oportunidades comerciais: 1'], gerenteResponsavel: 'Gerente de Follow-up' },
            { modulo: 'Inteligência', status: 'saudavel', score: 88, resumo: 'Radar estratégico possui cobertura adequada.', observacoes: ['Memórias executivas críticas: 1'], gerenteResponsavel: 'Diretor IA' }
          ],
          prioridades: [
            { ordem: 1, titulo: 'Recuperar carteira em risco', impacto: 'alto', urgencia: 'alta', motivo: 'Clientes-chave reduziram recompra.', acaoRecomendada: 'Priorizar contato comercial nas 24h', gerenteSugerido: 'Gerente Comercial', peso: 95 },
            { ordem: 2, titulo: 'Ajustar promoções', impacto: 'medio', urgencia: 'media', motivo: 'Promoções pouco aderentes.', acaoRecomendada: 'Rever calendário promocional', peso: 78 }
          ],
          orquestracaoGerentes: {
            totalOrquestracoes: 1,
            resumo: '1 alterações relevantes foram associadas a gerentes. A principal atuação sugerida é do Gerente Comercial para revisar clientes importados recentemente.',
            orquestracoes: [
              {
                modulo: 'clientes',
                alteracaoTipo: 'novo_registro',
                gerente: 'Gerente Comercial',
                gerenteId: 'comercial',
                prioridade: 'alta',
                acao: 'Revisar segmentação dos clientes importados e validar oportunidades de ativação.',
                justificativa: 'Importação em massa exige revisão.',
                status: 'sugerida',
                origemAlteracao: 'Pode alterar carteira, risco comercial e oportunidades de follow-up.'
              }
            ]
          },
          alteracoesRelevantes: [
            { modulo: 'clientes', tipo: 'novo_registro', titulo: '552 clientes importados recentemente', descricao: 'Foram detectados novos clientes criados após a última janela observada.', severidade: 'media', ocorridoEm: '2026-06-12T19:20:00Z', gerenteSugerido: 'Gerente Comercial', impactoNoRadar: 'Pode alterar carteira, risco comercial e oportunidades de follow-up.' }
          ],
          resumoAlteracoes: 'Foram detectadas 1 alterações relevantes desde a última observação. O principal impacto está em Clientes.',
          monitoramento: { janelaHoras: 24, geradoEm: '2026-06-12T19:21:00Z', totalAlteracoes: 1 },
          persistenciaInsights: { candidatos: 12, persistidos: 3, ignorados: 9 },
          scoreExecutivo: {
            valor: 82,
            classificacao: 'Boa',
            diagnostico: 'O negócio está saudável, mas o risco comercial pressiona a estabilidade.',
            pilares: {
              comercial: { valor: 77, status: 'atencao', fatores: ['Clientes em risco', 'Queda de recompra'] },
              operacional: { valor: 88, status: 'bom', fatores: ['Pedidos estáveis', 'Fila controlada'] },
              produtos: { valor: 81, status: 'excelente', fatores: ['Mix saudável', 'Promoções ativas'] },
              inteligencia: { valor: 74, status: 'critico', fatores: ['Sinais de churn', 'Baixa conversão'] }
            },
            penalidades: [
              { origem: 'Carteira', pontos: 9, motivo: 'Aumento de clientes em risco.' },
              { origem: 'Promoções', pontos: 5, motivo: 'Aderência abaixo do esperado.' }
            ]
          },
          acoesSugeridas: [
            { ordem: 1, titulo: 'Recuperar carteira em risco', descricao: 'Priorizar contato comercial nas 24h', tipo: 'comercial', prioridade: 'alta', origem: 'clientes', gerenteSugerido: 'Gerente Comercial', prazoSugerido: 'hoje', criterioConclusao: 'Plano comercial definido e clientes priorizados para contato.' },
            { ordem: 2, titulo: 'Ajustar promoções', descricao: 'Rever calendário promocional', tipo: 'produtos', prioridade: 'media', origem: 'produtos', gerenteSugerido: null, prazoSugerido: 'esta_semana', criterioConclusao: 'Produtos com pendências revisados e correções planejadas.' }
          ]
        }
      },
      {
        health: {
          receita_mes: 130000,
          pedidos_mes: 401,
          clientes_ativos: 80,
          clientes_risco: 12
        },
        alerts: [{ severity: 'medium', title: 'Novo alerta de acompanhamento' }],
        opportunities: [{ title: 'Expansão em carteira prioritária' }],
        radar: {
          resumoExecutivo: 'Radar atualizado com melhora na base ativa.',
          resumoModular: 'Atualização automática do radar executada com sucesso.',
          auditoria: {
            versao: '2.2',
            geradoEm: '2026-06-12T15:11:00.000Z',
            tempoGeracaoMs: 41,
            fontesUtilizadas: ['dashboard', 'executive_memories', 'managers'],
            consistencia: { scoreValido: true, prioridadesValidas: true, acoesValidas: true, limitesRespeitados: true },
            qualidade: { percentualPrioridadesComAcao: 100, percentualPrioridadesComGerente: 50, percentualObservacoesComResumo: 100 }
          },
          alertas: [{ id: 'a3' }],
          oportunidades: [{ id: 'o2' }],
          observacoesPorModulo: [
            { modulo: 'Comercial', status: 'atencao', score: 79, resumo: 'Melhora observada após atualização.', observacoes: ['Clientes ativos: 80'], gerenteResponsavel: 'Gerente Comercial' }
          ],
          prioridades: [
            { ordem: 1, titulo: 'Recuperar carteira em risco', impacto: 'alto', urgencia: 'alta', motivo: 'Clientes-chave reduziram recompra.', acaoRecomendada: 'Priorizar contato comercial nas 24h', gerenteSugerido: 'Gerente Comercial', peso: 95 }
          ],
          orquestracaoGerentes: { totalOrquestracoes: 0, resumo: 'Sem orquestrações pendentes.', orquestracoes: [] },
          persistenciaInsights: { candidatos: 13, persistidos: 4, ignorados: 9 },
          scoreExecutivo: {
            valor: 84,
            classificacao: 'Boa',
            diagnostico: 'Radar atualizado com melhora consistente.',
            pilares: {
              comercial: { valor: 79, status: 'atencao', fatores: ['Clientes em risco', 'Queda de recompra'] }
            },
            penalidades: []
          },
          acoesSugeridas: []
        }
      }
    ],
    managers: [
      { id: 'comercial', nome: 'Gerente Comercial', descricao: 'Especialista em carteira, pedidos, pipeline e leitura de receita.', modulos: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue'], capacidades: ['analisar carteira de clientes'], status: 'ativo' }
    ],
    memories: [
      { id: '1', tipo: 'observacao', prioridade: 'alta', titulo: 'Clientes em risco aumentando', conteudo: 'O número de clientes em risco cresceu.', origem: 'diretor_ia', created_at: '2026-06-12T10:00:00.000Z' }
    ],
    executiveMemories: [
      { id: 'e1', tipo: 'risk', categoria: 'comercial', severidade: 'alta', titulo: 'Aumento de clientes em risco', descricao: 'A carteira mostra crescimento no risco.', criado_em: '2026-06-12T11:00:00.000Z' }
    ],
    observations: [
      { id: 'o1', manager_id: 'comercial', manager_name: 'Gerente Comercial', category: 'comercial', title: 'Queda de pipeline', description: 'Pipeline caiu.', severity: 'high', status: 'open', created_at: '2026-06-12T12:00:00.000Z' }
    ],
    tasks: [
      { id: 't1', [['account', 'id'].join('_')]: 'acc-a', action_plan_id: 'plan-1', manager_id: 'comercial', manager_name: 'Gerente Comercial', category: 'comercial', title: 'Contato carteira', description: 'Ligar para clientes em risco', priority: 'high', status: 'open', due_at: '2026-06-11T12:00:00.000Z', created_at: '2026-06-10T12:00:00.000Z', updated_at: '2026-06-10T12:00:00.000Z' },
      { id: 't2', [['account', 'id'].join('_')]: 'acc-a', action_plan_id: 'plan-2', manager_id: 'produtos', manager_name: 'Gerente de Produtos', category: 'produtos', title: 'Revisar promoções', description: 'Ajustar campanhas', priority: 'medium', status: 'done', due_at: '2026-06-20T12:00:00.000Z', created_at: '2026-06-10T12:00:00.000Z', updated_at: '2026-06-10T12:00:00.000Z' }
    ],
    askResult: {
      question: 'Por que o faturamento caiu?',
      answer: 'O faturamento caiu por redução no volume e queda em clientes em risco.',
      consultedManagers: ['comercial'],
      usedMemories: ['1'],
      facts: { health: { receita_mes: 124550, pedidos_mes: 358 } },
      status: 'answered'
    },
    consultResult: { manager: { id: 'comercial', nome: 'Gerente Comercial' }, question: 'Quais clientes estão em risco?', summary: 'Consulta recebida pelo Gerente Comercial.', status: 'mocked', sources: ['Clientes'] },
    completeTaskResult: { cycleClosed: true, item: { id: 't1', status: 'done', cycleClosed: true } }
  });

  await renderAiDirectorPage(document.body, { apiClient });
  await flush();

  assert.match(document.body.textContent, /Atualização automática ativa/);
  assert.match(document.body.textContent, /Última atualização automática:/);
  assert.match(document.body.textContent, /Radar Executivo/);
  assert.match(document.body.textContent, /Score Executivo/);
  assert.match(document.body.textContent, /O negócio está saudável, mas o risco comercial pressiona a estabilidade\./);
  assert.match(document.body.textContent, /Alterações Relevantes/);
  assert.match(document.body.textContent, /Observações dos Gerentes/);
  assert.match(document.body.textContent, /Queda de pipeline/);
  assert.match(document.body.textContent, /Orquestração dos Gerentes/);
  assert.match(document.body.textContent, /Central de Tarefas/);
  assert.match(document.body.textContent, /Abertas/);
  assert.match(document.body.textContent, /Atrasadas/);
  assert.match(document.body.textContent, /Contato carteira/);
  assert.match(document.body.textContent, /atrasada/);
  assert.match(document.body.textContent, /1 alterações relevantes foram associadas a gerentes/);
  assert.match(document.body.textContent, /552 clientes importados recentemente/);
  assert.match(document.body.textContent, /Gerente Comercial/);
  assert.match(document.body.textContent, /Revisar segmentação dos clientes importados/);
  assert.match(document.body.textContent, /Pode alterar carteira, risco comercial e oportunidades de follow-up\./);

  const questionInput = document.querySelector('#ai-director-question');
  questionInput.value = 'Pergunta em andamento';
  questionInput.dispatchEvent(new window.Event('input', { bubbles: true }));

  await intervalHarness.tick(0);
  await flush();

  assert.match(document.body.textContent, /Radar atualizado com melhora na base ativa\./);
  assert.match(document.body.textContent, /Atualização automática ativa/);
  assert.equal(document.querySelector('#ai-director-question').value, 'Pergunta em andamento');
  assert.ok(calls.length === 0);

  document.querySelector('#ai-director-analyze').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  await flush();
  assert.match(document.body.textContent, /O faturamento caiu por redução no volume/);

  document.querySelector('#ai-director-tasks-status').value = 'open';
  document.querySelector('#ai-director-tasks-status').dispatchEvent(new window.Event('change', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /Contato carteira/);
  const completeButton = document.querySelector('[data-task-id="t1"].task-complete-button');
  completeButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.ok(calls.some((call) => call.url === '/ai-director/tasks/t1/complete'));
  assert.ok(await waitForText(/Tarefa concluída e ciclo encerrado automaticamente\./));
  assert.equal(document.querySelector('[data-task-id="t2"] .task-complete-button'), null);

  intervalHarness.restore();
  document.body.__aiDirectorCleanup?.();
  teardownFrontendDom(dom);
});

test('ai director page dom without radar fallback and auto refresh error', async () => {
  const dom = setupFrontendDom('#/diretor-ia-fallback');
  const intervalHarness = installIntervalHarness();
  const { apiClient } = createApiClient({
    dashboards: [
      {
        health: {
          receita_mes: 1000,
          pedidos_mes: 2,
          clientes_ativos: 1,
          clientes_risco: 0
        },
        alerts: [],
        opportunities: []
      },
      new Error('poll fail')
    ],
    managers: [],
    memories: [],
    executiveMemories: []
  });

  await renderAiDirectorPage(document.body, { apiClient });
  await flush();

  assert.match(document.body.textContent, /Radar Executivo/);
  assert.match(document.body.textContent, /Sem diagnóstico disponível/);
  assert.match(document.body.textContent, /Sem resumo executivo disponível/);
  assert.match(document.body.textContent, /Nenhuma penalidade crítica identificada no Score Executivo\./);
  assert.match(document.body.textContent, /Sem ações sugeridas no momento\./);
  assert.match(document.body.textContent, /Sem alterações relevantes na janela monitorada\./);
  assert.match(document.body.textContent, /Sem orquestrações pendentes\./);
  assert.match(document.body.textContent, /Central de Tarefas/);
  assert.match(document.body.textContent, /Atualização automática ativa/);

  await intervalHarness.tick(0);
  await flush();

  assert.match(document.body.textContent, /Falha ao atualizar radar automaticamente/);
  assert.match(document.body.textContent, /Radar Executivo/);
  assert.match(document.body.textContent, /Pergunte ao Diretor IA/);

  intervalHarness.restore();
  document.body.__aiDirectorCleanup?.();
  teardownFrontendDom(dom);
});
