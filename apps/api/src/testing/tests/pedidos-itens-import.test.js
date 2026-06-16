import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createCliente, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { createPedidoFromImport, __resetMemoryPedidosForTests, __dumpMemoryPedidos, __loadMemoryPedidos } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, __loadMemoryProdutos } from '../../modules/produtos/produtos.repository.js';

function parseBody(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  return app(req, res).then(() => ({ res, body: parseBody(res) }));
}

function makeWorkbook(rows) {
  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Itens');
  return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
}

test('execucao substitui itens antigos e preserva tenant isolation', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryClientesForTests();
  __resetMemoryProdutosForTests();
  const app = createApiApp();
  const clienteA = await createCliente({ nome: 'Cliente A', codigo: 'CLI-A' }, { accountId: 'acc-itens-a' });
  const clienteB = await createCliente({ nome: 'Cliente B', codigo: 'CLI-B' }, { accountId: 'acc-itens-b' });
  const pedidoA = await createPedidoFromImport({ cliente_id: clienteA.id, numero: '11008', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-itens-a' });
  await createPedidoFromImport({ cliente_id: clienteB.id, numero: '11008', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-itens-b' });
  __loadMemoryProdutos([{
    id: 'prod-1',
    account_id: 'acc-itens-a',
    nome: 'Produto X',
    sku: 'ABC123',
    codigo: 'ABC123',
    variacoes: [{ id: 'var-1', account_id: 'acc-itens-a', produto_id: 'prod-1', sku: 'ABC123-M', cor: 'Azul', grade: 'M', produto_nome: 'Produto X' }]
  }]);

  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
    ['ABC123.1', 'Produto X', 'Azul', 'M', '789', 2, 10, 20],
    ['ZZZ999.1', 'Produto Y', 'Verde', 'G', '111', 1, 12, 12]
  ]);

  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-itens-a', body: { arquivo: { fileName: '11008.xlsx', base64 } } });
  assert.equal(preview.res.statusCode, 200);
  assert.ok(preview.body.importToken);
  assert.equal(preview.body.itens.length, 2);
  assert.equal(preview.body.itens[0].status_vinculo, 'vinculado');
  assert.equal(preview.body.itens[1].status_vinculo, 'nao_encontrado');

  __loadMemoryPedidos({
    pedidos: __dumpMemoryPedidos().pedidos,
    pedidoItens: [{ id: 'old-1', account_id: 'acc-itens-a', pedido_id: pedidoA.pedido.id, produto_id: null, variacao_id: null, codigo_produto_erp_original: 'OLD', nome_produto_original: 'Antigo', cor_original: null, tamanho_original: null, ean_original: null, quantidade: 99, valor_unitario: 1, valor_total: 99, sku_base_extraido: 'OLD', sku_esperado: 'OLD-M', status_vinculo: 'nao_encontrado', motivo_vinculo: 'antigo', createdAt: new Date().toISOString() }, { id: 'keep-tenant', account_id: 'acc-itens-b', pedido_id: 'outro-pedido', produto_id: null, variacao_id: null, codigo_produto_erp_original: 'KEEP', nome_produto_original: 'Outro Tenant', cor_original: null, tamanho_original: null, ean_original: null, quantidade: 1, valor_unitario: 1, valor_total: 1, sku_base_extraido: 'KEEP', sku_esperado: 'KEEP-M', status_vinculo: 'nao_encontrado', motivo_vinculo: 'keep', createdAt: new Date().toISOString() }],
    pedidoStatusHistory: []
  });

  const execute = await call(app, { method: 'POST', url: '/pedidos/itens/importacao', role: 'admin', accountId: 'acc-itens-a', body: { importToken: preview.body.importToken } });
  assert.equal(execute.res.statusCode, 200);
  assert.equal(execute.body.resumo.importados, 2);
  assert.equal(execute.body.resumo.vinculados, 1);
  assert.equal(execute.body.resumo.nao_encontrados, 1);
  assert.equal(execute.body.resumo.ambiguos, 0);

  const snapshot = __dumpMemoryPedidos();
  const itensA = snapshot.pedidoItens.filter((item) => item.account_id === 'acc-itens-a' && item.pedido_id === pedidoA.pedido.id);
  const itensB = snapshot.pedidoItens.filter((item) => item.account_id === 'acc-itens-b');
  assert.equal(itensA.length, 2);
  assert.equal(itensB.length, 1);
  assert.equal(itensA.some((item) => item.codigo_produto_erp_original === 'OLD'), false);
  assert.equal(itensA[0].produto_id, 'prod-1');
  assert.equal(itensA[0].variacao_id, 'var-1');
  assert.equal(itensA[0].status_vinculo, 'vinculado');
  assert.equal(itensA[1].produto_id, null);
  assert.equal(itensA[1].status_vinculo, 'nao_encontrado');
});

test('item ambiguo continua persistido', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryClientesForTests();
  __resetMemoryProdutosForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-C' }, { accountId: 'acc-itens-c' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '22001', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-itens-c' });
  __loadMemoryProdutos([{
    id: 'prod-2',
    account_id: 'acc-itens-c',
    nome: 'Produto Y',
    sku: 'XYZ123',
    codigo: 'XYZ123',
    variacoes: [
      { id: 'var-2a', account_id: 'acc-itens-c', produto_id: 'prod-2', sku: 'XYZ123-G', cor: 'Verde', grade: 'G', produto_nome: 'Produto Y' },
      { id: 'var-2b', account_id: 'acc-itens-c', produto_id: 'prod-2', sku: 'XYZ123-G', cor: 'Verde', grade: 'G', produto_nome: 'Produto Y' }
    ]
  }]);

  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
    ['XYZ123.1', 'Produto Y', 'Verde', 'G', '222', 3, 15, 45]
  ]);
  const execute = await call(app, { method: 'POST', url: '/pedidos/itens/importacao', role: 'admin', accountId: 'acc-itens-c', body: { arquivo: { fileName: '22001.xlsx', base64 } } });
  assert.equal(execute.res.statusCode, 200);
  assert.equal(execute.body.resumo.ambiguos, 1);
  const saved = __dumpMemoryPedidos().pedidoItens.filter((item) => item.account_id === 'acc-itens-c');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].status_vinculo, 'ambiguo');
  assert.equal(saved[0].produto_id, null);
  assert.equal(saved[0].variacao_id, null);
});

test('importacao final reprocessa o XLSX recebido e nao depende do preview em cache', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryClientesForTests();
  __resetMemoryProdutosForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente Cache', codigo: 'CLI-CACHE' }, { accountId: 'acc-itens-cache' });
  const pedido = await createPedidoFromImport({ cliente_id: cliente.id, numero: '33001', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-itens-cache' });

  __loadMemoryProdutos([{
    id: 'prod-cache-a',
    account_id: 'acc-itens-cache',
    nome: 'Produto A',
    sku: 'AAA111',
    codigo: 'AAA111',
    variacoes: [{ id: 'var-cache-a', account_id: 'acc-itens-cache', produto_id: 'prod-cache-a', sku: 'AAA111-P', cor: 'Preto', grade: 'P', produto_nome: 'Produto A' }]
  }, {
    id: 'prod-cache-b',
    account_id: 'acc-itens-cache',
    nome: 'Produto B',
    sku: 'BBB222',
    codigo: 'BBB222',
    variacoes: [{ id: 'var-cache-b', account_id: 'acc-itens-cache', produto_id: 'prod-cache-b', sku: 'BBB222-G', cor: 'Verde', grade: 'G', produto_nome: 'Produto B' }]
  }]);

  const workbookA = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
    ['AAA111.1', 'Produto A', 'Preto', 'P', '111', 1, 5, 5]
  ]);
  const workbookB = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
    ['BBB222.1', 'Produto B', 'Verde', 'G', '222', 4, 9, 36]
  ]);

  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-itens-cache', body: { arquivo: { fileName: '33001.xlsx', base64: workbookA } } });
  assert.equal(preview.res.statusCode, 200);
  assert.equal(preview.body.itens[0].codigo_produto_erp_original, 'AAA111.1');
  assert.equal(preview.body.itens[0].status_vinculo, 'vinculado');

  __loadMemoryPedidos({
    pedidos: __dumpMemoryPedidos().pedidos,
    pedidoItens: [{ id: 'old-cache', account_id: 'acc-itens-cache', pedido_id: pedido.pedido.id, produto_id: 'legacy-prod', variacao_id: 'legacy-var', codigo_produto_erp_original: 'LEGACY.1', nome_produto_original: 'Legacy', cor_original: 'Azul', tamanho_original: 'M', ean_original: '000', quantidade: 99, valor_unitario: 1, valor_total: 99, sku_base_extraido: 'LEGACY', sku_esperado: 'LEGACY-M', status_vinculo: 'vinculado', motivo_vinculo: null, createdAt: new Date().toISOString() }],
    pedidoStatusHistory: []
  });

  const execute = await call(app, { method: 'POST', url: '/pedidos/itens/importacao', role: 'admin', accountId: 'acc-itens-cache', body: { arquivo: { fileName: '33001.xlsx', base64: workbookB } } });
  assert.equal(execute.res.statusCode, 200);
  assert.equal(execute.body.resumo.importados, 1);
  assert.equal(execute.body.resumo.vinculados, 1);

  const snapshot = __dumpMemoryPedidos();
  const saved = snapshot.pedidoItens.filter((item) => item.account_id === 'acc-itens-cache' && item.pedido_id === pedido.pedido.id);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].codigo_produto_erp_original, 'BBB222.1');
  assert.equal(saved[0].nome_produto_original, 'Produto B');
  assert.equal(saved[0].produto_id, 'prod-cache-b');
  assert.equal(saved[0].variacao_id, 'var-cache-b');
  assert.equal(saved[0].quantidade, 4);
  assert.equal(saved[0].valor_total, 36);
  assert.equal(saved[0].status_vinculo, 'vinculado');
  assert.equal(saved.some((item) => item.codigo_produto_erp_original === 'AAA111.1'), false);
  assert.equal(saved.some((item) => item.codigo_produto_erp_original === 'LEGACY.1'), false);
});
