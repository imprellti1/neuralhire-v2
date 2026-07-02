import { assertEqual } from '../assert.js';
import { __createAnalyticsRepositoryForTests } from '../../modules/analytics/analytics.repository.js';
import { DatabaseError } from '../../database/database.errors.js';

function createDatabaseMock() {
  const calls = [];
  const responses = [];
  return {
    calls,
    responses,
    query(sql, params) { calls.push({ method: 'query', sql, params }); return Promise.resolve(responses.shift() || []); },
    async many(sql, params) {
      calls.push({ method: 'many', sql, params });
      return responses.shift() || [];
    },
    async one(sql, params) {
      calls.push({ method: 'one', sql, params });
      const rows = responses.shift() || [];
      if (rows.length !== 1) throw new DatabaseError(`Expected exactly one row, received ${rows.length}`, { code: 'DATABASE_NOT_ONE' });
      return rows[0];
    },
    async execute(sql, params) {
      calls.push({ method: 'execute', sql, params });
      return { rowCount: 0, rows: [] };
    },
    async transaction(callback) {
      return callback(this);
    }
  };
}

export function getAnalyticsRepositoryTests() {
  return [
    {
      name: 'analytics usa SQL parametrizado para agregacoes',
      run: async () => {
        const db = createDatabaseMock();
        const repo = __createAnalyticsRepositoryForTests(db);
        db.responses.push([{ total_pedidos: 2, total_faturado: 300, ticket_medio: 150 }]);
        db.responses.push([{ status: 'rascunho', total: 1 }, { status: 'aprovado', total: 1 }]);
        db.responses.push([{ total: 1 }]);
        db.responses.push([{ total: 2 }]);
        const out = await repo.getSummary('acc-1', { startDate: '2026-06-01', endDate: '2026-06-30' });
        assertEqual(out.totalPedidos, 2);
        assertEqual(out.totalFaturado, 300);
        assertEqual(out.pedidosPorStatus.rascunho, 1);
        assertEqual(db.calls[0].params[0], 'acc-1');
        assertEqual(db.calls[0].params[1], '2026-06-01');
        assertEqual(db.calls[0].params[2], '2026-06-30');
      }
    },
    {
      name: 'analytics ordena rankings por total desc e limita resultados',
      run: async () => {
        const db = createDatabaseMock();
        const repo = __createAnalyticsRepositoryForTests(db);
        db.responses.push([
          { produto_id: 'p-2', produto_nome: 'B', quantidade_vendida: 3, total_vendido: 300, pedidos: 2 },
          { produto_id: 'p-1', produto_nome: 'A', quantidade_vendida: 1, total_vendido: 100, pedidos: 1 }
        ]);
        const items = await repo.getTopProducts('acc-1', { startDate: '2026-06-01', endDate: '2026-06-30', limit: 2 });
        assertEqual(items.length, 2);
        assertEqual(items[0].totalVendido, 300);
        assertEqual(db.calls[0].params[3], 2);
      }
    },
    {
      name: 'analytics converte falha do banco em DatabaseError',
      run: async () => {
        const db = {
          async one() { throw new Error('boom'); },
          async many() { throw new Error('boom'); },
          async execute() { throw new Error('boom'); },
          async transaction(callback) { return callback(this); }
        };
        const repo = __createAnalyticsRepositoryForTests(db);
        let failed = false;
        try {
          await repo.getSummary('acc-1', {});
        } catch (error) {
          failed = error instanceof DatabaseError && String(error.message || '').includes('boom');
        }
        assertEqual(failed, true);
      }
    }
  ];
}
