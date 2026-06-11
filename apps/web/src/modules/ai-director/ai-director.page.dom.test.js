import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAiDirectorPage } from './ai-director.page.js';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

test('ai director page dom', async () => {
  const dom = setupFrontendDom('#/x');
  await renderAiDirectorPage(document.body, { apiClient: {
    get: async (url) => {
      if (url === '/ai-director/overview') return { gerentes: [{ status: 'ativo' }], eventosRecentes: [], recomendacoesPendentes: [{ status: 'pendente' }], contadoresPorCriticidade: { critica: 1 }, contadoresPorStatus: { novo: 2 } };
      if (url === '/ai-director/agents') return { items: [{ nome: 'Diretor IA', funcao: 'Coordena', escopo: 'sistema', status: 'ativo', nivel_autonomia: 'observador' }, { nome: 'Gerente de Produtos', funcao: 'Observa', escopo: 'produtos', status: 'ativo', nivel_autonomia: 'observador' }, { nome: 'Gerente de Promoções', funcao: 'Observa', escopo: 'promocoes', status: 'ativo', nivel_autonomia: 'observador' }, { nome: 'Gerente de Auditoria', funcao: 'Observa', escopo: 'auditoria', status: 'ativo', nivel_autonomia: 'observador' }, { nome: 'Gerente de Importações', funcao: 'Observa', escopo: 'importacoes', status: 'ativo', nivel_autonomia: 'observador' }] };
      if (url === '/ai-director/events') return { items: [{ titulo: 'Produto sem imagem', resumo: 'Sem imagem', origem: 'produtos', criticidade: 'baixa', status: 'novo', criado_em: '2026-06-11T12:00:00.000Z' }] };
      return { items: [{ titulo: 'Revisar imagem principal', descricao: 'Gerente de Produtos recomenda revisar imagem principal antes de publicar no catálogo.', gerente_origem: 'Gerente de Produtos', prioridade: 'media', status: 'pendente' }] };
    }
  } });
  await flush();
  assert.match(document.body.textContent, /Central de inteligência e observação do NeuralHire/);
  assert.match(document.body.textContent, /Gerentes ativos/);
  assert.match(document.body.textContent, /Eventos novos/);
  assert.match(document.body.textContent, /Recomendações pendentes/);
  assert.match(document.body.textContent, /Alertas críticos/);
  assert.match(document.body.textContent, /Agora no sistema/);
  assert.match(document.body.textContent, /Gerentes IA/);
  assert.match(document.body.textContent, /Recomendações do Diretor/);
  assert.match(document.body.textContent, /Gerente de Produtos/);
  assert.match(document.body.textContent, /Gerente de Promoções/);
  assert.match(document.body.textContent, /Gerente de Auditoria/);
  assert.match(document.body.textContent, /Gerente de Importações/);
  teardownFrontendDom(dom);
});
