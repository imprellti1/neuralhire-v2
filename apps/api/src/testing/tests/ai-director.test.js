import assert from 'node:assert/strict';
import { __resetMemoryAiDirectorForTests, __setAiDirectorManagerProviderOverrideForTests, consultManager, createAiDirectorMemory, createExecutiveMemory, findRelevantExecutiveMemories, getAiDirectorDashboard, listAiDirectorMemories, listExecutiveMemories, listManagers } from '../../modules/ai-director/ai-director.repository.js';
import { __resetMemoryAiDirectorObservationsForTests, createObservation, listObservations, updateObservationStatus } from '../../modules/ai-director-observations/ai-director-observations.repository.js';
import { answerAiDirectorQuestion, delegateAiDirectorQuestion } from '../../modules/ai-director/ai-director.orchestrator.js';
import { askAiDirectorLlm } from '../../modules/ai-director/ai-director.llm.js';
import { buildStrategicRadar } from '../../modules/ai-director/ai-director.radar.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPromocoesForTests, createPromocao } from '../../modules/promocoes/promocoes.repository.js';
import { __resetMemoryProductAuditForTests } from '../../modules/product-audit/product-audit.repository.js';
import { __resetMemoryWhatsappConversationsForTests, createConversation } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { __resetMemoryMessageApprovalsForTests } from '../../modules/message-approvals/message-approvals.repository.js';
import { detectRelevantChanges } from '../../modules/ai-director/ai-director.change-detector.js';
import { orchestrateManagersForChanges } from '../../modules/ai-director/ai-director.manager-orchestrator.js';
import { recordAuditLog } from '../../core/audit-logs.js';

function resetState() {
  __resetMemoryAiDirectorForTests();
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryPromocoesForTests();
  __resetMemoryProductAuditForTests();
  __resetMemoryWhatsappConversationsForTests();
  __resetMemoryMessageApprovalsForTests();
  __resetMemoryAiDirectorObservationsForTests();
}

export function getAiDirectorTests() {
  return [
    {
      name: 'GET /ai-director/dashboard continua retornando payload',
      run: async () => {
        resetState();
        const dashboard = await getAiDirectorDashboard({ accountId: 'acc-test' });
        assert.ok(dashboard.health && typeof dashboard.health === 'object');
        assert.ok(Array.isArray(dashboard.alerts));
        assert.ok(dashboard.radar);
        assert.equal(typeof dashboard.radar.scoreExecutivo.valor, 'number');
        assert.equal(dashboard.radar.observacoesPorModulo.length, 4);
        assert.equal(Array.isArray(dashboard.radar.prioridades), true);
        assert.equal(Array.isArray(dashboard.radar.acoesSugeridas), true);
        assert.equal(dashboard.radar.scoreExecutivo.valor >= 0 && dashboard.radar.scoreExecutivo.valor <= 100, true);
        assert.equal(dashboard.radar.acoesSugeridas.length <= 5, true);
        for (const [name, pillar] of Object.entries(dashboard.radar.scoreExecutivo.pilares)) {
          assert.ok(['comercial', 'operacional', 'produtos', 'inteligencia'].includes(name));
          assert.equal(typeof pillar.valor, 'number');
          assert.equal(pillar.valor >= 0 && pillar.valor <= 100, true);
          assert.equal(['excelente', 'bom', 'atencao', 'critico'].includes(pillar.status), true);
          assert.equal(Array.isArray(pillar.fatores), true);
        }
        for (const penalty of dashboard.radar.scoreExecutivo.penalidades) {
          assert.equal(typeof penalty.origem, 'string');
          assert.equal(typeof penalty.pontos, 'number');
          assert.equal(penalty.pontos > 0, true);
          assert.equal(typeof penalty.motivo, 'string');
        }
        for (let index = 1; index < dashboard.radar.scoreExecutivo.penalidades.length; index += 1) {
          assert.equal(dashboard.radar.scoreExecutivo.penalidades[index - 1].pontos >= dashboard.radar.scoreExecutivo.penalidades[index].pontos, true);
        }
        for (const priority of dashboard.radar.prioridades) {
          assert.equal(typeof priority.ordem, 'number');
          assert.equal(typeof priority.titulo, 'string');
          assert.equal(['alto', 'medio', 'baixo'].includes(priority.impacto), true);
          assert.equal(['alta', 'media', 'baixa'].includes(priority.urgencia), true);
          assert.equal(typeof priority.motivo, 'string');
          assert.equal(typeof priority.origem, 'string');
          assert.equal(typeof priority.acaoRecomendada, 'string');
          assert.equal(priority.gerenteSugerido === null || typeof priority.gerenteSugerido === 'string', true);
          assert.equal(typeof priority.peso, 'number');
          assert.equal(priority.peso >= 0 && priority.peso <= 100, true);
        }
        for (let index = 1; index < dashboard.radar.prioridades.length; index += 1) {
          assert.equal(dashboard.radar.prioridades[index - 1].peso >= dashboard.radar.prioridades[index].peso, true);
        }
        assert.equal(dashboard.radar.prioridades.length <= 7, true);
        dashboard.radar.prioridades.forEach((priority, index) => {
          assert.equal(priority.ordem, index + 1);
        });
        for (const item of dashboard.radar.observacoesPorModulo) {
          assert.equal(typeof item.modulo, 'string');
          assert.equal(['saudavel', 'atencao', 'critico'].includes(item.status), true);
          assert.equal(typeof item.score, 'number');
          assert.equal(item.score >= 0 && item.score <= 100, true);
          assert.equal(typeof item.resumo, 'string');
          assert.equal(Array.isArray(item.observacoes), true);
          assert.equal(item.gerenteResponsavel === null || typeof item.gerenteResponsavel === 'string', true);
        }
        for (const item of dashboard.radar.orquestracaoGerentes.orquestracoes) {
          assert.equal(typeof item.modulo, 'string');
          assert.equal(typeof item.alteracaoTipo, 'string');
          assert.equal(item.gerente === null || typeof item.gerente === 'string', true);
          assert.equal(item.gerenteId === null || typeof item.gerenteId === 'string', true);
          assert.equal(['alta', 'media', 'baixa'].includes(item.prioridade), true);
          assert.equal(typeof item.acao, 'string');
          assert.equal(typeof item.justificativa, 'string');
          assert.equal(['sugerida', 'sem_gerente', 'ignorada'].includes(item.status), true);
          assert.equal(typeof item.origemAlteracao, 'string');
        }
        assert.equal(dashboard.radar.orquestracaoGerentes.orquestracoes.length <= 10, true);
        if (dashboard.radar.prioridades.length > 0) {
          assert.equal(dashboard.radar.resumoExecutivo.includes(dashboard.radar.prioridades[0].titulo), true);
          assert.equal(dashboard.radar.resumoExecutivo.toLowerCase().includes('ação sugerida'), true);
        }
        assert.equal(dashboard.radar.resumoExecutivo.includes('Score Executivo'), true);
        dashboard.radar.acoesSugeridas.forEach((acao, index) => {
          assert.equal(acao.ordem, index + 1);
          assert.equal(typeof acao.titulo, 'string');
          assert.equal(typeof acao.descricao, 'string');
          assert.equal(['comercial', 'operacional', 'produtos', 'inteligencia', 'geral'].includes(acao.tipo), true);
          assert.equal(['alta', 'media', 'baixa'].includes(acao.prioridade), true);
          assert.equal(typeof acao.origem, 'string');
          assert.equal(acao.gerenteSugerido === null || typeof acao.gerenteSugerido === 'string', true);
          assert.equal(['hoje', 'esta_semana', 'proximos_15_dias', 'sem_prazo'].includes(acao.prazoSugerido), true);
          assert.equal(typeof acao.criterioConclusao, 'string');
        });
        for (let index = 1; index < dashboard.radar.acoesSugeridas.length; index += 1) {
          assert.equal(dashboard.radar.acoesSugeridas[index - 1].ordem < dashboard.radar.acoesSugeridas[index].ordem, true);
        }
      }
    },
    {
      name: 'detectRelevantChanges agrega alteracoes e limita saida',
      run: async () => {
        resetState();
        for (let index = 0; index < 55; index += 1) {
          await createCliente({ nome: `Cliente ${index}`, ativo: true }, { accountId: 'acc-a' });
        }
        const result = await detectRelevantChanges({ accountId: 'acc-a', janelaHoras: 24 });
        assert.equal(Array.isArray(result.alteracoes), true);
        assert.equal(result.alteracoes.length <= 10, true);
        assert.ok(result.alteracoes.some((item) => item.modulo === 'clientes'));
        const change = result.alteracoes.find((item) => item.modulo === 'clientes');
        assert.ok(change);
        assert.equal(typeof change.modulo, 'string');
        assert.equal(typeof change.tipo, 'string');
        assert.equal(typeof change.titulo, 'string');
        assert.equal(typeof change.descricao, 'string');
        assert.equal(typeof change.severidade, 'string');
        assert.equal(typeof change.ocorridoEm, 'string');
        assert.equal(typeof change.gerenteSugerido, 'string');
        assert.equal(typeof change.impactoNoRadar, 'string');
        assert.equal(typeof result.resumo, 'string');
      }
    },
    {
      name: 'orchestrateManagersForChanges associa alteracoes a gerentes',
      run: async () => {
        const result = orchestrateManagersForChanges({
          alteracoesRelevantes: [
            { modulo: 'clientes', tipo: 'novo_registro', severidade: 'alta', gerenteSugerido: 'Gerente Comercial', descricao: 'Importação em massa de clientes', impactoNoRadar: 'Pode alterar carteira, risco comercial e oportunidades de follow-up.' }
          ],
          managers: listManagers()
        });
        assert.equal(result.totalOrquestracoes, 1);
        assert.equal(result.orquestracoes[0].gerente, 'Gerente Comercial');
        assert.equal(result.orquestracoes[0].prioridade, 'alta');
        assert.equal(typeof result.resumo, 'string');
      }
    },
    {
      name: 'orchestrateManagersForChanges respeita limite de 10',
      run: async () => {
        const alteracoes = Array.from({ length: 12 }, (_, index) => ({
          modulo: 'clientes',
          tipo: `tipo_${index}`,
          severidade: 'media',
          gerenteSugerido: 'Gerente Comercial',
          descricao: `Alteração ${index}`
        }));
        const result = orchestrateManagersForChanges({ alteracoesRelevantes: alteracoes, managers: listManagers() });
        assert.equal(result.orquestracoes.length <= 10, true);
      }
    },
    {
      name: 'orchestrateManagersForChanges usa fallback sem gerentes',
      run: async () => {
        const result = orchestrateManagersForChanges({
          alteracoesRelevantes: [{ modulo: 'memorias', tipo: 'memoria_critica', severidade: 'alta', descricao: 'Insight crítico' }],
          managers: []
        });
        assert.equal(result.orquestracoes[0].gerenteId, null);
        assert.equal(result.orquestracoes[0].status, 'sem_gerente');
        assert.ok(result.orquestracoes[0].gerente);
      }
    },
    {
      name: 'buildStrategicRadar executa com contexto minimo sem falhar',
      run: async () => {
        const radar = await buildStrategicRadar({});
        assert.ok(radar);
        assert.ok(Array.isArray(radar.alertas));
        assert.ok(Array.isArray(radar.oportunidades));
        assert.ok(Array.isArray(radar.prioridades));
        assert.ok(Array.isArray(radar.acoesSugeridas));
        assert.ok(Array.isArray(radar.observacoesPorModulo));
        assert.equal(typeof radar.scoreExecutivo.valor, 'number');
      }
    },
    {
      name: 'radar vazio e parcialmente preenchido mantem shape',
      run: async () => {
        const radar = await buildStrategicRadar({ accountId: 'acc-shape', health: { clientes_ativos: 0, clientes_risco: 0, pedidos_mes: 0, receita_mes: 0 } });
        assert.ok(Array.isArray(radar.observacoesPorModulo));
        assert.equal(radar.observacoesPorModulo.length, 4);
        assert.ok(Array.isArray(radar.scoreExecutivo.penalidades));
        assert.ok(radar.auditoria && typeof radar.auditoria === 'object');
        assert.ok(radar.auditoria.consistencia && typeof radar.auditoria.consistencia === 'object');
      }
    },
    {
      name: 'GET /ai-director/dashboard inclui observacao modular e resumo',
      run: async () => {
        const dashboard = await getAiDirectorDashboard({ accountId: 'acc-test-2' });
        assert.ok(Array.isArray(dashboard.radar.observacoesPorModulo));
        assert.ok(dashboard.radar.observacoesPorModulo.some((item) => item.modulo === 'Comercial'));
        assert.ok(dashboard.radar.observacoesPorModulo.some((item) => item.modulo === 'Produtos'));
        assert.ok(dashboard.radar.observacoesPorModulo.some((item) => item.modulo === 'Follow-up'));
        assert.ok(dashboard.radar.observacoesPorModulo.some((item) => item.modulo === 'Inteligência'));
        assert.equal(typeof dashboard.radar.resumoModular, 'string');
      }
    },
    {
      name: 'GET /ai-director/memories retorna lista por account_id',
      run: async () => {
        resetState();
        await createAiDirectorMemory({ tipo: 'observacao', titulo: 'A', conteudo: 'Conteudo A' }, { accountId: 'acc-a' });
        await createAiDirectorMemory({ tipo: 'alerta', titulo: 'B', conteudo: 'Conteudo B' }, { accountId: 'acc-b' });
        const result = await listAiDirectorMemories({ limit: 10 }, { accountId: 'acc-a' });
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].account_id, 'acc-a');
      }
    },
    {
      name: 'GET /ai-director/executive-memories retorna lista por categoria',
      run: async () => {
        resetState();
        await createExecutiveMemory({ tipo: 'risk', titulo: 'Aumento de clientes em risco', descricao: 'Observado aumento', categoria: 'comercial', severidade: 'alta', dados_json: { delta: 4 } }, { accountId: 'acc-a' });
        await createExecutiveMemory({ tipo: 'trend', titulo: 'Outro insight', descricao: 'Outubro', categoria: 'produtos', severidade: 'media', dados_json: {} }, { accountId: 'acc-a' });
        const result = await listExecutiveMemories({ categoria: 'comercial' }, { accountId: 'acc-a' });
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].categoria, 'comercial');
      }
    },
    {
      name: 'POST /ai-director/memories cria memoria e ignora account_id malicioso',
      run: async () => {
        resetState();
        const item = await createAiDirectorMemory({ account_id: 'evil', tipo: 'observacao', titulo: 'Clientes em risco aumentando', conteudo: 'O numero cresceu', prioridade: 'alta', origem: 'diretor_ia', metadata: { source: 'test' } }, { accountId: 'acc-safe' });
        assert.equal(item.account_id, 'acc-safe');
        assert.equal(item.tipo, 'observacao');
        assert.equal(item.prioridade, 'alta');
      }
    },
    {
      name: 'POST rejeita tipo invalido',
      run: async () => {
        resetState();
        await assert.rejects(() => createAiDirectorMemory({ tipo: 'x', titulo: 'T', conteudo: 'C' }, { accountId: 'acc-a' }));
      }
    },
    {
      name: 'POST rejeita prioridade invalida',
      run: async () => {
        resetState();
        await assert.rejects(() => createAiDirectorMemory({ tipo: 'observacao', titulo: 'T', conteudo: 'C', prioridade: 'urgente' }, { accountId: 'acc-a' }));
      }
    },
    {
      name: 'tenant isolation bloqueia leitura cross tenant',
      run: async () => {
        resetState();
        const item = await createAiDirectorMemory({ tipo: 'observacao', titulo: 'T', conteudo: 'C' }, { accountId: 'acc-a' });
        const result = await listAiDirectorMemories({}, { accountId: 'acc-b' });
        assert.equal(result.items.length, 0);
        assert.equal(item.account_id, 'acc-a');
      }
    },
    {
      name: 'POST /ai-director/observations cria observacao valida',
      run: async () => {
        resetState();
        const item = await createObservation({ accountId: 'acc-a' }, {
          manager_id: 'comercial',
          manager_name: 'Gerente Comercial',
          category: 'comercial',
          title: 'Queda no pipeline',
          description: 'Pipeline caiu nas ultimas 24h',
          severity: 'high',
          impact_score: 80,
          urgency_score: 70,
          metadata: { source: 'manual' }
        });
        assert.equal(item.account_id, 'acc-a');
        assert.equal(item.severity, 'high');
      }
    },
    {
      name: 'POST /ai-director/observations rejeita severity invalida',
      run: async () => {
        resetState();
        await assert.rejects(() => createObservation({ accountId: 'acc-a' }, {
          manager_id: 'comercial',
          manager_name: 'Gerente Comercial',
          category: 'comercial',
          title: 'Teste',
          description: 'Teste',
          severity: 'urgent',
          impact_score: 10,
          urgency_score: 10,
          metadata: {}
        }));
      }
    },
    {
      name: 'GET /ai-director/observations filtra por account_id',
      run: async () => {
        resetState();
        await createObservation({ accountId: 'acc-a' }, { manager_id: 'comercial', manager_name: 'Gerente Comercial', category: 'comercial', title: 'A', description: 'A', severity: 'medium', impact_score: 10, urgency_score: 10, metadata: {} });
        await createObservation({ accountId: 'acc-b' }, { manager_id: 'comercial', manager_name: 'Gerente Comercial', category: 'comercial', title: 'B', description: 'B', severity: 'medium', impact_score: 10, urgency_score: 10, metadata: {} });
        const result = await listObservations({ accountId: 'acc-a' }, { status: 'open' });
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].account_id, 'acc-a');
      }
    },
    {
      name: 'PATCH /ai-director/observations/:id atualiza status',
      run: async () => {
        resetState();
        const item = await createObservation({ accountId: 'acc-a' }, { manager_id: 'auditoria', manager_name: 'Gerente Auditoria', category: 'auditoria', title: 'Log inconsistente', description: 'Encontrado erro', severity: 'medium', impact_score: 10, urgency_score: 10, metadata: {} });
        const updated = await updateObservationStatus({ accountId: 'acc-a' }, item.id, { status: 'resolved' });
        assert.equal(updated.status, 'resolved');
      }
    },
    {
      name: 'GET /ai-director/managers retorna 5 gerentes',
      run: async () => {
        const managers = listManagers();
        assert.equal(managers.length, 5);
        assert.ok(managers.some((manager) => manager.id === 'comercial'));
        assert.ok(managers.some((manager) => manager.id === 'produtos'));
        assert.ok(managers.some((manager) => manager.id === 'auditoria'));
        assert.ok(managers.some((manager) => manager.id === 'followup'));
        assert.ok(managers.some((manager) => manager.id === 'administrativo'));
      }
    },
    {
      name: 'POST /ai-director/managers/comercial/consult retorna fatos estruturados',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente A', ativo: true }, { accountId: 'acc-a' });
        const produto = await createProduto({ nome: 'Produto A', preco: 100 }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 50 }] }, { accountId: 'acc-a' });
        const response = await consultManager({ accountId: 'acc-a' }, 'comercial', { question: 'Quais clientes estão em risco?' });
        assert.equal(response.manager.id, 'comercial');
        assert.equal(response.status, 'answered');
        assert.deepEqual(response.sources, ['Clientes', 'Pedidos', 'Pipeline', 'Revenue']);
        assert.ok(response.facts);
        assert.equal(response.facts.indicators.clientes_ativos >= 1, true);
        assert.ok(Array.isArray(response.facts.observations));
      }
    },
    {
      name: 'POST consult rejeita question vazia',
      run: async () => {
        await assert.rejects(() => consultManager({ accountId: 'acc-a' }, 'comercial', { question: '   ' }));
      }
    },
    {
      name: 'POST consult rejeita manager inexistente',
      run: async () => {
        await assert.rejects(() => consultManager({ accountId: 'acc-a' }, 'inexistente', { question: 'Teste' }));
      }
    },
    {
      name: 'POST /ai-director/delegate roteia faturamento para comercial',
      run: async () => {
        const result = await delegateAiDirectorQuestion({ question: 'Por que o faturamento caiu?' }, { accountId: 'acc-a' });
        assert.equal(result.intent, 'analise_faturamento');
        assert.deepEqual(result.selectedManagers, ['comercial']);
        assert.equal(result.managerResponses[0].manager.id, 'comercial');
      }
    },
    {
      name: 'POST /ai-director/delegate roteia clientes em risco para comercial e followup',
      run: async () => {
        const result = await delegateAiDirectorQuestion({ question: 'Quais clientes estão em risco?' }, { accountId: 'acc-a' });
        assert.equal(result.intent, 'analise_clientes');
        assert.deepEqual(result.selectedManagers, ['comercial', 'followup']);
      }
    },
    {
      name: 'POST /ai-director/delegate roteia fabricante para produtos',
      run: async () => {
        const result = await delegateAiDirectorQuestion({ question: 'Qual fabricante mais vendeu?' }, { accountId: 'acc-a' });
        assert.equal(result.intent, 'analise_produtos');
        assert.deepEqual(result.selectedManagers, ['produtos']);
      }
    },
    {
      name: 'POST /ai-director/delegate roteia auditoria',
      run: async () => {
        const result = await delegateAiDirectorQuestion({ question: 'Tem erro de auditoria?' }, { accountId: 'acc-a' });
        assert.equal(result.intent, 'analise_auditoria');
        assert.deepEqual(result.selectedManagers, ['auditoria']);
      }
    },
    {
      name: 'POST /ai-director/delegate roteia administrativo',
      run: async () => {
        const result = await delegateAiDirectorQuestion({ question: 'Revisar permissões dos usuários' }, { accountId: 'acc-a' });
        assert.equal(result.intent, 'analise_administrativa');
        assert.deepEqual(result.selectedManagers, ['administrativo']);
      }
    },
    {
      name: 'POST /ai-director/delegate pergunta generica usa analise_geral',
      run: async () => {
        const result = await delegateAiDirectorQuestion({ question: 'Me ajude a priorizar a operação' }, { accountId: 'acc-a' });
        assert.equal(result.intent, 'analise_geral');
        assert.deepEqual(result.selectedManagers, ['comercial', 'produtos']);
      }
    },
    {
      name: 'POST /ai-director/ask rejeita question vazia',
      run: async () => {
        await assert.rejects(() => answerAiDirectorQuestion({ question: '   ' }, { accountId: 'acc-a' }));
      }
    },
    {
      name: 'POST /ai-director/ask seleciona gerentes corretamente',
      run: async () => {
        const result = await answerAiDirectorQuestion({ question: 'Qual fabricante mais vendeu?' }, { accountId: 'acc-a' });
        assert.deepEqual(result.consultedManagers, ['produtos']);
        assert.ok(['answered', 'answered_with_fallback'].includes(result.status));
        assert.ok(result.facts.managers.length > 0);
      }
    },
    {
      name: 'POST /ai-director/ask usa memórias relevantes quando existirem',
      run: async () => {
        resetState();
        const memory = await createAiDirectorMemory({ tipo: 'alerta', titulo: 'Faturamento caiu', conteudo: 'Queda de receita observada no periodo atual', prioridade: 'alta' }, { accountId: 'acc-a' });
        const result = await answerAiDirectorQuestion({ question: 'Por que o faturamento caiu?' }, { accountId: 'acc-a' });
        assert.ok(result.usedMemories.includes(memory.id));
      }
    },
    {
      name: 'POST /ai-director/ask inclui observacoes abertas no contexto',
      run: async () => {
        resetState();
        await createObservation({ accountId: 'acc-a' }, { manager_id: 'comercial', manager_name: 'Gerente Comercial', category: 'comercial', title: 'Alerta comercial', description: 'Observacao aberta', severity: 'high', impact_score: 50, urgency_score: 40, metadata: {} });
        const result = await answerAiDirectorQuestion({ question: 'Como está a operação?' }, { accountId: 'acc-a' });
        assert.equal(Array.isArray(result.facts.observations), true);
        assert.equal(result.facts.observationsCount >= 1, true);
      }
    },
    {
      name: 'POST /ai-director/ask registra memoria executiva quando identifica risco',
      run: async () => {
        resetState();
        __setAiDirectorManagerProviderOverrideForTests('comercial', async () => ({ clientes_risco: 23, clientes_ativos: 50, receita_mes: 10000, pedidos_mes: 12 }));
        try {
          const result = await answerAiDirectorQuestion({ question: 'Como está nossa carteira?' }, { accountId: 'acc-a' });
          assert.ok(result.executiveMemories.length > 0);
        } finally {
          __setAiDirectorManagerProviderOverrideForTests('comercial', null);
        }
      }
    },
    {
      name: 'POST /ai-director/ask fallback controlado quando LLM nao estiver configurada',
      run: async () => {
        const result = await askAiDirectorLlm({ question: 'Teste', facts: {}, usedMemories: [], managerFacts: [] });
        assert.equal(result.answer, null);
        assert.equal(result.error, 'LLM nao configurada');
      }
    },
    {
      name: 'POST /ai-director/ask cobre clientes, faturamento, pedidos, fabricante, promocoes e auditoria',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente B', ativo: true }, { accountId: 'acc-a' });
        const produto = await createProduto({ nome: 'Produto B', preco: 200 }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 200 }] }, { accountId: 'acc-a' });
        await createPromocao({ nome: 'Promo B', percentual_desconto: 10, data_inicio: '2026-06-01', data_fim: '2026-06-30', produto_id: produto.id }, { accountId: 'acc-a' });
        await recordAuditLog({ accountId: 'acc-a', auth: { userId: 'u-1', role: 'manager' } }, { modulo: 'ai-director', entidade: 'teste', acao: 'falha', descricao: 'Problema critico', status: 'failed', sucesso: false, erro_mensagem: 'Falha critica' }).catch(() => null);
        await createConversation({ phone: '11999999999', clienteId: cliente.id }, { accountId: 'acc-a' });
        const cases = [
          ['Quais clientes estão em risco?', ['comercial', 'followup']],
          ['Qual o faturamento do mês?', ['comercial']],
          ['Quantos pedidos tivemos?', ['comercial']],
          ['Qual fabricante mais vendeu?', ['produtos']],
          ['Quais promoções estão ativas?', ['produtos']],
          ['Existe algum problema crítico no sistema?', ['auditoria']],
          ['Por que o faturamento caiu?', ['comercial']]
        ];
        for (const [question, managers] of cases) {
          const result = await answerAiDirectorQuestion({ question }, { accountId: 'acc-a' });
          assert.deepEqual(result.consultedManagers, managers);
          assert.equal(result.status === 'answered' || result.status === 'answered_with_fallback', true);
        }
      }
    },
    {
      name: 'POST /ai-director/ask retorna fallback quando gerente falha',
      run: async () => {
        __setAiDirectorManagerProviderOverrideForTests('comercial', async () => { throw new Error('falha simulada'); });
        const result = await answerAiDirectorQuestion({ question: 'Qual o faturamento do mês?' }, { accountId: 'acc-a' });
        assert.equal(result.managerResponses[0].facts.provider, 'fallback');
        assert.ok(result.answer.includes('dados disponíveis'));
        __setAiDirectorManagerProviderOverrideForTests('comercial', null);
      }
    },
    {
      name: 'POST /ai-director/delegate rejeita question vazia',
      run: async () => {
        await assert.rejects(() => delegateAiDirectorQuestion({ question: '   ' }, { accountId: 'acc-a' }));
      }
    }
  ];
}
