import { assertEqual } from '../assert.js';
import { __dumpAuditLogsForTests, recordAuditLog, sanitizeAuditMetadata } from '../../core/audit-logs.js';
import { listAuditLogs } from '../../modules/audit-logs/audit-logs.repository.js';

export function getAuditLogsTests() {
  return [
    { name: 'sanitiza metadados sensiveis', run: async () => { const out = sanitizeAuditMetadata({ token: 'abc', nested: { password: 'x', ok: true } }); assertEqual(out.token, '[redacted]', 'token redacted'); assertEqual(out.nested.password, '[redacted]', 'password redacted'); } },
    { name: 'registra log de sucesso com requestId', run: async () => { globalThis.__NEURALHIRE_AUDIT_LOGS__ = []; const ctx = { requestId: 'req-1', auth: { accountId: 'acc-a', userId: 'u1', email: 'u1@x.com', name: 'User 1' }, ip: '127.0.0.1', userAgent: 'UA' }; await recordAuditLog(ctx, { modulo: 'produtos', entidade: 'produto', acao: 'criar', descricao: 'ok', sucesso: true, status: 'success', metadata: { foo: 'bar', token: 'secret' } }); const row = __dumpAuditLogsForTests().at(-1); assertEqual(row.request_id, 'req-1', 'request id'); assertEqual(row.metadata.token, '[redacted]', 'metadata sanitizada'); delete globalThis.__NEURALHIRE_AUDIT_LOGS__; } },
    { name: 'lista logs respeitando conta', run: async () => { const chain = { eq() { return chain; }, order() { return chain; }, range: async () => ({ data: [{ id: '1', account_id: 'acc-a' }], count: 1, error: null }) }; globalThis.__NEURALHIRE_SUPABASE_MOCK__ = { from: () => ({ select: () => chain }) }; const result = await listAuditLogs({}, { accountId: 'acc-a' }); assertEqual(result.items.length, 1, 'um item'); delete globalThis.__NEURALHIRE_SUPABASE_MOCK__; } },
    { name: 'dump memory audit logs', run: async () => { const out = __dumpAuditLogsForTests(); assertEqual(Array.isArray(out), true, 'array esperado'); } }
  ];
}
