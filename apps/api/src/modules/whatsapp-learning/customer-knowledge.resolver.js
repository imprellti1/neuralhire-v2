function cleanText(value) { return String(value ?? '').trim(); }

function uniqueWords(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((item) => cleanText(item)).filter(Boolean))];
}

function extractTokens(value) {
  return uniqueWords(cleanText(value).split(/[,;/|]\s*|\s+/g)).filter((token) => token.length > 1);
}

function normalizeSpace(value) {
  return cleanText(value).replace(/\s+/g, ' ');
}

function mergeTextValue(previousValue, nextValue) {
  const left = normalizeSpace(previousValue);
  const right = normalizeSpace(nextValue);
  if (!left) return right;
  if (!right) return left;
  if (left.toLowerCase() === right.toLowerCase()) return left;
  return uniqueWords([left, right]).join(' | ');
}

function appendTextValue(previousValue, nextValue) {
  const left = normalizeSpace(previousValue);
  const right = normalizeSpace(nextValue);
  if (!left) return right;
  if (!right) return left;
  if (left.toLowerCase() === right.toLowerCase()) return left;
  return `${left}\n- ${right}`;
}

function unionTextValue(previousValue, nextValue) {
  return uniqueWords([
    ...extractTokens(previousValue),
    ...extractTokens(nextValue)
  ]).join(', ');
}

function equivalentValue(left, right) {
  return normalizeSpace(left).toLowerCase() === normalizeSpace(right).toLowerCase();
}

function resolveStrategy(knowledgeKey, previousValue, nextValue) {
  const normalizedKey = String(knowledgeKey || '').trim();
  const strategies = {
    endereco_localizacao: 'replace',
    preferencia_contato: 'replace',
    preferencia_entrega: 'merge',
    interesse_produto: 'union',
    objecao_comercial: 'union',
    reclamacao: 'append',
    condicao_comercial: 'replace',
    informacao_operacional: 'merge'
  };
  let strategy = strategies[normalizedKey] || 'merge';
  if (normalizedKey === 'condicao_comercial') {
    const nextTokens = extractTokens(nextValue);
    const prevTokens = extractTokens(previousValue);
    strategy = nextTokens.length > prevTokens.length ? 'merge' : 'replace';
  }
  return strategy;
}

export function resolveCustomerKnowledgeUpdate({ knowledgeKey, previousValue, nextValue }) {
  const strategy = resolveStrategy(knowledgeKey, previousValue, nextValue);
  if (equivalentValue(previousValue, nextValue)) {
    return {
      strategy,
      changed: false,
      value: previousValue,
      updatedReason: `${strategy}:${String(knowledgeKey || 'general').trim() || 'general'}`
    };
  }

  let value = nextValue;
  if (strategy === 'merge') value = mergeTextValue(previousValue, nextValue);
  else if (strategy === 'union') value = unionTextValue(previousValue, nextValue);
  else if (strategy === 'append') value = appendTextValue(previousValue, nextValue);
  else value = normalizeSpace(nextValue);

  return {
    strategy,
    changed: !equivalentValue(previousValue, value),
    value,
    updatedReason: `${strategy}:${String(knowledgeKey || 'general').trim() || 'general'}`
  };
}
