import { assert, assertEqual, assertIncludes } from '../assert.js';
import { __dumpAuditLogsForTests, recordAuditLog, sanitizeAuditMetadata } from '../../core/audit-logs.js';
import { __resetAuditLogsForTests, __setAuditLogsDatabaseForTests, createAuditLog, listAuditLogs } from '../../modules/audit-logs/audit-logs.repository.js';

function createDbMock(handlers = {}) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push(['query', sql, params]);
      if (handlers.query) return handlers.query(sql, params);
      return [];
    },
    async many(sql, params = []) {
      calls.push(['many', sql, params]);
      if (handlers.many) return handlers.many(sql, params);
      return [];
    },
    async one(sql, params = []) {
      calls.push(['one', sql, params]);
      if (handlers.one) return handlers.one(sql, params);
      return { total: 0 };
    },
    async execute(sql, params = []) {
      calls.push(['execute', sql, params]);
      if (handlers.execute) return handlers.execute(sql, params);
      return { rowCount: 1, rows: [] };
    },
    async transaction(callback) {
      calls.push(['transaction']);
      return callback(this);
    }
  };
}

export function getAuditLogsTests() {
  return [
    {
      name: 'sanitiza metadados sensiveis',
      run: async () => {
        const out = sanitizeAuditMetadata({ token: 'abc', nested: { password: 'x', ok: true } });
        assertEqual(out.token, '[redacted]', 'token redacted');
        assertEqual(out.nested.password, '[redacted]', 'password redacted');
      }
    },
    {
      name: 'registra log de sucesso com requestId',
      run: async () => {
        globalThis.__NEURALHIRE_AUDIT_LOGS__ = [];
        const ctx = { requestId: 'req-1', auth: { accountId: 'acc-a', userId: 'u1', email: 'u1@x.com', name: 'User 1' }, ip: '127.0.0.1', userAgent: 'UA' };
        await recordAuditLog(ctx, { modulo: 'produtos', entidade: 'produto', acao: 'criar', descricao: 'ok', sucesso: true, status: 'success', metadata: { foo: 'bar', token: 'secret' } });
        const row = __dumpAuditLogsForTests().at(-1);
        assertEqual(row.request_id, 'req-1', 'request id');
        assertEqual(row.metadata.token, '[redacted]', 'metadata sanitizada');
        delete globalThis.__NEURALHIRE_AUDIT_LOGS__;
      }
    },
    {
      name: 'lista logs com filtros e paginação',
      run: async () => {
        const db = createDbMock({
          one: async (sql, params) => {
            assertIncludes(sql, 'COUNT(*)::int AS total', 'contagem esperada');
            assertEqual(params[0], 'acc-a', 'tenant na posicao correta');
            assertEqual(params[1], 'financeiro', 'filtro modulo');
            assertEqual(params[2], 'pedido', 'filtro entidade');
            assertEqual(params[3], 'created', 'filtro acao');
            assertEqual(params[4], 'success', 'filtro status');
            assertEqual(params[5], 'u1', 'filtro user');
            assertEqual(params[6], '%erro%', 'filtro search');
            return { total: 1 };
          },
          many: async (sql, params) => {
            assertIncludes(sql, 'ORDER BY created_at DESC', 'ordem esperada');
            assertIncludes(sql, 'LIMIT $8 OFFSET $9', 'paginação parametrizada');
            assertEqual(params[7], 20, 'limit padrao');
            assertEqual(params[8], 20, 'offset calculado');
            return [{ id: '1', account_id: 'acc-a' }];
          }
        });
        __setAuditLogsDatabaseForTests(db);
        const result = await listAuditLogs(
          { modulo: 'financeiro', entidade: 'pedido', acao: 'created', status: 'success', user_id: 'u1', search: 'erro', page: 2, limit: 20 },
          { accountId: 'acc-a' }
        );
        assertEqual(result.items.length, 1, 'um item');
        assertEqual(result.total, 1, 'total');
        assertEqual(result.page, 2, 'pagina');
        assertEqual(result.limit, 20, 'limite');
      }
    },
    {
      name: 'insere log com sql parametrizado',
      run: async () => {
        const db = createDbMock({
          one: async (sql, params) => {
            assertIncludes(sql, 'INSERT INTO system_audit_logs', 'insert esperado');
            assertIncludes(sql, 'RETURNING *', 'retorno esperado');
            assertEqual(params[1], 'acc-a', 'account id');
            assertEqual(params[3], 'produto', 'entidade');
            return { id: 'log-1', account_id: 'acc-a' };
          }
        });
        __setAuditLogsDatabaseForTests(db);
        const item = await createAuditLog({ modulo: 'produtos', entidade: 'produto', acao: 'criar', descricao: 'ok' }, { accountId: 'acc-a' });
        assertEqual(item.id, 'log-1', 'registro criado');
      }
    },
    {
      name: 'tratamento de erro preserva falha do banco',
      run: async () => {
        const error = new Error('violacao');
        error.code = '23505';
        const db = createDbMock({
          many: async () => { throw error; },
          one: async () => { throw error; }
        });
        __setAuditLogsDatabaseForTests(db);
        let caught = null;
        try {
          await listAuditLogs({}, { accountId: 'acc-a' });
        } catch (e) {
          caught = e;
        }
        assert(caught instanceof Error, 'deve lançar erro');
        assertEqual(caught.code, '23505', 'code preservado');
      }
    },
    {
      name: 'reset limpo para testes',
      run: async () => {
        __resetAuditLogsForTests();
        const out = __dumpAuditLogsForTests();
        assertEqual(Array.isArray(out), true, 'array esperado');
      }
    }
  ];
}
