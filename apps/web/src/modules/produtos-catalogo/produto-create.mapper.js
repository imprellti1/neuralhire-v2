function normalizePrice(rawValue) {
  const cleaned = String(rawValue || '').trim().replace(/\s/g, '');
  if (!cleaned) return NaN;
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  return Number(normalized);
}

export function mapProdutoCreatePayload(form = {}) {
  const preco = normalizePrice(form.preco);
  const status = String(form.status || 'ativo').trim().toLowerCase() === 'inativo' ? 'inativo' : 'ativo';
  return {
    nome: String(form.nome || '').trim(),
    descricao: String(form.descricao || '').trim() || undefined,
    sku: String(form.sku || '').trim() || undefined,
    categoria: String(form.categoria || '').trim() || undefined,
    fabricante_id: form.fabricante_id ? String(form.fabricante_id).trim() : null,
    preco,
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
  return fieldErrors;
}
