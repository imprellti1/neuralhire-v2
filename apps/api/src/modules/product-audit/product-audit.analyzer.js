import { auditSummary, fixProduct, getAuditProduct, linkFabricante, listAuditProducts } from './product-audit.repository.js';

export async function getAuditSummary(context) {
  return auditSummary({ accountId: context.accountId, filters: context.query || {} });
}

export async function getAuditProducts(context) {
  return listAuditProducts(context.query || {}, { accountId: context.accountId });
}

export async function getAuditProductDetail(context) {
  return getAuditProduct(context.params.productId, { accountId: context.accountId });
}

export async function linkProductFabricante(context) {
  return linkFabricante(context.params.productId, context.body?.fabricanteId || null, { accountId: context.accountId });
}

export async function fixProductAudit(context) {
  return fixProduct(context.params.productId, context.body || {}, { accountId: context.accountId });
}
