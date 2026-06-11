import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { createIaMemoria, deleteIaMemoria, getIaMemoriaById, listIaMemorias, searchIaMemorias, updateIaMemoria } from './ia-memorias.repository.js';

function stripAccountBody(body = {}) { const copy = { ...(body || {}) }; delete copy.account_id; delete copy.accountId; return copy; }
export async function getIaMemoriasHandler(context = {}) { const accountId = getAccountIdFromContext(context); const result = await listIaMemorias(context.query || {}, { accountId }); return { ok: true, items: result.items, total: result.total }; }
export async function getIaMemoriaHandler(context = {}) { const accountId = getAccountIdFromContext(context); return { ok: true, item: await getIaMemoriaById(context.params?.id, { accountId }) }; }
export async function createIaMemoriaHandler(context = {}) { const accountId = getAccountIdFromContext(context); return { ok: true, item: await createIaMemoria(stripAccountBody(context.body || {}), { accountId }) }; }
export async function patchIaMemoriaHandler(context = {}) { const accountId = getAccountIdFromContext(context); return { ok: true, item: await updateIaMemoria(context.params?.id, stripAccountBody(context.body || {}), { accountId }) }; }
export async function deleteIaMemoriaHandler(context = {}) { const accountId = getAccountIdFromContext(context); return { ok: true, item: await deleteIaMemoria(context.params?.id, { accountId }) }; }
export async function searchIaMemoriasHandler(context = {}) { const accountId = getAccountIdFromContext(context); const result = await searchIaMemorias(context.body || {}, { accountId }); return { ok: true, items: result.items, total: result.total }; }

