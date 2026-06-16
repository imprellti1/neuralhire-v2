import assert from 'node:assert/strict';
import test from 'node:test';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createCliente, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { createPedidoFromImport, __resetMemoryPedidosForTests, __dumpMemoryPedidos, __setPedidosSupabaseClientForTests } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, __loadMemoryProdutos } from '../../modules/produtos/produtos.repository.js';
import { __setPedidosItensSupabaseModeForTests, __setPedidosItensSupabaseClientForTests, __testFindPedidoByNumero } from '../../modules/pedidos-itens/pedidos-itens.repository.js';

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

test('preview identifica pedido pelo nome do arquivo', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-1' }, { accountId: 'acc-preview' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11008', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview' });
  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
    ['ABC123.1', 'Produto X', 'Azul', 'M', '789', 2, 10, 20]
  ]);
  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview', body: { arquivo: { fileName: '11008.xlsx', base64 } } });
  assert.equal(preview.res.statusCode, 200);
  assert.equal(preview.body.pedido.numero, '11008');
});

test('preview aceita headers reais Produto e Descricao sem exigir codigo_produto_erp_original literal', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente Header Real', codigo: 'CLI-H1' }, { accountId: 'acc-preview-header-real' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11013', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-header-real' });
  const base64 = makeWorkbook([
    ['Produto', 'Descricao', 'Cor', 'Tamanho', 'Quantidade', 'Unitário', 'Valor Total'],
    ['850400110.949.00004', 'JOGO DE CAMA EXEMPLO', 'BRANCO', 'UNI', 4, 10.15, 60.9]
  ]);

  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-header-real', body: { arquivo: { fileName: '11013.xlsx', base64 } } });

  assert.equal(preview.res.statusCode, 200);
  assert.equal(preview.body.erro, undefined);
  assert.equal(preview.body.erros.length, 0);
  assert.equal(preview.body.itens.length, 1);
  assert.equal(preview.body.itens[0].codigo_produto_erp_original, '850400110.949.00004');
  assert.equal(preview.body.itens[0].nome_produto_original, 'JOGO DE CAMA EXEMPLO');
  assert.equal(preview.body.itens[0].cor_original, 'BRANCO');
  assert.equal(preview.body.itens[0].tamanho_original, 'UNI');
  assert.equal(preview.body.itens[0].quantidade, 4);
  assert.equal(preview.body.itens[0].valor_unitario, 10.15);
});

test('preview usa Produto como fallback de nome quando Descricao nao existe', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente Fallback', codigo: 'CLI-H2' }, { accountId: 'acc-preview-fallback' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11014', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-fallback' });
  const base64 = makeWorkbook([
    ['Produto', 'Cor', 'Tamanho', 'Quantidade', 'Unitário', 'Valor Total'],
    ['850400110.949.00004', 'BRANCO', 'UNI', 4, 10.15, 60.9]
  ]);

  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-fallback', body: { arquivo: { fileName: '11014.xlsx', base64 } } });

  assert.equal(preview.res.statusCode, 200);
  assert.equal(preview.body.erros.length, 0);
  assert.equal(preview.body.itens[0].codigo_produto_erp_original, '850400110.949.00004');
  assert.equal(preview.body.itens[0].nome_produto_original, '850400110.949.00004');
  assert.equal(preview.body.itens[0].valor_unitario, 10.15);
});

test('preview nao grava em pedido_itens', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-2' }, { accountId: 'acc-preview-2' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11009', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-2' });
  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'Unitário', 'valor_total'],
    ['ABC123.1', 'Produto X', 'Azul', 'M', '789', 2, 10.15, 20.3]
  ]);
  await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-2', body: { arquivo: { fileName: '11009.xlsx', base64 } } });
  assert.equal(__dumpMemoryPedidos().pedidoItens.length, 0);
});

test('item vinculado aparece como vinculado', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-3' }, { accountId: 'acc-preview-3' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11010', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-3' });
  __loadMemoryProdutos([{
    id: 'prod-1',
    account_id: 'acc-preview-3',
    nome: 'Produto X',
    sku: 'ABC123',
    codigo: 'ABC123',
    variacoes: [{ id: 'var-1', account_id: 'acc-preview-3', produto_id: 'prod-1', sku: 'ABC123-M', cor: 'Azul', grade: 'M', produto_nome: 'Produto X' }]
  }]);
  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'Unitário', 'valor_total'],
    ['ABC123.1', 'Produto X', 'Azul', 'M', '789', 2, 17.14, 34.28]
  ]);
  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-3', body: { arquivo: { fileName: '11010.xlsx', base64 } } });
  assert.equal(preview.body.itens[0].status_vinculo, 'vinculado');
  assert.equal(preview.body.itens[0].variacao_id, 'var-1');
  assert.equal(preview.body.itens[0].produto_nome, 'Produto X');
});

test('item sem vinculo aparece como nao_encontrado', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-4' }, { accountId: 'acc-preview-4' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11011', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-4' });
  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'Unitário', 'valor_total'],
    ['ZZZ999.1', 'Produto Y', 'Verde', 'G', '789', 1, 12, 12]
  ]);
  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-4', body: { arquivo: { fileName: '11011.xlsx', base64 } } });
  assert.equal(preview.body.itens[0].status_vinculo, 'nao_encontrado');
});

test('ambiguo aparece como ambiguo', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();
  const app = createApiApp();
  const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-5' }, { accountId: 'acc-preview-5' });
  await createPedidoFromImport({ cliente_id: cliente.id, numero: '11012', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-5' });
  __loadMemoryProdutos([{
    id: 'prod-1',
    account_id: 'acc-preview-5',
    nome: 'Produto X',
    sku: 'ABC123',
    codigo: 'ABC123',
    variacoes: [
      { id: 'var-1', account_id: 'acc-preview-5', produto_id: 'prod-1', sku: 'ABC123-M', cor: 'Azul', grade: 'M', produto_nome: 'Produto X' },
      { id: 'var-2', account_id: 'acc-preview-5', produto_id: 'prod-1', sku: 'ABC123-M', cor: 'Azul', grade: 'M', produto_nome: 'Produto X' }
    ]
  }]);
  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'Unitário', 'valor_total'],
    ['ABC123.1', 'Produto X', 'Azul', 'M', '789', 2, 10.15, 20.3]
  ]);
  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-5', body: { arquivo: { fileName: '11012.xlsx', base64 } } });
  assert.equal(preview.body.itens[0].status_vinculo, 'ambiguo');
});

test('arquivo cujo pedido nao existe retorna erro claro', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  const app = createApiApp();
  const base64 = makeWorkbook([
    ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
    ['ABC123.1', 'Produto X', 'Azul', 'M', '789', 2, 10, 20]
  ]);
  const preview = await call(app, { method: 'POST', url: '/pedidos/itens/importacao/preview', role: 'admin', accountId: 'acc-preview-6', body: { arquivo: { fileName: '99999.xlsx', base64 } } });
  assert.equal(preview.res.statusCode, 404);
});

test('findPedidoByNumero usa conta do contexto e retorna 404 com mensagem ERP', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();

  const recorded = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'pedidos');
      return {
        select(columns) {
          recorded.push(columns);
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: null, error: null };
        }
      };
    }
  };

  __setPedidosSupabaseClientForTests(supabase, true);
  __setPedidosItensSupabaseModeForTests(true);
  __setPedidosItensSupabaseClientForTests(supabase);

  try {
    await assert.rejects(
      () => __testFindPedidoByNumero('7b8d9d4f-7c67-4a3f-8c85-5f6d5df1a114', '9992'),
      (error) => error?.statusCode === 404 && String(error?.message || '').includes('Pedido ERP 9992 nao encontrado')
    );
    assert.deepEqual(recorded, ['id, account_id, numero']);
  } finally {
    __setPedidosSupabaseClientForTests(null, false);
    __setPedidosItensSupabaseModeForTests(false);
    __setPedidosItensSupabaseClientForTests(null);
  }
});

test('falha real do Supabase registra detalhes e retorna erro interno', async () => {
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryClientesForTests();

  const logs = [];
  const originalError = console.error;
  console.error = (...args) => { logs.push(args); };

  __setPedidosSupabaseClientForTests({
    from(table) {
      assert.equal(table, 'pedidos');
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: null, error: { message: 'relation error', details: 'bad filter', hint: 'check account_id' } };
        }
      };
    }
  }, true);
  __setPedidosItensSupabaseModeForTests(true);
  __setPedidosItensSupabaseClientForTests({
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          return { data: null, error: { message: 'relation error', details: 'bad filter', hint: 'check account_id' } };
        }
      };
    }
  });

  try {
    await assert.rejects(
      () => __testFindPedidoByNumero('7b8d9d4f-7c67-4a3f-8c85-5f6d5df1a114', '9992'),
      (error) => error?.statusCode === 500 && String(error?.message || '').includes('Falha ao buscar pedido')
    );
    assert.ok(logs.some((entry) => String(entry[0] || '').includes('[pedidos-itens.repository] Falha ao buscar pedido')));
    assert.ok(logs.some((entry) => JSON.stringify(entry).includes('relation error')));
  } finally {
    console.error = originalError;
    __setPedidosSupabaseClientForTests(null, false);
    __setPedidosItensSupabaseModeForTests(false);
    __setPedidosItensSupabaseClientForTests(null);
  }
});
