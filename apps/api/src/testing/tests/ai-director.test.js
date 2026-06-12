import assert from 'node:assert/strict';
import { __resetMemoryAiDirectorForTests, consultManager, createAiDirectorMemory, getAiDirectorDashboard, listAiDirectorMemories, listManagers } from '../../modules/ai-director/ai-director.repository.js';

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
      name: 'POST /ai-director/managers/comercial/consult retorna mocked',
      run: async () => {
        const response = consultManager({ accountId: 'acc-a' }, 'comercial', { question: 'Quais clientes estão em risco?' });
        assert.equal(response.manager.id, 'comercial');
        assert.equal(response.status, 'mocked');
        assert.deepEqual(response.sources, ['Clientes', 'Pedidos', 'Pipeline', 'Revenue']);
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
    }
  ];
}
