function asDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? null : d;
}
function normalizeStatus(rawStatus, ativo) {
  const s = String(rawStatus || '').toLowerCase();
  if (s === 'ativo' || ativo === true) return 'Ativo';
  if (s === 'inativo' || ativo === false) return 'Inativo';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '-';
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
    statusExibicao: normalizeStatus(item?.status || item?.situacao, item?.ativo),
    temPromocaoVariacao: Boolean(item?.tem_promocao_variacao || item?.temPromocaoVariacao || item?.variacoes_em_promocao || item?.variacao_em_promocao || item?.has_promo_variation || item?.hasPromocaoVariacao),
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
