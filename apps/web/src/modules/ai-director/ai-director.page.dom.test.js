import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAiDirectorPage } from './ai-director.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

function createApiClient({ dashboard, askResult = {}, managers = [], memories = [], executiveMemories = [], consultResult = {} } = {}) {
  const calls = [];
  return {
    calls,
    apiClient: {
      get: async (url) => {
        if (url === '/ai-director/dashboard') return dashboard;
        if (url === '/ai-director/memories') return { items: memories };
        if (url === '/ai-director/executive-memories') return { items: executiveMemories };
        if (url === '/ai-director/managers') return { managers };
        return {};
      },
      post: async (url, payload) => {
        calls.push({ url, payload });
        if (url === '/ai-director/ask') return askResult;
        if (url.startsWith('/ai-director/managers/') && url.endsWith('/consult')) return consultResult;
        return { item: { id: '2', ...payload } };
      }
    }
  };
}

test('ai director page dom with radar', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  const { apiClient, calls } = createApiClient({
      dashboard: {
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
        }
        ,
        acoesSugeridas: [
          { ordem: 1, titulo: 'Recuperar carteira em risco', descricao: 'Priorizar contato comercial nas 24h', tipo: 'comercial', prioridade: 'alta', origem: 'clientes', gerenteSugerido: 'Gerente Comercial', prazoSugerido: 'hoje', criterioConclusao: 'Plano comercial definido e clientes priorizados para contato.' },
          { ordem: 2, titulo: 'Ajustar promoções', descricao: 'Rever calendário promocional', tipo: 'produtos', prioridade: 'media', origem: 'produtos', gerenteSugerido: null, prazoSugerido: 'esta_semana', criterioConclusao: 'Produtos com pendências revisados e correções planejadas.' }
        ]
      }
    },
    managers: [
      { id: 'comercial', nome: 'Gerente Comercial', descricao: 'Especialista em carteira, pedidos, pipeline e leitura de receita.', modulos: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue'], capacidades: ['analisar carteira de clientes'], status: 'ativo' }
    ],
    memories: [
      { id: '1', tipo: 'observacao', prioridade: 'alta', titulo: 'Clientes em risco aumentando', conteudo: 'O número de clientes em risco cresceu.', origem: 'diretor_ia', created_at: '2026-06-12T10:00:00.000Z' }
    ],
    executiveMemories: [
      { id: 'e1', tipo: 'risk', categoria: 'comercial', severidade: 'alta', titulo: 'Aumento de clientes em risco', descricao: 'A carteira mostra crescimento no risco.', criado_em: '2026-06-12T11:00:00.000Z' },
      { id: 'e2', tipo: 'opportunity', categoria: 'produtos', severidade: 'media', titulo: 'Maior utilização de promoções', descricao: 'Promoções ativas cresceram.', criado_em: '2026-06-12T12:00:00.000Z' }
    ],
    askResult: {
      question: 'Por que o faturamento caiu?',
      answer: 'O faturamento caiu por redução no volume e queda em clientes em risco.',
      consultedManagers: ['comercial', 'followup'],
      usedMemories: ['1'],
      facts: {
        health: { receita_mes: 124550, pedidos_mes: 358 },
        managerFacts: [
          { managerId: 'comercial', summary: 'Dados reais consolidados', provider: 'real', facts: { receita_mes: 124550, pedidos_mes: 358, clientes_risco: 15 } }
        ]
      },
      status: 'answered'
    },
    consultResult: {
      manager: { id: 'comercial', nome: 'Gerente Comercial' },
      question: 'Quais clientes estão em risco?',
      summary: 'Consulta recebida pelo Gerente Comercial.',
      status: 'mocked',
      sources: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue']
    }
  });

  await renderAiDirectorPage(document.body, { apiClient });
  await flush();

  assert.match(document.body.textContent, /Radar Executivo/);
  assert.match(document.body.textContent, /Score Executivo/);
  assert.match(document.body.textContent, /O negócio está saudável, mas o risco comercial pressiona a estabilidade\./);
  assert.match(document.body.textContent, /Receita estável, risco comercial em alta e oportunidade em produtos\./);
  assert.match(document.body.textContent, /Pilares Executivos/);
  assert.match(document.body.textContent, /Prioridades Executivas/);
  assert.match(document.body.textContent, /Observação por Módulo/);
  assert.match(document.body.textContent, /Resumo Modular/);
  assert.match(document.body.textContent, /Comercial/);
  assert.match(document.body.textContent, /Produtos/);
  assert.match(document.body.textContent, /Follow-up/);
  assert.match(document.body.textContent, /Inteligência/);
  assert.match(document.body.textContent, /Gerente responsável/);
  assert.match(document.body.textContent, /Ação recomendada: Priorizar contato comercial nas 24h/);
  assert.match(document.body.textContent, /Gerente sugerido: Gerente Comercial/);
  assert.match(document.body.textContent, /Penalidades do Score/);
  assert.match(document.body.textContent, /Ações Sugeridas/);
  assert.match(document.body.textContent, /Recuperar carteira em risco/);
  assert.match(document.body.textContent, /hoje/);
  assert.match(document.body.textContent, /Plano comercial definido e clientes priorizados para contato\./);
  assert.match(document.body.textContent, /Nenhuma penalidade critical|Carteira/);
  assert.match(document.body.textContent, /Pergunte ao Diretor IA/);
  assert.match(document.body.textContent, /Memória Executiva/);

  document.querySelector('#ai-director-question').value = 'Por que o faturamento caiu?';
  document.querySelector('#ai-director-analyze').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  await flush();

  assert.match(document.body.textContent, /O faturamento caiu por redução no volume/);
  assert.match(document.body.textContent, /comercial, followup/);
  assert.match(document.body.textContent, /answered/);
  assert.match(document.body.textContent, /clientes_risco/);

  document.querySelector('#ai-director-executive-filter').value = 'produtos';
  document.querySelector('#ai-director-executive-filter').dispatchEvent(new window.Event('change', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /Maior utilização de promoções/);

  document.querySelector('[data-manager-id="comercial"] input').value = 'Quais clientes estão em risco?';
  document.querySelector('[data-manager-id="comercial"] .manager-consult-button').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Consulta recebida pelo Gerente Comercial\./);
  assert.match(document.body.textContent, /facts/i);

  document.querySelector('#ai-director-memory-titulo').value = 'Nova observacao';
  document.querySelector('#ai-director-memory-conteudo').value = 'Conteudo novo';
  document.querySelector('#ai-director-memory-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  assert.ok(calls.some((call) => call.url === '/ai-director/memories'));

  teardownFrontendDom(dom);
});

test('ai director page dom without radar fallback', async () => {
  const dom = setupFrontendDom('#/diretor-ia-fallback');
  const { apiClient } = createApiClient({
    dashboard: {
      health: {
        receita_mes: 1000,
        pedidos_mes: 2,
        clientes_ativos: 1,
        clientes_risco: 0
      },
      alerts: [],
      opportunities: []
    },
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
  assert.match(document.body.textContent, /Sem dados suficientes/);
  assert.match(document.body.textContent, /Nenhuma observação modular disponível no momento\./);
  assert.match(document.body.textContent, /Pergunte ao Diretor IA/);
  assert.match(document.body.textContent, /Memória Executiva/);

  teardownFrontendDom(dom);
});
