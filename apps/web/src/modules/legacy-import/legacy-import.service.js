export async function getLegacyImportStatus(apiClient) {
  return apiClient.get('/legacy-import/status');
}

export async function validateLegacyImport(apiClient, payload) {
  return apiClient.post('/legacy-import/validate', payload);
}

export async function previewLegacyImport(apiClient, payload) {
  return apiClient.post('/legacy-import/preview', payload);
}

export async function executeLegacyImport(apiClient, payload) {
  return apiClient.post('/legacy-import/execute', payload);
}

export async function listLegacyImportBatches(apiClient) {
  return apiClient.get('/legacy-import/batches');
}

export async function getLegacyImportBatch(apiClient, batchId) {
  return apiClient.get(`/legacy-import/batches/${batchId}`);
}

export async function getLegacyImportBatchRecords(apiClient, batchId) {
  return apiClient.get(`/legacy-import/batches/${batchId}/records`);
}

export async function getLegacyImportBatchIssues(apiClient, batchId) {
  return apiClient.get(`/legacy-import/batches/${batchId}/issues`);
}

export async function approveLegacyImportBatch(apiClient, batchId) {
  return apiClient.post(`/legacy-import/batches/${batchId}/approve`, {});
}

export async function rejectLegacyImportBatch(apiClient, batchId, payload) {
  return apiClient.post(`/legacy-import/batches/${batchId}/reject`, payload);
}

export async function promoteLegacyImportBatch(apiClient, batchId) {
  return apiClient.post(`/legacy-import/batches/${batchId}/promote`, {});
}

export async function auditLegacyImportBatch(apiClient, batchId) {
  return apiClient.get(`/legacy-import/batches/${batchId}/audit`);
}

export async function getLegacyImportBatchReport(apiClient, batchId) {
  return apiClient.get(`/legacy-import/batches/${batchId}/report`);
}
