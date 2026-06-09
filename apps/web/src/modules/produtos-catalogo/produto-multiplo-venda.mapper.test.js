import test from 'node:test';
import assert from 'node:assert/strict';
import { mapProdutoCreatePayload } from './produto-create.mapper.js';
import { createProdutoEditForm, mapProdutoDetailsData, mapProdutoUpdatePayload } from './produto-details.mapper.js';

test('produto mappers normalizam multiplo_venda com fallback 1', () => {
  const createPayload = mapProdutoCreatePayload({ nome: 'Produto', preco: '10,00' });
  assert.equal(createPayload.multiplo_venda, 1);

  const updatePayload = mapProdutoUpdatePayload({ nome: 'Produto', preco: '10,00' });
  assert.equal(updatePayload.multiplo_venda, 1);

  const detail = mapProdutoDetailsData({ item: { id: 'p1', nome: 'Produto', preco: 10, multiplo_venda: 3 } });
  assert.equal(detail.multiploVenda, 3);

  const form = createProdutoEditForm(detail);
  assert.equal(form.multiplo_venda, '3');
});

test('produto mappers rejeitam multiplo_venda invalido', () => {
  const createPayload = mapProdutoCreatePayload({ nome: 'Produto', preco: '10,00', multiplo_venda: 'abc' });
  assert.ok(Number.isNaN(createPayload.multiplo_venda));

  const updatePayload = mapProdutoUpdatePayload({ nome: 'Produto', preco: '10,00', multiplo_venda: 1.5 });
  assert.ok(Number.isNaN(updatePayload.multiplo_venda));
});
