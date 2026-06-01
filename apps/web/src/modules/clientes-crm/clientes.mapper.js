function asDate(value) {
  const d = new Date(value || '');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapClientesData(response = {}, search = '') {
  const rawItems = Array.isArray(response?.items) ? response.items : [];
  const query = String(search || '').trim().toLowerCase();

  const items = rawItems
    .map((item) => ({
      ...item,
      empresaExibicao: item?.empresa || item?.razao_social || item?.nome || '-',
      razaoSocialExibicao: item?.razao_social || '-',
      contatoExibicao: item?.nome_contato || item?.nome || '-',
      telefoneExibicao: item?.telefone || '-',
      cidadeExibicao: item?.cidade || '-',
      ufExibicao: item?.estado || item?.uf || '-',
      statusExibicao: item?.status || '-',
      criadoEmExibicao: asDate(item?.created_at || item?.createdAt)
    }))
    .filter((item) => {
      if (!query) return true;
      return [item?.empresa, item?.razao_social, item?.nome_contato]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });

  return {
    items,
    pagination: {
      page: Number(response?.pagination?.page ?? response?.page ?? 1),
      limit: Number(response?.pagination?.limit ?? response?.limit ?? 10),
      total: Number(response?.pagination?.total ?? response?.pagination?.totalItems ?? response?.pagination?.count ?? response?.total ?? items.length ?? 0),
      totalPages: Number(response?.pagination?.totalPages ?? response?.totalPages ?? Math.max(1, Math.ceil((Number(response?.pagination?.total ?? response?.total ?? items.length ?? 0) || items.length || 1) / (Number(response?.pagination?.limit ?? response?.limit ?? 10) || 10))))
    }
  };
}

