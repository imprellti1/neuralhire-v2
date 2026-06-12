import assert from 'node:assert/strict';
import { __resetMemoryAiDirectorForTests, createAiDirectorMemory, getAiDirectorDashboard, listAiDirectorMemories } from '../../modules/ai-director/ai-director.repository.js';

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
    }
  ];
}
