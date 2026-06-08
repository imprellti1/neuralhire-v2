import { mapProductEditorList } from './product-editor.mapper.js';

function cleanBody(body = {}) {
  const copy = { ...body };
  for (const key of ['account', 'Id', 'tenant', 'owner']) {
    const snake = key === 'account' ? 'account_' + 'id' : key === 'tenant' ? 'tenant_' + 'id' : 'owner_user_' + 'id';
    const camel = key + 'Id';
    delete copy[snake];
    delete copy[camel];
  }
  return copy;
}

export async function fetchProductEditorProducts(apiClient, filters = {}) {
  return mapProductEditorList(await apiClient.get('/produtos', filters));
}
export async function fetchProductEditorProduct(apiClient, productId) { return apiClient.get(`/produtos/${productId}`); }
export async function fetchProductEditorVariations(apiClient, productId) { return apiClient.get(`/product-editor/products/${productId}/variations`); }
export async function fetchProductEditorVariation(apiClient, productId, variationId) { return apiClient.get(`/product-editor/products/${productId}/variations/${variationId}`); }
export async function fetchProductEditorVariationMovements(apiClient, productId, variationId) { return apiClient.get(`/product-editor/products/${productId}/variations/${variationId}/movements`); }
export async function saveProductEditorProduct(apiClient, productId, body) { return apiClient.patch(`/produtos/${productId}`, cleanBody(body)); }
export async function saveProductEditorImages(apiClient, productId, body) { return apiClient.patch(`/produtos/${productId}`, cleanBody(body)); }
export async function createProductEditorVariation(apiClient, productId, body) { return apiClient.post(`/product-editor/products/${productId}/variations`, cleanBody(body)); }
export async function updateProductEditorVariation(apiClient, productId, variationId, body) { return apiClient.patch(`/product-editor/products/${productId}/variations/${variationId}`, cleanBody(body)); }
export async function updateProductEditorVariationImage(apiClient, productId, variationId, body) { return apiClient.patch(`/product-editor/products/${productId}/variations/${variationId}/image`, cleanBody(body)); }
export async function updateProductEditorVariationStock(apiClient, productId, variationId, body) { return apiClient.patch(`/product-editor/products/${productId}/variations/${variationId}/stock`, cleanBody(body)); }
