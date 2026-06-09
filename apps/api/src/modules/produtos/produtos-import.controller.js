import { Buffer } from 'node:buffer';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, ForbiddenError } from '../../core/errors.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';
import { previewImportXlsx, executeImportXlsx } from './produtos-import.repository.js';

function assertContextAccount(context = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produtos-import' });
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
  if (Array.isArray(file)) {
    return parseBase64File(file[0] || null);
  }
  if (file?.base64) {
    return Buffer.from(String(file.base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  }
  if (typeof file === 'string') {
    return Buffer.from(String(file).replace(/^data:[^;]+;base64,/, ''), 'base64');
  }
  return null;
}

function resolveFabricanteId(context = {}) {
  const body = cleanBody(context.body || {});
  const nestedBody = cleanBody(body.body || {});
  const merged = { ...nestedBody, ...body };
  return merged.fabricante_id || merged.fabricanteId || merged.fabricante?.id || null;
}

function resolveImportFile(context = {}) {
  const body = cleanBody(context.body || {});
  const nestedBody = cleanBody(body.body || {});
  const merged = { ...nestedBody, ...body };
  return merged.file || merged.arquivo || merged.xlsx || null;
}

async function ensureFabricante(accountId, fabricanteId) {
  const fabricante = await getFabricanteById(fabricanteId, { accountId }).catch(() => null);
  if (!fabricante) throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import' });
  return fabricante;
}

export async function previewProdutosImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const body = cleanBody(context.body || {});
  const fabricanteId = resolveFabricanteId(context);
  const file = resolveImportFile(context);
  console.log('[produtos-import] preview received', {
    requestId: context.requestId || null,
    fabricanteId,
    bodyKeys: Object.keys(body || {}),
    hasFile: Boolean(file),
    fileKeys: file && typeof file === 'object' ? Object.keys(file) : []
  });
  if (!fabricanteId) throw new BadRequestError('fabricante_id obrigatorio', { domain: 'produtos-import' });
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'produtos-import' });
  await ensureFabricante(accountId, fabricanteId);
  return previewImportXlsx({ accountId, fabricanteId, fileName: file.fileName || file.filename || 'import.xlsx', buffer });
}

export async function executeProdutosImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const fabricanteId = resolveFabricanteId(context);
  const file = resolveImportFile(context);
  if (!fabricanteId) throw new BadRequestError('fabricante_id obrigatorio', { domain: 'produtos-import' });
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'produtos-import' });
  await ensureFabricante(accountId, fabricanteId);
  return executeImportXlsx({ accountId, fabricanteId, fileName: file.fileName || file.filename || 'import.xlsx', buffer });
}
