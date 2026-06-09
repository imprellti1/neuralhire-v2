import { mapProdutoDetailsData, mapProdutoUpdatePayload, mapProdutoUsageData } from './produto-details.mapper.js';

async function tryGet(apiClient, paths) {
  let lastError = null;
  for (const path of paths) {
    try {
      return await apiClient.get(path);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Falha ao carregar recurso');
}

export async function fetchProdutoDetailsData(apiClient, produtoId) {
  const response = await tryGet(apiClient, [
    `/produtos/${produtoId}`,
    `/product-editor/products/${produtoId}`
  ]);
  const hasVariations = [
    response?.item?.variacoes,
    response?.item?.variations,
    response?.variacoes,
    response?.variations,
    response?.item?.produto_variacoes,
    response?.item?.produtoVariacoes
  ].some((value) => Array.isArray(value) && value.length > 0);

  if (hasVariations) return mapProdutoDetailsData(response);

  const variationsResponse = await tryGet(apiClient, [
    `/produtos/${produtoId}/variacoes`,
    `/product-editor/products/${produtoId}`,
    `/product-editor/products/${produtoId}/variations`
  ]).catch(() => null);

  const normalizedVariations = Array.isArray(variationsResponse)
    ? variationsResponse
    : Array.isArray(variationsResponse?.items)
      ? variationsResponse.items
    : Array.isArray(variationsResponse?.data)
        ? variationsResponse.data
        : variationsResponse?.variacoes
          || variationsResponse?.variations
          || variationsResponse?.produto_variacoes
          || variationsResponse?.produtoVariacoes
          || variationsResponse?.item?.variacoes
          || variationsResponse?.item?.variations
          || variationsResponse?.item?.produto_variacoes
          || variationsResponse?.item?.produtoVariacoes
          || [];

  return mapProdutoDetailsData({ ...response, variacoes: normalizedVariations });
}

export async function fetchProdutoImagens(apiClient, produtoId) {
  const response = await apiClient.get(`/produtos/${produtoId}/imagens`);
  return Array.isArray(response?.items) ? response.items : [];
}

export async function uploadProdutoVariacaoImagem(apiClient, variacaoId, payload) {
  return apiClient.post(`/produto-variacoes/${variacaoId}/imagem`, payload);
}

export async function updateProdutoImagem(apiClient, produtoId, imagemId, payload) {
  return apiClient.patch(`/produtos/${produtoId}/imagens/${imagemId}`, payload);
}

export async function deleteProdutoImagem(apiClient, produtoId, imagemId) {
  return apiClient.delete(`/produtos/${produtoId}/imagens/${imagemId}`);
}

export async function updateProduto(apiClient, produtoId, form) {
  const payload = mapProdutoUpdatePayload(form);
  return apiClient.patch(`/produtos/${produtoId}`, payload);
}

export async function fetchProdutoUsageData(apiClient, produtoId) {
  const list = await apiClient.get('/pedidos', { page: 1, limit: 200 });
  const pedidos = Array.isArray(list?.items) ? list.items : [];
  const hydrated = await Promise.all(pedidos.map(async (pedido) => {
    if (Array.isArray(pedido?.itens) && pedido.itens.length) return pedido;
    try {
      const detail = await apiClient.get(`/pedidos/${pedido.id}`);
      return { ...pedido, itens: Array.isArray(detail?.itens) ? detail.itens : [] };
    } catch {
      return { ...pedido, itens: [] };
    }
  }));
  return mapProdutoUsageData(produtoId, hydrated);
}
