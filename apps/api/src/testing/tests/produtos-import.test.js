import test from 'node:test';
import assert from 'node:assert/strict';
import { ProdutosImportQueries } from '../../database/queries/produtos-import.queries.js';
import { __buildProductParentActiveStateForTests, __buildVariationIdentityForTests, splitDescricaoProdutoExport } from '../../modules/produtos/produtos-import.repository.js';

test('produtos import query catalog exposes batch and variation statements', () => {
  assert.match(ProdutosImportQueries.createBatch(), /INSERT INTO produto_import_batches/i);
  assert.match(ProdutosImportQueries.updateBatch(), /UPDATE produto_import_batches/i);
  assert.match(ProdutosImportQueries.findBatchById(), /FROM produto_import_batches/i);
  assert.match(ProdutosImportQueries.upsertVariation(), /ON CONFLICT \(account_id, produto_id, nome, grade\)/i);
});

test('produtos import helpers preserve variation identity and active state contract', () => {
  const identity = __buildVariationIdentityForTests({ account_id: 'a', produto_id: 'p', nome: 'Cor / G', grade: 'G' });
  assert.deepEqual(identity, { accountId: 'a', produtoId: 'p', nome: 'Cor / G', grade: 'G' });
  assert.equal(__buildProductParentActiveStateForTests([{ ativo: true, estoque_atual: 9 }]), false);
  assert.equal(__buildProductParentActiveStateForTests([{ ativo: true, estoque_atual: 10 }]), true);
});

test('produtos import descricao parser keeps legacy split contract', () => {
  assert.deepEqual(splitDescricaoProdutoExport('ABC - Camiseta - Azul'), {
    codigo_erp: 'ABC',
    nome_produto: 'Camiseta',
    cor: 'Azul',
    variacao_nome: 'Azul'
  });
});
