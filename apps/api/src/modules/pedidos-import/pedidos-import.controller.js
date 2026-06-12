import { Buffer } from 'node:buffer';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, ForbiddenError } from '../../core/errors.js';
import { executePedidosImport, previewPedidosImport } from './pedidos-import.repository.js';

function assertContextAccount(context = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'pedidos-import' });
  return accountId;
}

function cleanBody(body = {}) {
  const clone = { ...(body || {}) };
  delete clone.account_id; delete clone.accountId; delete clone.tenant_id; delete clone.tenantId;
  return clone;
}

function parseBase64File(file) {
  if (!file) return null;
  if (Buffer.isBuffer(file)) return file;
  if (file?.buffer && Buffer.isBuffer(file.buffer)) return file.buffer;
  if (file?.content && Buffer.isBuffer(file.content)) return file.content;
  if (file?.base64) return Buffer.from(String(file.base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (typeof file === 'string') return Buffer.from(String(file).replace(/^data:[^;]+;base64,/, ''), 'base64');
  return null;
}

function resolveBody(context = {}) {
  const body = cleanBody(context.body || {});
  const nested = cleanBody(body.body || {});
  return { ...nested, ...body };
}

export async function previewPedidosImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const body = resolveBody(context);
  const file = body.file || body.arquivo || body.xlsx || null;
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'pedidos-import' });
  return previewPedidosImport({ accountId, fileName: file.fileName || file.filename || 'Pedidos.xlsx', buffer });
}

export async function executePedidosImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const body = resolveBody(context);
  const importToken = body.importToken || body.import_token || body.token || null;
  if (!importToken) throw new BadRequestError('importToken obrigatorio', { domain: 'pedidos-import' });
  return executePedidosImport({ accountId, importToken });
}

