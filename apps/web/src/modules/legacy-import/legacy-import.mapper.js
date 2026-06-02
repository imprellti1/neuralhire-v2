export function mapLegacyImportStatusResponse(response = {}) {
  return {
    enabled: Boolean(response.enabled),
    environment: response.environment || 'unknown',
    stagingEnabled: Boolean(response.stagingEnabled),
    stagingTables: Array.isArray(response.stagingTables) ? response.stagingTables : [],
    supportedEntities: Array.isArray(response.supportedEntities) ? response.supportedEntities : [],
    mode: response.mode || 'preview',
    warnings: Array.isArray(response.warnings) ? response.warnings : []
  };
}

export function mapLegacyImportBatchSummary(batch = {}) {
  return {
    id: batch.id || '',
    status: batch.status || 'unknown',
    source: batch.source || '',
    dryRun: Boolean(batch.dry_run ?? batch.dryRun),
    createdAt: batch.created_at || batch.createdAt || '',
    summary: batch.summary || null,
    approval: batch.approval || {
      status: batch.status || 'unknown',
      approvedBy: batch.approved_by || null,
      approvedAt: batch.approved_at || null,
      rejectedBy: batch.rejected_by || null,
      rejectedAt: batch.rejected_at || null,
      reason: batch.rejection_reason || null
    }
  };
}

export function mapLegacyImportBatchReport(report = {}) {
  return {
    batchId: report.batchId || '',
    summary: report.summary || { created: {}, updated: {}, skipped: {}, failed: {} },
    integrity: report.integrity || { orphanOrders: 0, orphanItems: 0, missingCustomers: 0, missingProducts: 0, missingVendors: 0, missingManufacturers: 0 },
    warnings: Array.isArray(report.warnings) ? report.warnings : [],
    errors: Array.isArray(report.errors) ? report.errors : [],
    generatedAt: report.generatedAt || ''
  };
}
