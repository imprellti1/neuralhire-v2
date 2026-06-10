import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { __executePriceTableImportWithDepsForTests, __normalizePriceTableRefForTests, __normalizePriceTableValueForTests, __resetPriceTableImportSessionsForTests, executePriceTableImport, previewPriceTableImport } from './price-table-import.repository.js';
import { __dumpMemoryProdutos, __loadMemoryProdutos, __resetMemoryProdutosForTests } from '../produtos/produtos.repository.js';

function createWorkbook(rows) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Planilha1');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

test('normaliza referencia e preco da tabela', () => {
  assert.equal(__normalizePriceTableRefForTests(' 00123.0 '), '00123');
  assert.equal(__normalizePriceTableValueForTests('R$ 1.234,56'), 1234.56);
});

test('preview e aplicacao de tabela de preco', async () => {
  __resetMemoryProdutosForTests();
  __resetPriceTableImportSessionsForTests();
  __loadMemoryProdutos([
    { id: 'p1', account_id: 'a1', sku: '001', nome: 'Produto 1', preco: 10, ativo: true },
    { id: 'p2', account_id: 'a1', codigo: '002', nome: 'Produto 2', preco: 20, ativo: true },
    { id: 'p3', account_id: 'a1', sku: '003', nome: 'Produto 3', preco: 30, ativo: true, produto_pai_id: 'parent-1' }
  ]);
  const buffer = createWorkbook([
    ['Ref', 'UnitarioR'],
    ['001', '12,50'],
    ['002', '20'],
    ['002', '21'],
    ['003', '35'],
    ['999', '10'],
    ['004', 'abc']
  ]);

  const preview = await previewPriceTableImport({ accountId: 'a1', fileName: 'tabela.xlsx', buffer });
  assert.equal(preview.summary.totalRows, 6);
  assert.equal(preview.summary.matchedRows, 1);
  assert.equal(preview.summary.changedRows, 1);
  assert.equal(preview.summary.unchangedRows, 0);
  assert.equal(preview.summary.unmatchedRows, 2);
  assert.equal(preview.summary.invalidRows, 3);
  assert.equal(preview.items.find((item) => item.ref === '001').status, 'matched_changed');
  assert.equal(preview.items.filter((item) => item.ref === '002').every((item) => item.status === 'duplicated_ref'), true);
  assert.equal(preview.items.find((item) => item.ref === '003').status, 'unmatched');

  const result = await executePriceTableImport({ accountId: 'a1', importToken: preview.importToken });
  assert.equal(result.summary.updatedRows, 1);
  const updatedPreview = await previewPriceTableImport({ accountId: 'a1', fileName: 'tabela.xlsx', buffer });
  assert.equal(updatedPreview.items.find((item) => item.ref === '001').status, 'matched_unchanged');
});

test('atualiza produto pai inativo pela referencia e suporta planilha sem cabeçalho', async () => {
  __resetMemoryProdutosForTests();
  __resetPriceTableImportSessionsForTests();
  __loadMemoryProdutos([
    { id: 'p10', account_id: 'a1', sku: '870500087', nome: 'TOALHA DE MESA 1,60m x 3,20m GLAMOUR', preco: 0, ativo: false, status: 'inativo' }
  ]);

  const buffer = createWorkbook([
    ['870500087', '164,9']
  ]);

  const preview = await previewPriceTableImport({ accountId: 'a1', fileName: 'tabela-sem-cabecalho.xlsx', buffer });
  assert.equal(preview.summary.totalRows, 1);
  assert.equal(preview.items[0].ref, '870500087');
  assert.equal(preview.items[0].status, 'matched_changed');
  assert.equal(preview.items[0].currentPrice, 0);
  assert.equal(preview.items[0].newPrice, 164.9);

  const result = await executePriceTableImport({ accountId: 'a1', importToken: preview.importToken });
  assert.equal(result.summary.updatedRows, 1);
  assert.equal(__dumpMemoryProdutos().find((item) => item.id === 'p10').preco, 164.9);
  const refreshed = (await previewPriceTableImport({
    accountId: 'a1',
    fileName: 'tabela-sem-cabecalho.xlsx',
    buffer
  })).items[0];
  assert.equal(refreshed.status, 'matched_unchanged');
  assert.equal(refreshed.currentPrice, 164.9);
});

test('bloqueia duplicidade de referencia no cadastro sem aplicar update', async () => {
  __resetMemoryProdutosForTests();
  __resetPriceTableImportSessionsForTests();
  __loadMemoryProdutos([
    { id: 'p10', account_id: 'a1', sku: '870500087', nome: 'TOALHA DE MESA A', preco: 0, ativo: true, status: 'ativo' },
    { id: 'p11', account_id: 'a1', sku: '870500087', nome: 'TOALHA DE MESA B', preco: 12, ativo: true, status: 'ativo' }
  ]);

  const buffer = createWorkbook([
    ['870500087', '164,9']
  ]);

  const preview = await previewPriceTableImport({ accountId: 'a1', fileName: 'duplicado.xlsx', buffer });
  assert.equal(preview.summary.totalRows, 1);
  assert.equal(preview.summary.matchedRows, 0);
  assert.equal(preview.summary.invalidRows, 1);
  assert.equal(preview.items[0].status, 'duplicated_product_ref');
  assert.equal(preview.items[0].message, 'Mais de um produto encontrado com esta referência. Corrija a duplicidade antes de importar.');
  assert.deepEqual(preview.items[0].matchedProductIds.sort(), ['p10', 'p11']);
  assert.deepEqual(preview.items[0].matchedProductNames.sort(), ['TOALHA DE MESA A', 'TOALHA DE MESA B']);
  assert.equal(preview.items[0].productId, undefined);

  const result = await executePriceTableImport({ accountId: 'a1', importToken: preview.importToken });
  assert.equal(result.summary.updatedRows, 0);
  assert.equal(__dumpMemoryProdutos().find((item) => item.id === 'p10').preco, 0);
  assert.equal(__dumpMemoryProdutos().find((item) => item.id === 'p11').preco, 12);
});

test('falha quando update nao persiste o novo preco no banco', async () => {
  __resetMemoryProdutosForTests();
  __resetPriceTableImportSessionsForTests();
  __loadMemoryProdutos([
    { id: 'p20', account_id: 'a1', sku: '870500087', nome: 'TOALHA DE MESA 1,60m x 3,20m GLAMOUR', preco: 0, ativo: true, status: 'ativo' }
  ]);

  const buffer = createWorkbook([
    ['870500087', '164,9']
  ]);

  const preview = await previewPriceTableImport({ accountId: 'a1', fileName: 'persist-fail.xlsx', buffer });
  assert.equal(preview.items[0].status, 'matched_changed');

  const result = await __executePriceTableImportWithDepsForTests(
    { accountId: 'a1', importToken: preview.importToken },
    {
      async updateProduto() {
        return { id: 'p20', preco: 0 };
      },
      async getProdutoById() {
        return { id: 'p20', sku: '870500087', preco: 0, account_id: 'a1', status: 'ativo' };
      }
    }
  );

  assert.equal(result.summary.updatedRows, 0);
  assert.equal(result.summary.failedRows, 1);
  assert.equal(result.failed[0].status, 'update_failed');
  assert.equal(result.failed[0].persistedPrice, 0);
  assert.equal(result.failed[0].newPrice, 164.9);
});
