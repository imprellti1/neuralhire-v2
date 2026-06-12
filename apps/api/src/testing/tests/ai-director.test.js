import assert from 'node:assert/strict';
import { __resetMemoryAiDirectorForTests, consultManager, createAiDirectorMemory, getAiDirectorDashboard, listAiDirectorMemories, listManagers } from '../../modules/ai-director/ai-director.repository.js';
import { answerAiDirectorQuestion, delegateAiDirectorQuestion } from '../../modules/ai-director/ai-director.orchestrator.js';
import { askAiDirectorLlm } from '../../modules/ai-director/ai-director.llm.js';

function resetState() {
  __resetMemoryAiDirectorForTests();
}

export function getAiDirectorTests() {
  return [
    {
      name: 'GET /ai-director/dashboard continua retornando payload',
      run: async () => {
        const dashboard = getAiDirectorDashboard();
        assert.equal(dashboard.health.receita_mes, 124550);
        assert.ok(Array.isArray(dashboard.alerts));
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
        const response = consultManager({ accountId: 'acc-a' }, 'comercial', { question: 'Quais clientes estão em risco?' });
        assert.equal(response.manager.id, 'comercial');
        assert.equal(response.status, 'answered');
        assert.deepEqual(response.sources, ['Clientes', 'Pedidos', 'Pipeline', 'Revenue']);
        assert.ok(response.facts);
        assert.ok(Array.isArray(response.facts.observations));
      }
    },
    {
      name: 'POST consult rejeita question vazia',
      run: async () => {
        assert.throws(() => consultManager({ accountId: 'acc-a' }, 'comercial', { question: '   ' }));
      }
    },
    {
      name: 'POST consult rejeita manager inexistente',
      run: async () => {
        assert.throws(() => consultManager({ accountId: 'acc-a' }, 'inexistente', { question: 'Teste' }));
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
      name: 'POST /ai-director/delegate rejeita question vazia',
      run: async () => {
        await assert.rejects(() => delegateAiDirectorQuestion({ question: '   ' }, { accountId: 'acc-a' }));
      }
    }
  ];
}
