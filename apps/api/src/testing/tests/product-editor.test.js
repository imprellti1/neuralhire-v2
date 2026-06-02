import assert from 'node:assert/strict';
import { createProduto, __resetMemoryProdutosForTests } from '../../modules/produtos/produtos.repository.js';
import { createFabricante, __resetMemoryFabricantesForTests } from '../../modules/fabricantes/fabricantes.repository.js';
import { __resetMemoryProductEditorForTests, createVariation, getProductEditorProduct, listProductEditorProducts, listVariations, updateProductEditorProduct, updateVariation, updateVariationImage } from '../../modules/product-editor/product-editor.repository.js';

export function getProductEditorTests() {
  return [
    { name: 'lista produtos', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryFabricantesForTests(); __resetMemoryProductEditorForTests();
      await createProduto({ nome: 'Produto 1', sku: 'SKU1' }, { accountId: 'acc-1' });
      const result = await listProductEditorProducts({}, { accountId: 'acc-1' });
      assert.equal(result.total, 1);
    } },
    { name: 'detalhe produto', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryFabricantesForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 2', sku: 'SKU2' }, { accountId: 'acc-1' });
      const detail = await getProductEditorProduct(created.id, { accountId: 'acc-1' });
      assert.equal(detail.nome, 'Produto 2');
    } },
    { name: 'edita produto', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryFabricantesForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 3', sku: 'SKU3' }, { accountId: 'acc-1' });
      const updated = await updateProductEditorProduct(created.id, { nome: 'Produto 3B', preco: 9 }, { accountId: 'acc-1' });
      assert.equal(updated.nome, 'Produto 3B');
    } },
    { name: 'bloqueia preço negativo', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 4', sku: 'SKU4' }, { accountId: 'acc-1' });
      await assert.rejects(() => updateProductEditorProduct(created.id, { preco: -1 }, { accountId: 'acc-1' }));
    } },
    { name: 'bloqueia nome vazio', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 5', sku: 'SKU5' }, { accountId: 'acc-1' });
      await assert.rejects(() => updateProductEditorProduct(created.id, { nome: '' }, { accountId: 'acc-1' }));
    } },
    { name: 'vincula fabricante', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryFabricantesForTests(); __resetMemoryProductEditorForTests();
      const fab = await createFabricante({ nome: 'Fab 1' }, { accountId: 'acc-1' });
      const created = await createProduto({ nome: 'Produto 6', sku: 'SKU6' }, { accountId: 'acc-1' });
      const updated = await updateProductEditorProduct(created.id, { fabricanteId: fab.id }, { accountId: 'acc-1' });
      assert.equal(updated.fabricanteId, fab.id);
    } },
    { name: 'atualiza imagem', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 7', sku: 'SKU7' }, { accountId: 'acc-1' });
      const updated = await updateProductEditorProduct(created.id, { imagemUrl: 'https://img.test/a.jpg' }, { accountId: 'acc-1' });
      assert.equal(updated.imagemUrl, 'https://img.test/a.jpg');
    } },
    { name: 'cria variação', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 8', sku: 'SKU8' }, { accountId: 'acc-1' });
      const variation = await createVariation(created.id, { sku: 'VAR1', cor: 'Azul', tamanho: 'M', estoque: 1, preco: 10 }, { accountId: 'acc-1' });
      assert.equal(variation.sku, 'VAR1');
    } },
    { name: 'edita variação', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 9', sku: 'SKU9' }, { accountId: 'acc-1' });
      const variation = await createVariation(created.id, { sku: 'VAR2' }, { accountId: 'acc-1' });
      const updated = await updateVariation(created.id, variation.id, { cor: 'Vermelho' }, { accountId: 'acc-1' });
      assert.equal(updated.cor, 'Vermelho');
    } },
    { name: 'atualiza imagem da variação', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 10', sku: 'SKU10' }, { accountId: 'acc-1' });
      const variation = await createVariation(created.id, { sku: 'VAR3' }, { accountId: 'acc-1' });
      const updated = await updateVariationImage(created.id, variation.id, { imagemUrl: 'https://img.test/v.jpg' }, { accountId: 'acc-1' });
      assert.equal(updated.imagemUrl, 'https://img.test/v.jpg');
    } },
    { name: 'bloqueia estoque negativo', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 11', sku: 'SKU11' }, { accountId: 'acc-1' });
      await assert.rejects(() => createVariation(created.id, { sku: 'VAR4', estoque: -1 }, { accountId: 'acc-1' }));
    } },
    { name: 'tenant isolation', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 12', sku: 'SKU12' }, { accountId: 'acc-1' });
      await assert.rejects(() => getProductEditorProduct(created.id, { accountId: 'acc-2' }));
    } },
    { name: 'ignora account_id malicioso', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 13', sku: 'SKU13' }, { accountId: 'acc-1' });
      const updated = await updateProductEditorProduct(created.id, { nome: 'Produto 13B', account_id: 'hack' }, { accountId: 'acc-1' });
      assert.equal(updated.nome, 'Produto 13B');
    } },
    { name: 'não sobrescreve campo válido com vazio', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 14', sku: 'SKU14', descricao: 'Existe' }, { accountId: 'acc-1' });
      const updated = await updateProductEditorProduct(created.id, { descricao: '' }, { accountId: 'acc-1' });
      assert.equal(updated.descricao, 'Existe');
    } },
    { name: 'lista variações', run: async () => {
      __resetMemoryProdutosForTests(); __resetMemoryProductEditorForTests();
      const created = await createProduto({ nome: 'Produto 15', sku: 'SKU15' }, { accountId: 'acc-1' });
      await createVariation(created.id, { sku: 'VAR15' }, { accountId: 'acc-1' });
      const variations = await listVariations(created.id, { accountId: 'acc-1' });
      assert.equal(variations.length, 1);
    } }
  ];
}
