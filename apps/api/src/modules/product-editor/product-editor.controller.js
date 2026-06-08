import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { adjustVariationStock, createVariation, getProductEditorProduct, getVariationById, listProductEditorProducts, listVariationMovements, listVariations, updateProductEditorImages, updateProductEditorProduct, updateVariation, updateVariationImage } from './product-editor.repository.js';

export async function getProductEditorProducts(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const query = context.query || {};
  return { ok: true, ...await listProductEditorProducts({ search: query.search, fabricanteId: query.fabricanteId, categoria: query.categoria, status: query.status, page: Number(query.page || 1), limit: Number(query.limit || 20) }, { accountId }) };
}

export async function getProductEditorProductHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await getProductEditorProduct(context.params?.productId, { accountId }) };
}

export async function patchProductEditorProductHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const body = { ...(context.body || {}) };
  delete body.account_id; delete body.accountId; delete body.tenant_id; delete body.tenantId; delete body.owner_user_id; delete body.ownerUserId;
  return { ok: true, item: await updateProductEditorProduct(context.params?.productId, body, { accountId }) };
}

export async function patchProductEditorImagesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await updateProductEditorImages(context.params?.productId, context.body || {}, { accountId }) };
}

export async function getProductEditorVariationsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, items: await listVariations(context.params?.productId, { accountId }) };
}

export async function createProductEditorVariationHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await createVariation(context.params?.productId, context.body || {}, { accountId }) };
}

export async function patchProductEditorVariationHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await updateVariation(context.params?.productId, context.params?.variationId, context.body || {}, { accountId }) };
}

export async function patchProductEditorVariationImageHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await updateVariationImage(context.params?.productId, context.params?.variationId, context.body || {}, { accountId }) };
}

export async function patchProductEditorVariationStockHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await adjustVariationStock(context.params?.productId, context.params?.variationId, context.body || {}, { accountId, fabricanteId: context.body?.fabricante_id || context.body?.fabricanteId || null }) };
}

export async function getProductEditorVariationMovementsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, items: await listVariationMovements(context.params?.productId, context.params?.variationId, { accountId }) };
}

export async function getProductEditorVariationHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, item: await getVariationById(context.params?.productId, context.params?.variationId, { accountId }) };
}
