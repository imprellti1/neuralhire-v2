function normalizePrice(rawValue) {
  const cleaned = String(rawValue || '').trim().replace(/\s/g, '');
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  return Number(normalized);
}

function normalizeMultiploVenda(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return 1;
  const value = Number(rawValue);
  return Number.isInteger(value) && value >= 1 ? value : NaN;
}

export function mapProdutoCreatePayload(form = {}) {
  const preco = normalizePrice(form.preco);
  const status = String(form.status || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
  return {
    nome: String(form.nome || '').trim(),
    descricao: String(form.descricao || '').trim() || undefined,
    sku: String(form.sku || '').trim() || undefined,
    categoria_id: String(form.categoria_id || '').trim() || undefined,
    fabricante_id: form.fabricante_id ? String(form.fabricante_id).trim() : null,
    preco,
    preco_promocional: Number.isFinite(Number(form.preco_promocional)) ? Number(form.preco_promocional) : undefined,
    icms_percentual: Number.isFinite(Number(form.icms_percentual)) ? Number(form.icms_percentual) : undefined,
    multiplo_venda: normalizeMultiploVenda(form.multiplo_venda),
    video_url: String(form.video_url || '').trim() || undefined,
    preco_unitario: preco,
    status,
    ativo: status === 'ativo'
  };
}

export function validateProdutoCreateForm(form = {}) {
  const fieldErrors = {};
  if (!String(form.nome || '').trim()) fieldErrors.nome = 'Nome do produto é obrigatório.';
  const preco = normalizePrice(form.preco);
  if (!String(form.preco || '').trim()) fieldErrors.preco = 'Preço é obrigatório.';
  else if (!Number.isFinite(preco)) fieldErrors.preco = 'Preço inválido. Use 129,90 ou 129.90.';
  else if (preco <= 0) fieldErrors.preco = 'Preço deve ser maior que zero.';
  const multiploVenda = String(form.multiplo_venda || '').trim();
  if (multiploVenda) {
    const normalized = normalizeMultiploVenda(multiploVenda);
    if (!Number.isFinite(normalized)) fieldErrors.multiplo_venda = 'Múltiplo de venda deve ser um inteiro maior ou igual a 1.';
  }
  return fieldErrors;
}
