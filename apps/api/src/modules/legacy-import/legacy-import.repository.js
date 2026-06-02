import { ForbiddenError } from '../../core/errors.js';
import { env } from '../../config/env.js';

const memoryLegacyImports = [];

function assertAllowed(context) {
  const runtimeEnv = process.env.NODE_ENV || env.NODE_ENV;
  if (runtimeEnv === 'production') {
    throw new ForbiddenError('Importacao bloqueada em producao', { code: 'LEGACY_IMPORT_BLOCKED', domain: 'legacy-import' });
  }
  const role = String(context?.auth?.role || '').toLowerCase();
  if (!['admin', 'manager', 'super_admin'].includes(role)) {
    throw new ForbiddenError('Role insuficiente', { code: 'FORBIDDEN_ROLE', domain: 'legacy-import' });
  }
  if (!context?.auth?.accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'legacy-import' });
  }
}

export function getLegacyImportStatus(context = {}) {
  const runtimeEnv = process.env.NODE_ENV || env.NODE_ENV;
  const enabled = runtimeEnv !== 'production' && Boolean(context?.auth?.accountId);
  return { enabled, environment: runtimeEnv, mode: enabled ? 'execute' : 'preview', warnings: enabled ? [] : ['Importacao bloqueada ou sem tenant'] };
}

export async function previewLegacyImport(payload = {}, context = {}) {
  assertAllowed(context);
  return true;
}

export async function executeLegacyImport(payload = {}, context = {}) {
  assertAllowed(context);
  const record = { type: 'execute', accountId: context.auth.accountId, payload };
  memoryLegacyImports.push(record);
  return record;
}

export function __dumpLegacyImportMemory() {
  return memoryLegacyImports.map((item) => ({ ...item }));
}

export function __resetLegacyImportMemory() {
  memoryLegacyImports.length = 0;
}
