import { getClienteById } from '../clientes/clientes.repository.js';
import { getProdutoById } from '../produtos/produtos.repository.js';
import { getBatch, getBatchIssues, getBatchRecords, updateBatchFields, updateBatchSummary } from './legacy-import-staging.repository.js';
import { promoteLegacyImportBatch } from './legacy-import-promoter.js';

function emptyReport(batchId) {
  return {
    batchId,
    summary: { created: {}, updated: {}, skipped: {}, failed: {} },
    integrity: {
      orphanOrders: 0,
      orphanItems: 0,
      missingCustomers: 0,
      missingProducts: 0,
      missingVendors: 0,
      missingManufacturers: 0
    },
    warnings: [],
    errors: []
  };
}

function recordStatusBucket(report, bucket, entity) {
  report.summary[bucket][entity] = (report.summary[bucket][entity] || 0) + 1;
}

async function safeExists(resolver, id, options) {
  if (!id) return false;
  try {
    await resolver(id, options);
    return true;
  } catch {
    return false;
  }
}

export async function validatePromotion(batchId, context = {}) {
  const accountId = context.accountId || null;
  const batch = await getBatch(batchId, { accountId });
  const records = await getBatchRecords(batchId, { accountId });
  const issues = await getBatchIssues(batchId, { accountId });
  const report = emptyReport(batchId);

  report.warnings.push(...issues.filter((issue) => issue.severity === 'warning').map((issue) => ({ entity: issue.entity, message: issue.message, code: issue.code })));
  report.errors.push(...issues.filter((issue) => issue.severity === 'error').map((issue) => ({ entity: issue.entity, message: issue.message, code: issue.code })));

  for (const record of records) {
    const entity = String(record.entity || '');
    const payload = record.normalized_payload || {};
    const isImported = String(record.status || '') === 'imported';
    if (isImported) recordStatusBucket(report, 'updated', entity);
    else recordStatusBucket(report, 'created', entity);

    if (entity === 'pedidos' && !payload.cliente_id) {
      report.integrity.orphanOrders += 1;
      report.errors.push({ entity, code: 'MISSING_CUSTOMER', message: 'Pedido sem cliente vinculado' });
    }
    if (entity === 'pedidoItens' && (!payload.pedido_id || !payload.produto_id)) {
      report.integrity.orphanItems += 1;
      report.errors.push({ entity, code: 'MISSING_LINK', message: 'Item sem pedido ou produto vinculado' });
    }
    if (entity === 'clientes' && !String(payload.account_id || batch.account_id || '').trim()) report.integrity.missingCustomers += 1;
    if (entity === 'produtos' && Number(payload.preco) < 0) report.errors.push({ entity, code: 'NEGATIVE_PRICE', message: 'Produto com preco negativo' });
    if (entity === 'vendedores' && !String(payload.nome || '').trim()) report.integrity.missingVendors += 1;
    if (entity === 'fabricantes' && !String(payload.nome || '').trim()) report.integrity.missingManufacturers += 1;
  }

  return report;
}

export async function buildPromotionReport(batchId, context = {}) {
  const accountId = context.accountId || null;
  const report = await validatePromotion(batchId, { accountId });
  const batch = await getBatch(batchId, { accountId });
  const records = await getBatchRecords(batchId, { accountId });
  const clienteRefs = records.filter((record) => record.entity === 'pedidos').map((record) => record.normalized_payload?.cliente_id).filter(Boolean);
  const produtoRefs = records.filter((record) => record.entity === 'pedidoItens').map((record) => record.normalized_payload?.produto_id).filter(Boolean);
  for (const id of clienteRefs) {
    if (!(await safeExists(getClienteById, id, { accountId: batch.account_id || accountId }))) report.integrity.missingCustomers += 1;
  }
  for (const id of produtoRefs) {
    if (!(await safeExists(getProdutoById, id, { accountId: batch.account_id || accountId }))) report.integrity.missingProducts += 1;
  }
  report.generatedAt = new Date().toISOString();
  return report;
}

export async function auditPromotion(batchId, context = {}) {
  const accountId = context.accountId || null;
  const report = await buildPromotionReport(batchId, { accountId });
  const batch = await getBatch(batchId, { accountId });
  await updateBatchFields(batchId, { promotion_summary: report.summary, promotion_report: report, last_audit_at: report.generatedAt }, { accountId });
  await updateBatchSummary(batchId, {
    ...(batch.summary || {}),
    promotion_summary: report.summary,
    promotion_report: report,
    last_audit_at: report.generatedAt
  }, { accountId });
  return report;
}

export async function promoteWithAudit(batchId, context = {}) {
  const report = await auditPromotion(batchId, context);
  const result = await promoteLegacyImportBatch(batchId, context);
  return { ...result, promotion_report: report };
}
