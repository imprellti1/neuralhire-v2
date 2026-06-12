import { Buffer } from 'node:buffer';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, ForbiddenError } from '../../core/errors.js';
import { executeClientesImport, previewClientesImport } from './clientes-import.repository.js';

function assertContextAccount(context = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'clientes-import' });
  return accountId;
}

function cleanBody(body = {}) {
  const clone = { ...(body || {}) };
  delete clone.account_id; delete clone.accountId; delete clone.tenant_id; delete clone.tenantId; delete clone.owner_user_id; delete clone.ownerUserId;
  return clone;
}

function parseBase64File(file) {
  if (!file) return null;
  if (Buffer.isBuffer(file)) return file;
  if (file?.buffer && Buffer.isBuffer(file.buffer)) return file.buffer;
  if (file?.content && Buffer.isBuffer(file.content)) return file.content;
  if (file?.data && Buffer.isBuffer(file.data)) return file.data;
  if (Array.isArray(file)) return parseBase64File(file[0] || null);
  if (file?.base64) return Buffer.from(String(file.base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (typeof file === 'string') return Buffer.from(String(file).replace(/^data:[^;]+;base64,/, ''), 'base64');
  return null;
}

function resolveImportFile(context = {}) {
  const body = cleanBody(context.body || {});
  const nestedBody = cleanBody(body.body || {});
  const merged = { ...nestedBody, ...body };
  return merged.file || merged.arquivo || merged.xlsx || null;
}

function resolveImportToken(context = {}) {
  const body = cleanBody(context.body || {});
  const nestedBody = cleanBody(body.body || {});
  const merged = { ...nestedBody, ...body };
  return merged.importToken || merged.import_token || merged.token || null;
}

export async function previewClientesImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const file = resolveImportFile(context);
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'clientes-import' });
  return previewClientesImport({ accountId, fileName: file.fileName || file.filename || 'Clientes_288.xlsx', buffer });
}

export async function executeClientesImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const importToken = resolveImportToken(context);
  if (!importToken) throw new BadRequestError('importToken obrigatorio', { domain: 'clientes-import' });
  return executeClientesImport({ accountId, importToken });
}
