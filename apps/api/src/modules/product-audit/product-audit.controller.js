import { fixProductAudit, getAuditProductDetail, getAuditProducts, getAuditSummary, linkProductFabricante } from './product-audit.analyzer.js';

export async function getSummary(context) { return getAuditSummary(context); }
export async function getProducts(context) { return getAuditProducts(context); }
export async function getProduct(context) { return getAuditProductDetail(context); }
export async function patchFabricante(context) { return linkProductFabricante(context); }
export async function patchFix(context) { return fixProductAudit(context); }
