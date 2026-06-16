import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, ForbiddenError } from '../../core/errors.js';
import { executePedidosItensImport, previewPedidosItensImport } from './pedidos-itens.repository.js';

const previewSessions = new Map();

function assertContextAccount(context = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'pedidos-itens' });
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

function resolveImportToken(body = {}) {
  return body.importToken || body.import_token || body.token || null;
}

export async function previewPedidosItensImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const body = resolveBody(context);
  const file = body.file || body.arquivo || body.xlsx || null;
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'pedidos-itens' });
  const fileName = file?.fileName || file?.filename || body.fileName || body.filename || null;
  if (!fileName) throw new BadRequestError('Nome do arquivo obrigatorio para identificar o pedido', { domain: 'pedidos-itens' });
  const preview = await previewPedidosItensImport({ accountId, fileName, buffer });
  const importToken = randomUUID();
  previewSessions.set(importToken, { accountId, fileName, buffer, createdAt: new Date().toISOString() });
  return { ...preview, importToken };
}

export async function executePedidosItensImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const body = resolveBody(context);
  const importToken = resolveImportToken(body);
  if (importToken) {
    const session = previewSessions.get(String(importToken));
    if (!session || String(session.accountId || '') !== String(accountId)) {
      throw new BadRequestError('Prévia da importação não encontrada.', { domain: 'pedidos-itens', code: 'IMPORT_TOKEN_INVALID' });
    }
    return executePedidosItensImport({ accountId, fileName: session.fileName, buffer: session.buffer });
  }
  const file = body.file || body.arquivo || body.xlsx || null;
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'pedidos-itens' });
  const fileName = file?.fileName || file?.filename || body.fileName || body.filename || null;
  if (!fileName) throw new BadRequestError('Nome do arquivo obrigatorio para identificar o pedido', { domain: 'pedidos-itens' });
  return executePedidosItensImport({ accountId, fileName, buffer });
}
