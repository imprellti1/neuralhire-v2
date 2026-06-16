function stripAccents(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeText(value) {
  return stripAccents(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function extractSkuBase(codigoProdutoErpOriginal) {
  const text = String(codigoProdutoErpOriginal ?? '').trim();
  if (!text) return null;
  const firstPart = text.split('.')[0]?.trim();
  return firstPart || null;
}

export function buildExpectedSku(skuBase, tamanhoOriginal) {
  const base = String(skuBase ?? '').trim();
  const size = String(tamanhoOriginal ?? '').trim();
  if (!base || !size) return null;
  return `${base}-${size}`;
}

function normalizeComparable(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

export function classifyVariationMatch({ candidates = [], corOriginal, tamanhoOriginal }) {
  const normalizedCor = normalizeComparable(corOriginal);
  const normalizedTamanho = normalizeComparable(tamanhoOriginal);

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { status_vinculo: 'nao_encontrado', motivo_vinculo: 'Nenhuma variacao candidata encontrada', matchedCandidate: null };
  }

  const compatible = candidates.filter((candidate) => {
    const candidateCor = normalizeComparable(candidate?.cor ?? candidate?.cor_original ?? candidate?.corNome);
    const candidateTamanho = normalizeComparable(candidate?.tamanho ?? candidate?.grade ?? candidate?.valor);
    const corOk = !normalizedCor || !candidateCor || candidateCor === normalizedCor;
    const tamanhoOk = !normalizedTamanho || !candidateTamanho || candidateTamanho === normalizedTamanho;
    return corOk && tamanhoOk;
  });

  if (compatible.length === 0) {
    return { status_vinculo: 'nao_encontrado', motivo_vinculo: 'Candidatos encontrados, mas cor/tamanho divergentes', matchedCandidate: null };
  }

  if (compatible.length > 1) {
    return { status_vinculo: 'ambiguo', motivo_vinculo: 'Mais de uma variacao compativel encontrada', matchedCandidate: null };
  }

  return { status_vinculo: 'vinculado', motivo_vinculo: null, matchedCandidate: compatible[0] };
}
