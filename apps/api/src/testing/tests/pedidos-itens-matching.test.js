import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExpectedSku, classifyVariationMatch, extractSkuBase, normalizeText } from '../../modules/pedidos-itens/pedidos-itens.matching.js';

test('extractSkuBase e buildExpectedSku funcionam', () => {
  assert.equal(extractSkuBase('750200010.949.00007'), '750200010');
  assert.equal(buildExpectedSku('750200010', 'UNI'), '750200010-UNI');
});

test('normalizeText ignora acentos, caixa e espacos', () => {
  assert.equal(normalizeText('  AzuL  Marinho '), 'azul marinho');
  assert.equal(normalizeText('PÉQUENO'), 'pequeno');
});

test('classifyVariationMatch retorna nao_encontrado sem candidato', () => {
  const out = classifyVariationMatch({ candidates: [], corOriginal: 'Azul', tamanhoOriginal: 'UNI' });
  assert.equal(out.status_vinculo, 'nao_encontrado');
});

test('classifyVariationMatch vincula candidato correto', () => {
  const out = classifyVariationMatch({
    candidates: [{ id: 'v1', cor: 'Azul', grade: 'UNI' }],
    corOriginal: 'azul',
    tamanhoOriginal: 'uni'
  });
  assert.equal(out.status_vinculo, 'vinculado');
  assert.equal(out.matchedCandidate.id, 'v1');
});

test('classifyVariationMatch retorna ambiguo com multiplos candidatos', () => {
  const out = classifyVariationMatch({
    candidates: [
      { id: 'v1', cor: 'Azul', grade: 'UNI' },
      { id: 'v2', cor: 'Azul', grade: 'UNI' }
    ],
    corOriginal: 'azul',
    tamanhoOriginal: 'uni'
  });
  assert.equal(out.status_vinculo, 'ambiguo');
});

test('classifyVariationMatch rejeita cor divergente com motivo claro', () => {
  const out = classifyVariationMatch({
    candidates: [{ id: 'v1', cor: 'Preto', grade: 'UNI' }],
    corOriginal: 'Azul',
    tamanhoOriginal: 'UNI'
  });
  assert.equal(out.status_vinculo, 'nao_encontrado');
  assert.match(String(out.motivo_vinculo || ''), /divergentes/i);
});
