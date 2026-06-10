export function calculatePrecoPromocional(precoBase, percentualDesconto) {
  const base = Number(precoBase || 0);
  const desconto = Number(percentualDesconto || 0);
  if (!Number.isFinite(base) || !Number.isFinite(desconto)) return 0;
  return Math.max(0, Number((base - base * desconto / 100).toFixed(2)));
}

export function resolveVariacaoPrecoBase(variacao = {}, produtoPai = {}) {
  const ownPrice = Number(variacao?.preco ?? variacao?.preco_unitario ?? variacao?.valor ?? NaN);
  if (Number.isFinite(ownPrice) && ownPrice > 0) return ownPrice;

  const parentPrice = Number(
    produtoPai?.preco ??
    produtoPai?.precoAtual ??
    produtoPai?.preco_unitario ??
    produtoPai?.precoBase ??
    produtoPai?.preco_base ??
    NaN
  );
  return Number.isFinite(parentPrice) && parentPrice > 0 ? parentPrice : 0;
}

export function mapPromocoesData(response) {
  const items = Array.isArray(response?.items) ? response.items : [];
  return { items: items.map((item) => ({
    ...item,
    variacoesSelecionadas: Array.isArray(item.variacoesSelecionadas) ? item.variacoesSelecionadas : [],
    percentual_desconto: item.percentual_desconto === null || item.percentual_desconto === undefined ? null : Number(item.percentual_desconto)
  })) };
}
