import { createDatabaseAdapter } from './database.adapter.js';
import { DatabaseError } from './database.errors.js';
import { assert, assertEqual, assertIncludes } from '../testing/assert.js';

function createFakePool(handlers = {}) {
  const calls = [];
  const clientCalls = [];
  const client = {
    async query(sql, params) {
      clientCalls.push([sql, params]);
      if (handlers.clientQuery) return handlers.clientQuery(sql, params);
      return { rows: [], rowCount: 0 };
    },
    release() {
      calls.push(['release']);
    }
  };

  return {
    calls,
    clientCalls,
    async query(sql, params) {
      calls.push([sql, params]);
      if (handlers.poolQuery) return handlers.poolQuery(sql, params);
      return { rows: [], rowCount: 0 };
    },
    async connect() {
      calls.push(['connect']);
      return client;
    }
  };
}

export function getDatabaseAdapterTests() {
  return [
    {
      name: 'query retorna rows e registra log sem params',
      run: async () => {
        const pool = createFakePool({
          poolQuery: async () => ({ rows: [{ id: 1 }], rowCount: 1 })
        });
        const adapter = createDatabaseAdapter(pool);
        const rows = await adapter.query('select * from users where id = $1', [1]);
        assertEqual(rows.length, 1, 'deve retornar uma linha');
        assertEqual(rows[0].id, 1, 'deve retornar row');
      }
    },
    {
      name: 'one retorna unica linha',
      run: async () => {
        const pool = createFakePool({
          poolQuery: async () => ({ rows: [{ id: 7 }], rowCount: 1 })
        });
        const adapter = createDatabaseAdapter(pool);
        const row = await adapter.one('select 1');
        assertEqual(row.id, 7, 'deve retornar linha unica');
      }
    },
    {
      name: 'one falha quando nao houver exatamente uma linha',
      run: async () => {
        const pool = createFakePool({
          poolQuery: async () => ({ rows: [], rowCount: 0 })
        });
        const adapter = createDatabaseAdapter(pool);
        let caught = null;
        try {
          await adapter.one('select 1');
        } catch (error) {
          caught = error;
        }
        assert(caught instanceof DatabaseError, 'deve lançar DatabaseError');
        assertEqual(caught.code, 'DATABASE_NOT_ONE', 'code esperado');
      }
    },
    {
      name: 'many retorna lista de linhas',
      run: async () => {
        const pool = createFakePool({
          poolQuery: async () => ({ rows: [{ id: 1 }, { id: 2 }], rowCount: 2 })
        });
        const adapter = createDatabaseAdapter(pool);
        const rows = await adapter.many('select * from users');
        assertEqual(rows.length, 2, 'deve retornar duas linhas');
      }
    },
    {
      name: 'transaction executa begin commit e queries via tx',
      run: async () => {
        const pool = createFakePool({
          clientQuery: async (sql) => {
            if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [], rowCount: 0 };
            return { rows: [{ ok: true }], rowCount: 1 };
          }
        });
        const adapter = createDatabaseAdapter(pool);
        const result = await adapter.transaction(async (tx) => {
          const rows = await tx.query('select 1');
          return rows;
        });
        assertEqual(result.length, 1, 'transaction deve retornar resultado');
        assertIncludes(JSON.stringify(pool.clientCalls.map((call) => call[0])), 'BEGIN', 'deve iniciar transação');
        assertIncludes(JSON.stringify(pool.clientCalls.map((call) => call[0])), 'COMMIT', 'deve confirmar transação');
      }
    },
    {
      name: 'transaction faz rollback quando callback falha',
      run: async () => {
        const pool = createFakePool({
          clientQuery: async (sql) => {
            if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
            return { rows: [], rowCount: 0 };
          }
        });
        const adapter = createDatabaseAdapter(pool);
        let caught = null;
        try {
          await adapter.transaction(async () => {
            throw new Error('boom');
          });
        } catch (error) {
          caught = error;
        }
        assert(caught instanceof DatabaseError, 'erro deve ser normalizado');
        assertIncludes(JSON.stringify(pool.clientCalls.map((call) => call[0])), 'ROLLBACK', 'deve fazer rollback');
      }
    },
    {
      name: 'erro do postgres preserva sqlstate',
      run: async () => {
        const pool = createFakePool({
          poolQuery: async () => {
            const error = new Error('violacao');
            error.code = '23505';
            error.detail = 'duplicate key';
            error.hint = 'use another value';
            throw error;
          }
        });
        const adapter = createDatabaseAdapter(pool);
        let caught = null;
        try {
          await adapter.query('insert into users values ($1)', ['secret']);
        } catch (error) {
          caught = error;
        }
        assert(caught instanceof DatabaseError, 'deve converter para DatabaseError');
        assertEqual(caught.sqlstate, '23505', 'sqlstate deve ser preservado');
        assertEqual(caught.code, '23505', 'code deve ser preservado');
        assertIncludes(caught.sql, 'insert into users', 'sql deve ser registrado de forma resumida');
      }
    }
  ];
}

