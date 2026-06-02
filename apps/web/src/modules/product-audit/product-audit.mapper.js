export function mapProductAuditSummaryData(response = {}) {
  return response || {};
}

export function mapProductAuditItemsData(response = {}) {
  const items = Array.isArray(response?.items) ? response.items : [];
  return {
    ...response,
    items: items.map((item) => ({
      ...item,
      produtoExibicao: item?.nome || '-',
      skuExibicao: item?.sku || '-',
      fabricanteExibicao: item?.fabricanteNome || '-',
      categoriaExibicao: item?.categoria || '-',
      precoExibicao: Number(item?.preco ?? item?.preco_unitario ?? 0),
      estoqueExibicao: Number(item?.estoque || 0),
      statusExibicao: item?.status || (item?.ativo === false ? 'inativo' : 'ativo'),
      issuesExibicao: Array.isArray(item?.issues) ? item.issues.join(', ') : ''
    }))
  };
}
