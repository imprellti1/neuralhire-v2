import { assert, assertEqual, assertIncludes } from '../testing/assert.js';
import { BaseRepository } from './base.repository.js';
import { DatabaseError } from './database.errors.js';

function createFakeAdapter() {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push(['query', sql, params]);
      if (sql.includes('count(*)')) return [{ count: 2 }];
      if (sql.includes('exists(')) return [{ exists: true }];
      if (sql.startsWith('SELECT * FROM users')) return [{ id: 10 }];
      if (sql.includes('one = $1')) return [{ id: 1 }];
      return [];
    },
    async execute(sql, params = []) {
      calls.push(['execute', sql, params]);
      return { rowCount: 1, rows: [{ ok: true }] };
    },
    async transaction(callback) {
      calls.push(['transaction']);
      return callback({
        query: async (sql, params = []) => {
          calls.push(['tx.query', sql, params]);
          return [{ ok: true }];
        }
      });
    }
  };
}

export function getBaseRepositoryTests() {
  return [
    {
      name: 'query e execute delegam para adapter',
      run: async () => {
        const adapter = createFakeAdapter();
        const repo = new BaseRepository(adapter, { logContext: 'tests' });
        const rows = await repo.query('select * from table where one = $1', [1]);
        const result = await repo.execute('update table set value = $1', ['x']);
        assertEqual(rows.length, 1, 'deve retornar linhas');
        assertEqual(result.rowCount, 1, 'deve retornar rowCount');
      }
    },
    {
      name: 'transaction expõe helpers com tx',
      run: async () => {
        const adapter = createFakeAdapter();
        const repo = new BaseRepository(adapter);
        const output = await repo.transaction(async (tx) => tx.query('select 1'));
        assertEqual(output.length, 1, 'deve executar no tx');
      }
    },
    {
      name: 'count e exists usam convenções',
      run: async () => {
        const adapter = createFakeAdapter();
        const repo = new BaseRepository(adapter);
        assertEqual(await repo.count('select count(*) as count from one'), 2, 'count esperado');
        assertEqual(await repo.exists('select exists(true) as exists from exists'), true, 'exists esperado');
      }
    },
    {
      name: 'findById e softDelete montam sql parametrizado',
      run: async () => {
        const adapter = createFakeAdapter();
        const repo = new BaseRepository(adapter);
        await repo.findById('users', 'id', 10, { deletedColumn: 'deleted_at' });
        await repo.softDelete('users', 'id', 10);
        const sqls = adapter.calls.map((call) => call[1] || '').join(' | ');
        assertIncludes(sqls, 'WHERE id = $1', 'id deve usar placeholder');
        assertIncludes(sqls, 'SET deleted_at = NOW()', 'soft delete deve atualizar coluna');
      }
    },
    {
      name: 'valida sql e params',
      run: async () => {
        const repo = new BaseRepository(createFakeAdapter());
        let caught = null;
        try {
          await repo.query('', []);
        } catch (error) {
          caught = error;
        }
        assert(caught instanceof DatabaseError, 'deve validar sql');
      }
    }
  ];
}
