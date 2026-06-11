import assert from 'node:assert/strict';
import test from 'node:test';
import { __resetAiDirectorMemoryForTests, createAiDirectorEvent, getAiDirectorOverview } from './ai-director.repository.js';

test('ai director overview starts with seed agents', () => {
  __resetAiDirectorMemoryForTests();
  const overview = getAiDirectorOverview();
  assert.equal(overview.gerentes.length, 5);
  assert.equal(overview.gerentes[0].nome, 'Diretor IA');
});

test('product event without image generates recommendation', () => {
  __resetAiDirectorMemoryForTests();
  const item = createAiDirectorEvent({ tipo: 'produto editado', entidade: 'produto', titulo: 'Produto sem imagem', resumo: 'Sem imagem principal', metadata: { sem_imagem: true } });
  const overview = getAiDirectorOverview();
  assert.equal(item.criticidade, 'baixa');
  assert.equal(overview.recomendacoesPendentes.length, 1);
  assert.match(overview.recomendacoesPendentes[0].descricao, /imagem principal/i);
});
