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
      assert.equal(summary.totalProdutos, 1);
      assert.equal(summary.comProblemas, 1);
      assert.equal(summary.semFabrica, 1);
      assert.equal(summary.inativos, 0);
      assert.equal(summary.criticos, 1);
      assert.equal(summary.medios, 0);
      assert.equal(summary.leves, 1);
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
      __loadMemoryProdutos([
        { id: 'p1', account_id: 'acc-1', nome: '', sku: '', categoria: '', preco: 0, estoque: 0, status: 'inativo' },
        { id: 'p2', account_id: 'acc-1', nome: 'Produto 2', sku: 'SKU2', categoria: 'Cat', preco: 10, estoque: 1, status: 'ativo' }
      ]);
      const defaultResult = await listAuditProducts({}, { accountId: 'acc-1' });
      assert.equal(defaultResult.items.length, 1);
      assert.equal(defaultResult.pagination.total, 1);
      assert.equal(defaultResult.summary.totalProdutos, 1);
      assert.equal(defaultResult.items[0].id, 'p2');
      const result = await listAuditProducts({ issue: 'missing_name' }, { accountId: 'acc-1' });
      assert.equal(result.items.length, 0);
      const inactive = await listAuditProducts({ status: 'inativo' }, { accountId: 'acc-1' });
      assert.equal(inactive.items.length, 1);
      assert.equal(inactive.pagination.total, 1);
      assert.equal(inactive.summary.totalProdutos, 1);
      assert.equal(inactive.items[0].id, 'p1');
    } },
    { name: 'summary accepts filters and matches list summary format', run: async () => {
      reset();
      __loadMemoryProdutos([
        { id: 'p1', account_id: 'acc-1', nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 0, status: 'ativo' },
        { id: 'p2', account_id: 'acc-1', nome: 'Produto 2', sku: 'SKU2', categoria: 'Cat', preco: 10, estoque: 5, status: 'inativo' }
      ]);
      const summary = await auditSummary({ accountId: 'acc-1', filters: { status: 'inativo' } });
      assert.equal(summary.totalProdutos, 1);
      assert.equal(summary.comProblemas, 1);
      assert.equal(summary.inativos, 1);
      assert.equal(summary.estoqueZerado, 0);
      assert.equal(summary.medios, 0);
      assert.equal(summary.criticos, 0);
    } },
    { name: 'list orders by severity, issue count and name', run: async () => {
      reset();
      __loadMemoryProdutos([
        { id: 'p1', account_id: 'acc-1', nome: 'Produto C', sku: 'SKU1', categoria: null, preco: 10, estoque: 5, status: 'ativo', variacoes: [] },
        { id: 'p2', account_id: 'acc-1', nome: 'Produto A', sku: 'SKU2', categoria: 'Cat', preco: 0, estoque: 0, status: 'ativo' },
        { id: 'p3', account_id: 'acc-1', nome: 'Produto B', sku: 'SKU3', categoria: 'Cat', preco: 0, estoque: 0, status: 'ativo' }
      ]);
      const result = await listAuditProducts({}, { accountId: 'acc-1' });
      assert.equal(result.items[0].nome, 'Produto A');
      assert.equal(result.items[1].nome, 'Produto B');
      assert.equal(result.items[2].nome, 'Produto C');
    } },
    { name: 'list paginates items while keeping full summary', run: async () => {
      reset();
      __loadMemoryProdutos(Array.from({ length: 25 }, (_, idx) => ({
        id: `p${idx + 1}`,
        account_id: 'acc-1',
        nome: `Produto ${String(idx + 1).padStart(2, '0')}`,
        sku: `SKU${idx + 1}`,
        categoria: 'Cat',
        preco: 10,
        estoque: 5,
        status: 'ativo'
      })));
      const result = await listAuditProducts({ page: 1, limit: 20 }, { accountId: 'acc-1' });
      assert.equal(result.items.length, 20);
      assert.equal(result.pagination.total, 25);
      assert.equal(result.pagination.totalPages, 2);
      assert.equal(result.summary.totalProdutos, 25);
      assert.equal(result.summary.comProblemas, 25);
    } }
  ];
}
