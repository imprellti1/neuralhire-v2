import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAiDirectorPage } from './ai-director.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('ai director page dom', async () => {
  const dom = setupFrontendDom('#/diretor-ia');
  const calls = [];
  await renderAiDirectorPage(document.body, {
    apiClient: {
      get: async (url) => {
        if (url === '/ai-director/dashboard') {
          return {
            health: {
              receita_mes: 124550,
              pedidos_mes: 358,
              clientes_ativos: 78,
              clientes_risco: 15
            },
            alerts: [{ severity: 'high', title: 'Faturamento caiu 18% nos últimos 15 dias' }],
            opportunities: [{ title: '12 clientes demonstraram intenção de compra' }]
          };
        }
        if (url === '/ai-director/memories') {
          return {
            items: [
              { id: '1', tipo: 'observacao', prioridade: 'alta', titulo: 'Clientes em risco aumentando', conteudo: 'O número de clientes em risco cresceu.', origem: 'diretor_ia', created_at: '2026-06-12T10:00:00.000Z' }
            ]
          };
        }
        if (url === '/ai-director/managers') {
          return {
            managers: [
              { id: 'comercial', nome: 'Gerente Comercial', descricao: 'Especialista em carteira, pedidos, pipeline e leitura de receita.', modulos: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue'], capacidades: ['analisar carteira de clientes'], status: 'ativo' },
              { id: 'produtos', nome: 'Gerente Produtos', descricao: 'Focado em catálogo, operação de produtos e leitura de promoções.', modulos: ['Produtos', 'Categorias', 'Fabricantes', 'Importações', 'Promoções'], capacidades: ['analisar catálogo'], status: 'ativo' },
              { id: 'auditoria', nome: 'Gerente Auditoria', descricao: 'Responsável por integridade, logs e sinais de risco operacional.', modulos: ['Auditoria', 'Logs', 'Integridade de dados'], capacidades: ['analisar logs'], status: 'ativo' },
              { id: 'followup', nome: 'Gerente Follow-up', descricao: 'Orquestra conversas, bloqueios e oportunidades de follow-up.', modulos: ['WhatsApp', 'Evolution', 'IA Comercial', 'Pipeline IA'], capacidades: ['analisar conversas'], status: 'ativo' },
              { id: 'administrativo', nome: 'Gerente Administrativo', descricao: 'Cuida de governança, permissões, configurações e tenant.', modulos: ['Usuários', 'Permissões', 'Configurações', 'Tenant'], capacidades: ['revisar permissões'], status: 'ativo' }
            ]
          };
        }
        if (url === '/ai-director/delegate') {
          return {
            question: 'Por que o faturamento caiu?',
            intent: 'analise_faturamento',
            selectedManagers: ['comercial'],
            managerResponses: [
              {
                manager: { id: 'comercial', nome: 'Gerente Comercial' },
                summary: 'Consulta recebida pelo Gerente Comercial.',
                status: 'mocked',
                sources: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue']
              }
            ],
            summary: 'O Diretor IA consultou Gerente Comercial e consolidou uma resposta inicial.',
            status: 'delegated'
          };
        }
        return {};
      },
      post: async (url, payload) => {
        calls.push({ url, payload });
        if (url === '/ai-director/ask') {
          return {
            question: payload.question,
            answer: 'O faturamento caiu por redução no volume e queda em clientes em risco.',
            consultedManagers: ['comercial', 'followup'],
            usedMemories: ['1'],
            facts: {
              health: { receita_mes: 124550, pedidos_mes: 358 },
              managers: [],
              managerFacts: [
                { managerId: 'comercial', summary: 'Dados reais consolidados', provider: 'real', facts: { receita_mes: 124550, pedidos_mes: 358, clientes_risco: 15 } }
              ]
            },
            status: 'answered'
          };
        }
        if (url === '/ai-director/managers/comercial/consult') {
          return {
            manager: { id: 'comercial', nome: 'Gerente Comercial' },
            question: payload.question,
            summary: 'Consulta recebida pelo Gerente Comercial.',
            status: 'mocked',
            sources: ['Clientes', 'Pedidos', 'Pipeline', 'Revenue']
          };
        }
        return { item: { id: '2', ...payload } };
      }
    }
  });
  await flush();
  assert.match(document.body.textContent, /Diretor IA/);
  assert.match(document.body.textContent, /Saúde do Negócio/);
  assert.match(document.body.textContent, /Alertas Estratégicos/);
  assert.match(document.body.textContent, /Oportunidades/);
  assert.match(document.body.textContent, /Memória Estratégica/);
  assert.match(document.body.textContent, /Clientes em risco aumentando/);
  assert.match(document.body.textContent, /Gerentes Especializados/);
  assert.match(document.body.textContent, /Gerente Comercial/);
  assert.match(document.body.textContent, /Gerente Produtos/);
  assert.match(document.body.textContent, /Gerente Auditoria/);
  assert.match(document.body.textContent, /Gerente Follow-up/);
  assert.match(document.body.textContent, /Gerente Administrativo/);
  assert.match(document.body.textContent, /Pergunte ao Diretor/);
  document.querySelector('#ai-director-question').value = 'Por que o faturamento caiu?';
  document.querySelector('#ai-director-analyze').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await flush();
  await flush();
  await flush();
  assert.match(document.body.textContent, /O faturamento caiu por redução no volume/);
  assert.match(document.body.textContent, /comercial, followup/);
  assert.match(document.body.textContent, /1/);
  assert.match(document.body.textContent, /answered/);
  assert.match(document.body.textContent, /124550/);
  assert.match(document.body.textContent, /clientes_risco/);
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
  const errorDom = setupFrontendDom('#/diretor-ia-erro');
  await renderAiDirectorPage(document.body, {
    apiClient: {
      get: async (url) => {
        if (url === '/ai-director/dashboard') throw new Error('fail');
        return {};
      }
    }
  });
  await flush();
  assert.match(document.body.textContent, /Erro ao carregar o dashboard/);
  teardownFrontendDom(dom);
  teardownFrontendDom(errorDom);
});
