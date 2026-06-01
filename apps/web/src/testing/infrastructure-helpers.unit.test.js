import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertTransportSnapshot,
  loadTransportSnapshot,
  writeTransportSnapshot
} from './transport-snapshot.js';
import {
  assertNoForbiddenPayloadFields,
  assertRequiredFields,
  assertAllowedFields,
  assertEnumField,
  assertProdutoPostPayload,
  assertProdutoPatchPayload,
  assertClientePostPayload,
  assertPedidoStatusPatchPayload
} from './payload-contracts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotsDir = path.join(__dirname, 'snapshots');

const sensitiveKeys = [
  ['account', 'id'].join('_'),
  'account' + 'Id',
  ['tenant', 'id'].join('_'),
  'tenant' + 'Id',
  ['owner', 'user', 'id'].join('_'),
  'owner' + 'UserId'
];

function tempSnapshotName(suffix) {
  return `tmp-stage45-${Date.now()}-${Math.random().toString(16).slice(2)}-${suffix}`;
}

function writeGolden(name, data) {
  const file = path.join(snapshotsDir, `${name}.transport.snapshot.json`);
  fs.mkdirSync(snapshotsDir, { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return file;
}

test('transport snapshot válido sem divergência', () => {
  const name = tempSnapshotName('ok');
  const calls = [{ method: 'POST', path: '/v1/produtos', query: {}, headers: {}, body: { nome: 'A', preco: 10 } }];
  writeTransportSnapshot(name, calls);
  assert.doesNotThrow(() => assertTransportSnapshot(name, calls));
});

test('transport snapshot detecta quantidade de chamadas diferente', () => {
  const name = tempSnapshotName('count');
  writeGolden(name, [{ method: 'GET', path: '/x', query: {}, headers: {}, body: null }]);
  assert.throws(() => assertTransportSnapshot(name, []), (err) => {
    assert.match(err.message, /Snapshot .* divergiu: quantidade esperada=1, recebida=0/);
    return true;
  });
});

test('transport snapshot detecta campo divergente com mensagem completa', () => {
  const name = tempSnapshotName('field');
  writeGolden(name, [{ method: 'PATCH', path: '/v1/pedidos/1/status', query: {}, headers: {}, body: { status: 'aprovado' } }]);
  const received = [{ method: 'PATCH', path: '/v1/pedidos/1/status', query: {}, headers: {}, body: { status: 'cancelado' } }];

  assert.throws(() => assertTransportSnapshot(name, received), (err) => {
    assert.match(err.message, new RegExp(`Snapshot ${name}`));
    assert.match(err.message, /chamada #0/);
    assert.match(err.message, /campo body/);
    assert.match(err.message, /caminho body\.status/);
    assert.match(err.message, /Esperado="aprovado"/);
    assert.match(err.message, /Recebido="cancelado"/);
    return true;
  });
});

test('transport snapshot bloqueia conteúdo sensível ao carregar golden inválido', () => {
  const name = tempSnapshotName('golden-sensitive');
  writeGolden(name, [{ method: 'GET', path: '/x', query: {}, headers: { Authorization: 'Bearer abc' }, body: null }]);
  assert.throws(() => loadTransportSnapshot(name), /dados sensiveis/);
});

test('transport snapshot bloqueia conteúdo sensível ao validar recebido', () => {
  const name = tempSnapshotName('received-sensitive');
  writeGolden(name, [{ method: 'GET', path: '/x', query: {}, headers: {}, body: null }]);
  const calls = [{ method: 'GET', path: '/x', query: {}, headers: { Authorization: 'Bearer abc' }, body: null }];
  assert.throws(() => assertTransportSnapshot(name, calls), /dados sensiveis/);
});

test('transport snapshot bloqueia conteúdo sensível ao escrever snapshot', () => {
  const name = tempSnapshotName('write-sensitive');
  const calls = [{ method: 'POST', path: '/x', query: {}, headers: {}, body: { token: 'abc' } }];
  assert.throws(() => writeTransportSnapshot(name, calls), /dados sensiveis/);
});

test('payload helpers genéricos cobrem sucesso e erro', () => {
  assert.doesNotThrow(() => assertNoForbiddenPayloadFields({ a: 1, nested: { b: 2 } }));
  assert.throws(() => assertNoForbiddenPayloadFields({ [sensitiveKeys[0]]: 'x' }), /campos proibidos/);

  assert.doesNotThrow(() => assertRequiredFields({ nome: 'X', preco: 1 }, ['nome', 'preco']));
  assert.throws(() => assertRequiredFields({ nome: 'X' }, ['nome', 'preco']), /Campo obrigatorio ausente: preco/);

  assert.doesNotThrow(() => assertAllowedFields({ nome: 'X', preco: 1 }, ['nome', 'preco']));
  assert.throws(() => assertAllowedFields({ nome: 'X', extra: 1 }, ['nome']), /Campo nao permitido: extra/);

  assert.doesNotThrow(() => assertEnumField({ status: 'ativo' }, 'status', ['ativo', 'inativo']));
  assert.throws(() => assertEnumField({ status: 'x' }, 'status', ['ativo']), /Valor invalido para status: x/);
});

test('contrato Produto POST aceita campos reais', () => {
  assert.doesNotThrow(() => assertProdutoPostPayload({
    nome: 'Produto 1', sku: 'P-001', categoria: 'Categoria', descricao: 'Desc', preco: 10, preco_unitario: 9.5, status: 'ativo', ativo: true
  }));
});

test('contrato Produto PATCH aceita campos reais do Produto 360°', () => {
  assert.doesNotThrow(() => assertProdutoPatchPayload({
    nome: 'Produto 2', sku: 'P-002', categoria: 'Categoria', descricao: 'Desc', preco: 20, status: 'inativo', ativo: false
  }));
});

test('contratos Cliente POST e Pedido status PATCH aceitam payload válido', () => {
  assert.doesNotThrow(() => assertClientePostPayload({
    nome: 'Cliente', empresa: 'Empresa SA', razao_social: 'Empresa SA', nome_contato: 'Contato', email: 'a@b.com', telefone: '11999999999', cidade: 'SP', uf: 'SP', status: 'ativo', observacoes: 'ok'
  }));
  assert.doesNotThrow(() => assertPedidoStatusPatchPayload({ status: 'aprovado' }));
});

test('contratos rejeitam campos sensíveis', () => {
  for (const field of sensitiveKeys) {
    assert.throws(() => assertNoForbiddenPayloadFields({ [field]: 'x' }), /campos proibidos/);
  }
});
