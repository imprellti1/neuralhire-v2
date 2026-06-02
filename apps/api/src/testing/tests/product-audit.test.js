import assert from 'node:assert/strict';
import { __loadMemoryProdutos, __resetMemoryProdutosForTests } from '../../modules/produtos/produtos.repository.js';
import { __loadMemoryFabricantes, __resetMemoryFabricantesForTests } from '../../modules/fabricantes/fabricantes.repository.js';
import { __dumpMemoryProductAuditLinks, __resetMemoryProductAuditForTests, auditSummary, fixProduct, getAuditProduct, listAuditProducts, linkFabricante } from '../../modules/product-audit/product-audit.repository.js';

function reset() {
  __resetMemoryProdutosForTests();
  __resetMemoryFabricantesForTests();
  __resetMemoryProductAuditForTests();
}

export function getProductAuditTests() {
  return [
    { name: 'summary and issues', run: async () => {
      reset();
      __loadMemoryFabricantes([{ id: 'fab-1', account_id: 'acc-1', nome: 'Fabrica 1' }]);
      __loadMemoryProdutos([
        { id: 'p1', account_id: 'acc-1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 0, status: 'ativo' },
        { id: 'p2', account_id: 'acc-1', nome: 'Produto 1', sku: 'SKU1', categoria: null, preco: 0, estoque: 1, status: 'inativo' }
      ]);
      const summary = await auditSummary({ accountId: 'acc-1' });
      assert.equal(summary.totalProducts, 2);
      assert.equal(summary.withoutFabricante, 2);
      assert.ok(summary.issues.some((issue) => issue.type === 'missing_fabricante'));
      assert.ok(summary.issues.some((issue) => issue.type === 'duplicate_sku'));
    } },
    { name: 'link fabricante and fix product', run: async () => {
      reset();
      __loadMemoryFabricantes([{ id: 'fab-1', account_id: 'acc-1', nome: 'Fabrica 1' }]);
      __loadMemoryProdutos([{ id: 'p1', account_id: 'acc-1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 5, status: 'ativo' }]);
      await linkFabricante('p1', 'fab-1', { accountId: 'acc-1' });
      await fixProduct('p1', { nome: 'Produto 1 A', sku: 'SKU1A', categoria: 'Nova', preco: 20, status: 'inativo', imagemUrl: 'img' }, { accountId: 'acc-1' });
      const item = await getAuditProduct('p1', { accountId: 'acc-1' });
      assert.equal(item.fabricanteId, 'fab-1');
      assert.equal(item.nome, 'Produto 1 A');
      assert.equal(item.status, 'inativo');
      assert.equal(__dumpMemoryProductAuditLinks().length, 1);
    } },
    { name: 'tenant isolation and malicious account ignored', run: async () => {
      reset();
      __loadMemoryProdutos([{ id: 'p1', account_id: 'acc-1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 5, status: 'ativo' }]);
      await assert.rejects(() => getAuditProduct('p1', { accountId: 'acc-2' }));
    } },
    { name: 'list filters by issue', run: async () => {
      reset();
      __loadMemoryProdutos([{ id: 'p1', account_id: 'acc-1', nome: '', sku: '', categoria: '', preco: 0, estoque: 0, status: 'inativo' }]);
      const result = await listAuditProducts({ issue: 'missing_name' }, { accountId: 'acc-1' });
      assert.equal(result.items.length, 1);
    } }
  ];
}
