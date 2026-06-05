import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, NotFoundError, ValidationError } from '../../core/errors.js';
import { canAccessAllTenantData } from '../../core/commercial-scope.js';
import { createVendedor, getVendedorById, listVendedorFabricantes, listVendedores, replaceVendedorFabricantes, updateVendedor, updateVendedorStatus } from './vendedores.repository.js';

function parseBoolean(value) { if (value === true || value === 'true') return true; if (value === false || value === 'false') return false; return undefined; }
function assertAdminLike(context) { if (!canAccessAllTenantData(context) && String(context?.auth?.role || '').toLowerCase() !== 'account_admin') throw new BadRequestError('Acesso restrito a administracao', { domain: 'vendedores' }); }

export async function getVendedores(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); const q = context.query || {}; const result = await listVendedores({ page: q.page ? Number(q.page) : undefined, limit: q.limit ? Number(q.limit) : undefined, search: q.search, status: q.status }, { accountId }); return { ok: true, pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages }, items: result.items }; }
export async function getVendedor(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); const id = String(context?.params?.id || '').trim(); if (!id) throw new ValidationError('Parametro id obrigatorio', { domain: 'vendedores' }); return { ok: true, item: await getVendedorById(id, { accountId }) }; }
export async function createVendedorHandler(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); const item = await createVendedor(context.body || {}, { accountId }); return { ok: true, item }; }
export async function updateVendedorHandler(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); const item = await updateVendedor(context.params.id, context.body || {}, { accountId }); return { ok: true, item }; }
export async function updateVendedorStatusHandler(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); const item = await updateVendedorStatus(context.params.id, context.body?.status, { accountId }); return { ok: true, item }; }
export async function getVendedorFabricantesHandler(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); return { ok: true, ...(await listVendedorFabricantes(context.params.id, { accountId })) }; }
export async function updateVendedorFabricantesHandler(context = {}) { const accountId = getAccountIdFromContext(context); assertAdminLike(context); const result = await replaceVendedorFabricantes(context.params.id, context.body?.fabricante_ids || [], { accountId }); return { ok: true, ...result }; }
