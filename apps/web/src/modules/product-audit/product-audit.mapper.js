const ISSUE_LABELS = {
  missing_image: 'Sem imagem',
  missing_category: 'Sem categoria',
  invalid_price: 'Preço inválido',
  inactive_product: 'Inativo',
  missing_variation: 'Sem variação',
  missing_variations: 'Sem variação',
  missing_factory: 'Sem fábrica',
  missing_fabricante: 'Sem fábrica',
  zero_stock: 'Estoque zerado',
  estoque_zerado: 'Estoque zerado',
  variation_without_image: 'Variação sem imagem',
  variation_without_stock: 'Variação sem estoque',
  duplicate_sku: 'Duplicado',
  duplicated: 'Duplicado'
};

const ISSUE_TOOLTIPS = {
  missing_image: 'Sem imagem: o produto não possui imagem principal cadastrada.',
  missing_category: 'Sem categoria: o produto ainda não está classificado.',
  invalid_price: 'Preço inválido: o valor informado é zero ou negativo.',
  inactive_product: 'Produto inativo: está desativado no catálogo.',
  missing_variation: 'Sem variação: o produto precisa de ao menos uma variação.',
  missing_variations: 'Sem variação: o produto precisa de ao menos uma variação.',
  missing_factory: 'Sem fábrica: não existe vínculo com fabricante.',
  missing_fabricante: 'Sem fábrica: não existe vínculo com fabricante.',
  zero_stock: 'Estoque zerado: o estoque está em zero ou negativo.',
  estoque_zerado: 'Estoque zerado: o estoque está em zero ou negativo.',
  variation_without_image: 'Variação sem imagem: pelo menos uma variação está sem imagem cadastrada.',
  variation_without_stock: 'Variação sem estoque: pelo menos uma variação está com estoque em zero ou negativo.',
  duplicate_sku: 'SKU duplicado: esse SKU aparece em mais de um produto.',
  duplicated: 'Duplicado: existe outro item repetido no catálogo.'
};

export function mapProductAuditSummaryData(response = {}) {
  return response || {};
}

function normalizeIssue(issue) {
  return ISSUE_LABELS[issue] || issue.replace(/_/g, ' ');
}

export function getProductAuditIssueLabel(issue) {
  return normalizeIssue(issue);
}

export function getProductAuditIssueTooltip(issue) {
  return ISSUE_TOOLTIPS[issue] || normalizeIssue(issue);
}

export function getProductAuditIssueSeverity(issue) {
  if (['duplicate_sku', 'missing_factory', 'missing_fabricante', 'missing_variation', 'missing_variations'].includes(issue)) return 'high';
  if (['invalid_price', 'zero_stock', 'estoque_zerado'].includes(issue)) return 'medium';
  return 'low';
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
      issuesExibicao: Array.isArray(item?.issues) ? item.issues.map(normalizeIssue) : [],
      issuesRaw: Array.isArray(item?.issues) ? item.issues : []
    }))
  };
}
