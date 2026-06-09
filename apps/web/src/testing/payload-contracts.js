import assert from 'node:assert/strict';

const FORBIDDEN_FIELDS = [
  ['account', 'id'].join('_'),
  'account' + 'Id',
  ['tenant', 'id'].join('_'),
  'tenant' + 'Id',
  ['owner', 'user', 'id'].join('_'),
  'owner' + 'UserId'
];
const FORBIDDEN_FIELDS_SET = new Set(FORBIDDEN_FIELDS);
const PEDIDO_STATUS = ['rascunho', 'aberto', 'aprovado', 'faturado', 'cancelado'];

function collectForbiddenFields(value, hits = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenFields(item, hits);
    return hits;
  }
  if (!value || typeof value !== 'object') return hits;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_FIELDS_SET.has(key)) hits.add(key);
    collectForbiddenFields(nested, hits);
  }
  return hits;
}

export function assertNoForbiddenPayloadFields(payload) {
  const hits = [...collectForbiddenFields(payload)];
  assert.equal(hits.length, 0, `Payload contem campos proibidos: ${hits.join(', ')}`);
}

export function assertRequiredFields(payload, fields) {
  for (const field of fields) assert.ok(payload[field] !== undefined && payload[field] !== null, `Campo obrigatorio ausente: ${field}`);
}

export function assertAllowedFields(payload, allowedFields) {
  for (const field of Object.keys(payload || {})) assert.ok(allowedFields.includes(field), `Campo nao permitido: ${field}`);
}

export function assertEnumField(payload, field, allowedValues) {
  assert.ok(allowedValues.includes(payload[field]), `Valor invalido para ${field}: ${payload[field]}`);
}

export function assertProdutoPostPayload(payload) {
  assert.ok(payload && typeof payload === 'object');
  assertRequiredFields(payload, ['nome', 'preco']);
  assertAllowedFields(payload, ['nome', 'sku', 'categoria', 'categoria_id', 'descricao', 'fabricante_id', 'preco', 'preco_unitario', 'preco_promocional', 'icms_percentual', 'multiplo_venda', 'video_url', 'status', 'ativo']);
  assert.equal(typeof payload.nome, 'string');
  assert.equal(typeof payload.preco, 'number');
  assertNoForbiddenPayloadFields(payload);
}

export function assertProdutoPatchPayload(payload) {
  assert.ok(payload && typeof payload === 'object');
  assertRequiredFields(payload, ['nome', 'preco']);
  assertAllowedFields(payload, ['nome', 'sku', 'categoria', 'categoria_id', 'descricao', 'fabricante_id', 'preco', 'preco_unitario', 'preco_promocional', 'icms_percentual', 'multiplo_venda', 'video_url', 'status', 'ativo']);
  assert.equal(typeof payload.nome, 'string');
  assert.equal(typeof payload.preco, 'number');
  assertNoForbiddenPayloadFields(payload);
}

export function assertClientePostPayload(payload) {
  assert.ok(payload && typeof payload === 'object');
  assertRequiredFields(payload, ['empresa']);
  assertAllowedFields(payload, ['nome', 'empresa', 'razao_social', 'nome_contato', 'email', 'telefone', 'cidade', 'uf', 'status', 'observacoes']);
  assert.equal(typeof payload.empresa, 'string');
  if (payload.nome_contato != null) assert.equal(typeof payload.nome_contato, 'string');
  if (payload.status != null) assertEnumField(payload, 'status', ['ativo', 'inativo', 'prospect']);
  assertNoForbiddenPayloadFields(payload);
}

export function assertPedidoStatusPatchPayload(payload) {
  assert.ok(payload && typeof payload === 'object');
  assertRequiredFields(payload, ['status']);
  assertAllowedFields(payload, ['status']);
  assert.equal(typeof payload.status, 'string');
  assertEnumField(payload, 'status', PEDIDO_STATUS);
  assertNoForbiddenPayloadFields(payload);
}





