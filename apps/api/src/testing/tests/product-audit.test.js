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
      const accountId = 'acc-product-audit-summary-issues';
      __loadMemoryFabricantes([{ id: 'fab-1', account_id: accountId, nome: 'Fabrica 1' }]);
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 0, ativo: true },
        { id: 'p2', account_id: accountId, nome: 'Produto 1', sku: 'SKU1', categoria: null, preco: 0, estoque: 1, ativo: false }
      ]);
      const summary = await auditSummary({ accountId });
      assert.equal(summary.totalProdutos, 1);
      assert.equal(summary.comProblemas, 1);
      assert.equal(summary.semFabrica, 1);
      assert.equal(summary.semImagem, 1);
      assert.equal(summary.inativos, 0);
      assert.equal(summary.criticos, 1);
      assert.equal(summary.medios, 0);
      assert.equal(summary.leves, 0);
    } },
    { name: 'link fabricante and fix product', run: async () => {
      reset();
      const accountId = 'acc-product-audit-link-fix';
      __loadMemoryFabricantes([{ id: 'fab-1', account_id: accountId, nome: 'Fabrica 1' }]);
      __loadMemoryProdutos([{ id: 'p1', account_id: accountId, nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 5, ativo: true }]);
      await linkFabricante('p1', 'fab-1', { accountId });
      await fixProduct('p1', { nome: 'Produto 1 A', sku: 'SKU1A', categoria: 'Nova', preco: 20, status: 'inativo', imagemUrl: 'img' }, { accountId });
      const item = await getAuditProduct('p1', { accountId });
      assert.equal(item.fabricanteId, 'fab-1');
      assert.equal(item.nome, 'Produto 1 A');
      assert.equal(item.status, 'inativo');
      assert.equal(__dumpMemoryProductAuditLinks().length, 1);
    } },
    { name: 'tenant isolation and malicious account ignored', run: async () => {
      reset();
      const accountId = 'acc-product-audit-tenant-isolation';
      __loadMemoryProdutos([{ id: 'p1', account_id: accountId, nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 5, status: 'ativo' }]);
      await assert.rejects(() => getAuditProduct('p1', { accountId: 'acc-2' }));
    } },
    { name: 'list filters by issue', run: async () => {
      reset();
      const accountId = 'acc-product-audit-list-filters';
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: '', sku: '', categoria: '', preco: 0, estoque: 0, ativo: false },
        { id: 'p2', account_id: accountId, nome: 'Produto 2', sku: 'SKU2', categoria: 'Cat', preco: 10, estoque: 1, ativo: true }
      ]);
      const defaultResult = await listAuditProducts({}, { accountId });
      assert.equal(defaultResult.items.length, 1);
      assert.equal(defaultResult.pagination.total, 1);
      assert.equal(defaultResult.summary.totalProdutos, 1);
      assert.equal(defaultResult.items[0].id, 'p2');
      const result = await listAuditProducts({ issue: 'missing_fabricante' }, { accountId });
      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].id, 'p2');
      const inactive = await listAuditProducts({ status: 'inativo' }, { accountId });
      assert.equal(inactive.items.length, 1);
      assert.equal(inactive.pagination.total, 1);
      assert.equal(inactive.summary.totalProdutos, 1);
      assert.equal(inactive.items[0].id, 'p1');
    } },
    { name: 'summary accepts filters and matches list summary format', run: async () => {
      reset();
      const accountId = 'acc-product-audit-summary-filters';
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Produto 1', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 0, ativo: true, status: 'inativo', status_comercial: 'inativo' },
        { id: 'p2', account_id: accountId, nome: 'Produto 2', sku: 'SKU2', categoria: 'Cat', preco: 10, estoque: 5, ativo: false, status: 'ativo', status_comercial: 'ativo' },
        { id: 'p3', account_id: accountId, nome: 'Produto 3', sku: 'SKU3', categoria: 'Cat', preco: 10, estoque: 5, status: 'ativo', status_comercial: 'ativo' }
      ]);
      const summary = await auditSummary({ accountId, filters: { status: 'inativo' } });
      assert.equal(summary.totalProdutos, 1);
      assert.equal(summary.comProblemas, 1);
      assert.equal(summary.inativos, 1);
      assert.equal(summary.semFabrica, 1);
      assert.equal(summary.semImagem, 1);
      assert.equal(summary.estoqueZerado, 0);
      assert.equal(summary.medios, 0);
      assert.equal(summary.criticos, 1);
    } },
    { name: 'active normalization keeps problem products in default audit and excludes inactive products', run: async () => {
      reset();
      const accountId = 'acc-product-audit-active-normalization';
      __loadMemoryFabricantes([{ id: 'fab-p5', account_id: accountId, nome: 'Fabrica P5' }]);
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Ativo bool', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 1, ativo: true, imagemUrl: null, variacoes: [{ id: 'v1', sku: 'SKU1-1', estoque: 1 }] },
        { id: 'p2', account_id: accountId, nome: 'Ativo numérico', sku: 'SKU2', categoria: null, preco: 10, estoque: 1, ativo: 1, imagemUrl: 'img', variacoes: [{ id: 'v2', sku: 'SKU2-1', estoque: 1 }] },
        { id: 'p4', account_id: accountId, nome: 'Ativo string', sku: 'SKU4', categoria: 'Cat', preco: 10, estoque: 1, ativo: 'true', imagemUrl: 'img', variacoes: [{ id: 'v4', sku: 'SKU4-1', estoque: 1 }] },
        { id: 'p5', account_id: accountId, nome: 'Status nao governa', sku: 'SKU5', categoria: 'Cat', preco: 10, estoque: 1, ativo: true, status: 'ativo', status_comercial: 'ativo', imagemUrl: 'img', variacoes: [{ id: 'v5', sku: 'SKU5-1', estoque: 1, imagemUrl: 'img' }] },
        { id: 'p3', account_id: accountId, nome: 'Inativo claro', sku: 'SKU3', categoria: 'Cat', preco: 10, estoque: 1, ativo: false, imagemUrl: 'img', variacoes: [{ id: 'v3', sku: 'SKU3-1', estoque: 1 }] },
        { id: 'p6', account_id: accountId, nome: 'Sem ativo', sku: 'SKU6', categoria: 'Cat', preco: 10, estoque: 1, imagemUrl: 'img', variacoes: [{ id: 'v6', sku: 'SKU6-1', estoque: 1 }] }
      ]);
      await linkFabricante('p5', 'fab-p5', { accountId });
      const defaultResult = await listAuditProducts({}, { accountId });
      assert.equal(defaultResult.pagination.total, 3);
      assert.equal(defaultResult.summary.totalProdutos, 3);
      assert.equal(defaultResult.summary.comProblemas, 3);
      assert.equal(defaultResult.summary.semImagem, 1);
      assert.equal(defaultResult.summary.semCategoria, 1);
      assert.equal(defaultResult.summary.inativos, 0);
      assert.equal(defaultResult.items.some((item) => item.id === 'p1'), true);
      assert.equal(defaultResult.items.some((item) => item.id === 'p2'), true);
      assert.equal(defaultResult.items.some((item) => item.id === 'p4'), true);
      assert.equal(defaultResult.items.some((item) => item.id === 'p5'), false);
      assert.equal(defaultResult.items.some((item) => item.id === 'p3'), false);
      assert.equal(defaultResult.items.some((item) => item.id === 'p6'), false);

      const inactiveResult = await listAuditProducts({ status: 'inativo' }, { accountId });
      assert.equal(inactiveResult.pagination.total, 1);
      assert.equal(inactiveResult.summary.totalProdutos, 1);
      assert.equal(inactiveResult.summary.comProblemas, 1);
      assert.equal(inactiveResult.summary.inativos, 1);
      assert.equal(inactiveResult.items[0].id, 'p3');
    } },
    { name: 'variation rules respect active child variations and hide resolved products', run: async () => {
      reset();
      const accountId = 'acc-product-audit-variations';
      __loadMemoryFabricantes([{ id: 'fab-1', account_id: accountId, nome: 'Fabrica 1' }, { id: 'fab-2', account_id: accountId, nome: 'Fabrica 2' }]);
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Pai sem variação', sku: 'SKU-P1', categoria: 'Cat', preco: 10, estoque: 1, ativo: true, imagemUrl: 'img', variacoes: [] },
        { id: 'p2', account_id: accountId, nome: 'Pai com variação', sku: 'SKU-P2', categoria: 'Cat', preco: 10, estoque: 1, ativo: true, imagemUrl: 'img', variacoes: [{ id: 'v2', produto_id: 'p2', sku: 'SKU-P2-1', estoque_atual: 2, ativo: true, imagem_url: 'child.jpg' }] },
        { id: 'p3', account_id: accountId, nome: 'Completo', sku: 'SKU-P3', categoria: 'Cat', preco: 10, estoque: 5, ativo: true, imagemUrl: 'img', variacoes: [{ id: 'v3', produto_id: 'p3', sku: 'SKU-P3-1', estoque_atual: 1, ativo: true, imagem_url: 'child.jpg' }] },
        { id: 'p4', account_id: accountId, nome: 'Sem imagem', sku: 'SKU-P4', categoria: 'Cat', preco: 10, estoque: 5, ativo: true, variacoes: [{ id: 'v4', produto_id: 'p4', sku: 'SKU-P4-1', estoque_atual: 1, ativo: true, imagem_url: 'child.jpg' }] }
      ]);
      await linkFabricante('p2', 'fab-1', { accountId });
      await linkFabricante('p3', 'fab-2', { accountId });
      await linkFabricante('p4', 'fab-1', { accountId });
      const result = await listAuditProducts({}, { accountId });
      assert.equal(result.items.some((item) => item.id === 'p1'), true);
      assert.equal(result.items.some((item) => item.id === 'p2'), false);
      assert.equal(result.items.some((item) => item.id === 'p3'), false);
      assert.equal(result.items.some((item) => item.id === 'p4'), true);
      const p1 = await getAuditProduct('p1', { accountId });
      const p2 = await getAuditProduct('p2', { accountId });
      const p3 = await getAuditProduct('p3', { accountId });
      const p4 = await getAuditProduct('p4', { accountId });
      assert.ok(p1.issues.includes('missing_variations'));
      assert.ok(!p2.issues.includes('missing_variations'));
      assert.ok(!p3.issues.includes('missing_variations'));
      assert.ok(p4.issues.includes('missing_image'));
    } },
    { name: 'variation image via produto_imagens resolves missing_variation_image and stock zero is ignored', run: async () => {
      reset();
      const accountId = 'acc-product-audit-variation-image';
      __loadMemoryProdutos([
        {
          id: 'p1',
          account_id: accountId,
          nome: 'Produto com imagem em variação',
          sku: 'SKU-V1',
          categoria: 'Cat',
          preco: 10,
          estoque: 5,
          ativo: true,
          imagemUrl: 'pai.jpg',
          variacoes: [
            { id: 'v1', produto_id: 'p1', sku: 'SKU-V1-1', estoque_atual: 0, ativo: true },
            { id: 'v2', produto_id: 'p1', sku: 'SKU-V1-2', estoque_atual: 2, ativo: true }
          ],
          produto_imagens: [
            { id: 'img-1', produto_id: 'p1', variacao_id: 'v1', url: 'https://img.test/var-v1.jpg', principal: true },
            { id: 'img-2', produto_id: 'p1', variacao_id: 'v2', url: 'https://img.test/var-v2.jpg', principal: true }
          ]
        }
      ]);

      const result = await listAuditProducts({}, { accountId });
      assert.equal(result.items.length, 1);
      const item = result.items[0];
      assert.equal(item.id, 'p1');
      assert.equal(item.issues.includes('variation_without_image'), false);
      assert.equal(item.issues.includes('variation_without_stock'), false);
      assert.equal(item.issues.includes('zero_stock'), false);

      const detail = await getAuditProduct('p1', { accountId });
      assert.equal(detail.issues.includes('variation_without_image'), false);
      assert.equal(detail.issues.includes('variation_without_stock'), false);
      assert.equal(detail.issues.includes('zero_stock'), false);
    } },
    { name: 'resolved issues disappear from audit list', run: async () => {
      reset();
      const accountId = 'acc-product-audit-resolved';
      __loadMemoryFabricantes([{ id: 'fab-1', account_id: accountId, nome: 'Fabrica 1' }]);
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Resolvido', sku: 'SKU1', categoria: 'Cat', preco: 10, estoque: 5, ativo: true, imagemUrl: 'img', variacoes: [{ id: 'v1', produto_id: 'p1', sku: 'SKU1-1', estoque_atual: 1, ativo: true, imagem_url: 'child.jpg' }] }
      ]);
      await linkFabricante('p1', 'fab-1', { accountId });
      const result = await listAuditProducts({}, { accountId });
      assert.equal(result.pagination.total, 0);
      assert.equal(result.items.length, 0);
      assert.equal(result.summary.totalProdutos, 0);
      assert.equal(result.summary.comProblemas, 0);
    } },
    { name: 'summary keeps active issues visible for default audit and does not zero out cards', run: async () => {
      reset();
      const accountId = 'acc-product-audit-summary-cards';
      __loadMemoryFabricantes([{ id: 'fab-p2', account_id: accountId, nome: 'Fabrica P2' }]);
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Ativo A', sku: 'SKU10', categoria: null, preco: 10, estoque: 0, ativo: true, imagemUrl: null, variacoes: [] },
        { id: 'p2', account_id: accountId, nome: 'Nao entra no default', sku: 'SKU11', categoria: 'Cat', preco: 10, estoque: 1, ativo: false, status: 'ativo', status_comercial: 'ativo', imagemUrl: 'img', variacoes: [{ id: 'v2', sku: 'SKU11-1', estoque: 1, imagemUrl: 'img' }] },
        { id: 'p3', account_id: accountId, nome: 'Ativo C', sku: 'SKU12', categoria: 'Cat', preco: 10, estoque: 1, ativo: '1', imagemUrl: 'img', variacoes: [{ id: 'v3', sku: 'SKU12-1', estoque: 1, imagemUrl: 'img' }] }
      ]);
      await linkFabricante('p3', 'fab-p2', { accountId });
      const summary = await auditSummary({ accountId });
      assert.equal(summary.totalProdutos, 1);
      assert.equal(summary.comProblemas, 1);
      assert.equal(summary.semFabrica, 1);
      assert.equal(summary.semImagem, 1);
      assert.equal(summary.semCategoria, 1);
      assert.equal(summary.criticos, 1);
      assert.equal(summary.leves, 0);
    } },
    { name: 'schema real active flag with no status fields appears in default audit', run: async () => {
      reset();
      const accountId = 'acc-product-audit-schema-active';
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Real Ativo', sku: 'SKU_REAL_1', categoria: null, preco: 10, estoque: 1, ativo: true, imagemUrl: null, variacoes: [{ id: 'v1', sku: 'SKU_REAL_1-1', estoque: 1 }] }
      ]);
      const result = await listAuditProducts({}, { accountId });
      assert.equal(result.pagination.total, 1);
      assert.equal(result.summary.totalProdutos, 1);
      assert.equal(result.summary.comProblemas, 1);
      assert.equal(result.summary.semImagem, 1);
      assert.equal(result.summary.semCategoria, 1);
      assert.equal(result.items[0].id, 'p1');
    } },
    { name: 'schema real inactive flag appears only in inactive audit', run: async () => {
      reset();
      const accountId = 'acc-product-audit-schema-inactive';
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Real Inativo', sku: 'SKU_REAL_2', categoria: 'Cat', preco: 10, estoque: 1, ativo: 'false', imagemUrl: 'img', variacoes: [{ id: 'v1', sku: 'SKU_REAL_2-1', estoque: 1 }] }
      ]);
      const defaultResult = await listAuditProducts({}, { accountId });
      assert.equal(defaultResult.pagination.total, 0);
      assert.equal(defaultResult.summary.totalProdutos, 0);
      const inactiveResult = await listAuditProducts({ status: 'inativo' }, { accountId });
      assert.equal(inactiveResult.pagination.total, 1);
      assert.equal(inactiveResult.summary.totalProdutos, 1);
      assert.equal(inactiveResult.items[0].id, 'p1');
    } },
    { name: 'list orders by severity, issue count and name', run: async () => {
      reset();
      const accountId = 'acc-product-audit-ordering';
      __loadMemoryProdutos([
        { id: 'p1', account_id: accountId, nome: 'Produto C', sku: 'SKU1', categoria: null, preco: 10, estoque: 5, ativo: true, variacoes: [] },
        { id: 'p2', account_id: accountId, nome: 'Produto A', sku: 'SKU2', categoria: 'Cat', preco: 0, estoque: 0, ativo: true },
        { id: 'p3', account_id: accountId, nome: 'Produto B', sku: 'SKU3', categoria: 'Cat', preco: 0, estoque: 0, ativo: true }
      ]);
      const result = await listAuditProducts({}, { accountId });
      assert.equal(result.items[0].nome, 'Produto A');
      assert.equal(result.items[1].nome, 'Produto B');
      assert.equal(result.items[2].nome, 'Produto C');
    } },
    { name: 'list paginates items while keeping full summary', run: async () => {
      reset();
      const accountId = 'acc-product-audit-pagination';
      __loadMemoryProdutos(Array.from({ length: 25 }, (_, idx) => ({
        id: `p${idx + 1}`,
        account_id: accountId,
        nome: `Produto ${String(idx + 1).padStart(2, '0')}`,
        sku: `SKU${idx + 1}`,
        categoria: 'Cat',
        preco: 10,
        estoque: 5,
        ativo: idx % 2 === 0 ? 'true' : 1
      })));
      const result = await listAuditProducts({ page: 1, limit: 20 }, { accountId });
      assert.equal(result.items.length, 20);
      assert.equal(result.pagination.total, 25);
      assert.equal(result.pagination.totalPages, 2);
      assert.equal(result.summary.totalProdutos, 25);
      assert.equal(result.summary.comProblemas, 25);
    } },
    { name: 'summary ignores page size and includes all tenant products', run: async () => {
      reset();
      const accountId = 'acc-product-audit-global-summary';
      __loadMemoryProdutos(Array.from({ length: 30 }, (_, idx) => ({
        id: `p${idx + 1}`,
        account_id: accountId,
        nome: `Produto ${String(idx + 1).padStart(2, '0')}`,
        sku: `SKU${idx + 1}`,
        categoria: idx < 10 ? null : 'Cat',
        preco: 10,
        estoque: idx < 5 ? 0 : 5,
        ativo: true,
        imagemUrl: idx === 0 ? null : 'img',
        variacoes: [{ id: `v${idx + 1}`, sku: `SKU${idx + 1}-1`, estoque: 1, imagemUrl: 'img' }]
      })));
      const result = await listAuditProducts({ page: 1, limit: 15 }, { accountId });
      assert.equal(result.items.length, 15);
      assert.equal(result.pagination.total, 30);
      assert.equal(result.pagination.totalPages, 2);
      assert.equal(result.summary.totalProdutos, 30);
      assert.equal(result.summary.comProblemas, 30);
      assert.equal(result.summary.semImagem, 1);
      assert.equal(result.summary.semCategoria, 10);
      assert.equal(result.summary.estoqueZerado, 0);
    } }
  ];
}
