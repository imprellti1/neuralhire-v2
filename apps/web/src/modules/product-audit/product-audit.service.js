import { mapProductAuditItemsData, mapProductAuditSummaryData } from './product-audit.mapper.js';

export async function fetchProductAuditSummary(apiClient) {
  return mapProductAuditSummaryData(await apiClient.get('/product-audit/summary'));
}

export async function fetchProductAuditProducts(apiClient, params = {}) {
  return mapProductAuditItemsData(await apiClient.get('/product-audit/products', params));
}

export async function fetchProductAuditProductsWithSummary(apiClient, params = {}) {
  return mapProductAuditItemsData(await apiClient.get('/product-audit/products', params));
}

export async function fetchProductAuditDetail(apiClient, id) {
  return apiClient.get(`/product-audit/products/${id}`);
}

export async function saveProductAuditFabricante(apiClient, id, fabricanteId) {
  return apiClient.patch(`/product-audit/products/${id}/fabricante`, { fabricanteId });
}

export async function saveProductAuditFix(apiClient, id, payload) {
  return apiClient.patch(`/product-audit/products/${id}/fix`, payload);
}

export async function fetchProductAuditFabricantes(apiClient) {
  return apiClient.get('/fabricantes', { limit: 100 });
}
