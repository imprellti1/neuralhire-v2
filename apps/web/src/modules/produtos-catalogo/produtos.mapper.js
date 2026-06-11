function asDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapProdutosData(response = {}) {
  const rawItems = Array.isArray(response?.items) ? response.items : [];

  const items = rawItems.map((item) => ({
    ...item,
    produtoExibicao: item?.nome || item?.produto || item?.title || '-',
    skuExibicao: item?.sku || item?.codigo || '-',
    categoriaExibicao: item?.categoria_nome || item?.categoria || item?.category || '-',
    fabricanteExibicao: item?.fabricante_nome || item?.fabricante?.nome || 'Sem fábrica',
    precoExibicao: Number(item?.preco ?? item?.price ?? 0),
    statusExibicao: item?.status || item?.situacao || '-',
    criadoEmExibicao: asDate(item?.created_at || item?.createdAt || item?.criado_em)
  }));

  const page = Number(response?.pagination?.page ?? response?.page ?? 1) || 1;
  const limit = Number(response?.pagination?.limit ?? response?.limit ?? 10) || 10;
  const total = Number(response?.pagination?.total ?? response?.pagination?.totalItems ?? response?.pagination?.count ?? response?.total ?? items.length ?? 0) || 0;
  const totalPagesFromApi = Number(response?.pagination?.totalPages ?? response?.totalPages ?? 0) || 0;
  const totalPages = totalPagesFromApi > 0 ? totalPagesFromApi : Math.max(1, Math.ceil(Math.max(total, items.length, 1) / limit));

  return {
    items,
    pagination: { page, limit, total, totalPages }
  };
}
