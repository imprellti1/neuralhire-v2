function asDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapFabricantesData(response = {}) {
  const items = Array.isArray(response?.items) ? response.items : [];
  return {
    items: items.map((item) => ({
      ...item,
      nomeExibicao: item?.nome || '-',
      cnpjExibicao: item?.cnpj || '-',
      statusExibicao: item?.status || '-',
      pedidoMinimoExibicao: Number((item?.pedido_minimo_valor ?? item?.pedido_minimo) || 0),
      pedidoMinimoItensExibicao: Number(item?.pedido_minimo_itens || 0),
      prazoEntregaDiasExibicao: Number(item?.prazo_entrega_dias || 0),
      comissaoExibicao: Number(item?.comissao_padrao_percentual || 0),
      semLogo: !item?.logo_url,
      createdAtDate: asDate(item?.created_at || item?.createdAt)
    })),
    pagination: {
      page: Number(response?.page ?? response?.pagination?.page ?? 1),
      limit: Number(response?.limit ?? response?.pagination?.limit ?? 20),
      total: Number(response?.total ?? response?.pagination?.total ?? items.length),
      totalPages: Number(response?.totalPages ?? response?.pagination?.totalPages ?? 1)
    }
  };
}
