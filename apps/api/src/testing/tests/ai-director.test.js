import assert from 'node:assert/strict';
import { __resetMemoryAiDirectorForTests, __setAiDirectorManagerProviderOverrideForTests, consultManager, createAiDirectorMemory, createExecutiveMemory, findRelevantExecutiveMemories, getAiDirectorDashboard, listAiDirectorMemories, listExecutiveMemories, listManagers } from '../../modules/ai-director/ai-director.repository.js';
import { answerAiDirectorQuestion, delegateAiDirectorQuestion } from '../../modules/ai-director/ai-director.orchestrator.js';
import { askAiDirectorLlm } from '../../modules/ai-director/ai-director.llm.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryPromocoesForTests, createPromocao } from '../../modules/promocoes/promocoes.repository.js';
import { __resetMemoryProductAuditForTests } from '../../modules/product-audit/product-audit.repository.js';
import { __resetMemoryWhatsappConversationsForTests, createConversation } from '../../modules/whatsapp-conversations/whatsapp-conversations.repository.js';
import { __resetMemoryMessageApprovalsForTests } from '../../modules/message-approvals/message-approvals.repository.js';
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
}

export function getAiDirectorTests() {
  return [
    {
      name: 'GET /ai-director/dashboard continua retornando payload',
      run: async () => {
        const dashboard = await getAiDirectorDashboard();
        assert.ok(dashboard.health && typeof dashboard.health === 'object');
        assert.ok(Array.isArray(dashboard.alerts));
        assert.ok(dashboard.radar);
        assert.equal(typeof dashboard.radar.scoreExecutivo.valor, 'number');
        assert.equal(Array.isArray(dashboard.radar.alertas), true);
        assert.equal(Array.isArray(dashboard.radar.oportunidades), true);
        assert.equal(Array.isArray(dashboard.radar.prioridades), true);
        assert.equal(typeof dashboard.radar.resumoExecutivo, 'string');
        assert.equal(dashboard.radar.scoreExecutivo.valor >= 0 && dashboard.radar.scoreExecutivo.valor <= 100, true);
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
        if (dashboard.radar.prioridades.length > 0) {
          assert.equal(dashboard.radar.resumoExecutivo.includes(dashboard.radar.prioridades[0].titulo), true);
        }
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
      name: 'POST /ai-director/ask registra memoria executiva quando identifica risco',
      run: async () => {
        resetState();
        __setAiDirectorManagerProviderOverrideForTests('comercial', async () => ({ clientes_risco: 23, clientes_ativos: 50, receita_mes: 10000, pedidos_mes: 12 }));
        const result = await answerAiDirectorQuestion({ question: 'Como está nossa carteira?' }, { accountId: 'acc-a' });
        const executive = await findRelevantExecutiveMemories({ question: 'carteira', limit: 10 }, { accountId: 'acc-a' });
        assert.ok(executive.items.some((item) => item.tipo === 'risk'));
        assert.ok(result.executiveMemories.length > 0);
        __setAiDirectorManagerProviderOverrideForTests('comercial', null);
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
