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
      pedidoMinimoExibicao: Number(item?.pedido_minimo || 0),
      boletoMinimoExibicao: Number(item?.boleto_minimo || 0),
      comissaoExibicao: Number(item?.comissao_padrao_percentual || 0),
      prazoMaximoExibicao: item?.prazo_maximo_dias ?? '-',
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
