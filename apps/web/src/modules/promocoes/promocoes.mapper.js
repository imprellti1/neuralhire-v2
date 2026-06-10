export function calculatePrecoPromocional(precoBase, percentualDesconto) {
  const base = Number(precoBase || 0);
  const desconto = Number(percentualDesconto || 0);
  if (!Number.isFinite(base) || !Number.isFinite(desconto)) return 0;
  return Math.max(0, Number((base - base * desconto / 100).toFixed(2)));
}

export function mapPromocoesData(response) {
  const items = Array.isArray(response?.items) ? response.items : [];
  return { items: items.map((item) => ({
    ...item,
    variacoesSelecionadas: Array.isArray(item.variacoesSelecionadas) ? item.variacoesSelecionadas : []
  })) };
}

