import { assertEqual } from '../assert.js';
import { createCliente } from '../../modules/clientes/clientes.repository.js';
import { createProduto } from '../../modules/produtos/produtos.repository.js';
import { createVendedor } from '../../modules/vendedores/vendedores.repository.js';
import {
  __dumpMemoryPedidos,
  __loadMemoryPedidos,
  __resetMemoryPedidosForTests,
  __setPedidosSupabaseClientForTests,
  createPedido,
  getPedidoById,
  getPedidosRepositoryMode,
  listPedidos,
  updatePedidoVendedor
} from '../../modules/pedidos/pedidos.repository.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';

const accountId = 'acc-pedidos-repo';

function createSupabaseMock() {
  const state = { pedidos: [], pedidosItens: [], clientes: [], clientesError: null, vendedores: [], vendedoresError: null };
  const pedidoQuery = {
    _filter: {},
    select() { return this; },
    eq(key, value) { this._filter[key] = value; return this; },
    order() { return this; },
    in() { return this; },
    maybeSingle() { return Promise.resolve({ data: state.pedidos[0] || null, error: null }); },
    range() { return Promise.resolve({ data: state.pedidos, count: state.pedidos.length, error: null }); },
    insert() { return { select() { return { single: () => Promise.resolve({ data: state.pedidos[0] || null, error: null }) }; } }; },
    update() { return { eq() { return this; }, select() { return { single: () => Promise.resolve({ data: state.pedidos[0] || null, error: null }) }; } }; },
    delete() { return this; }
  };
  const itemQuery = {
    select() { return this; },
    eq() { return this; },
    order() { return Promise.resolve({ data: state.pedidosItens, error: null }); },
    insert() { return { select: () => Promise.resolve({ data: state.pedidosItens, error: null }) }; }
  };
  return {
    query: pedidoQuery,
    state,
    from(table) {
      if (table === 'pedidos') return pedidoQuery;
      if (table === 'pedido_itens') return itemQuery;
      if (table === 'clientes') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return Promise.resolve({ data: state.clientes, error: state.clientesError }); }
        };
      }
      if (table === 'vendedores') {
        return {
          select() { return this; },
          eq() { return this; },
          in() { return Promise.resolve({ data: state.vendedores, error: state.vendedoresError }); }
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }
  };
}

async function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: (() => { try { return JSON.parse(res.body || '{}'); } catch { return {}; } })() };
}

export function getPedidosRepositoryTests() {
  return [
    {
      name: 'pedidos fallback memory mode',
      run: async () => {
        const mode = getPedidosRepositoryMode();
        assertEqual(mode.mode, 'memory');
      }
    },
    {
      name: 'createPedido e listPedidos',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente A' }, { accountId });
        const produto = await createProduto({ nome: 'Produto A', sku: 'SKU-1', preco: 5 }, { accountId });

        const created = await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 10 }] }, { accountId });

        assertEqual(Boolean(created.pedido.id), true);
        assertEqual(created.itens.length, 1);

        const list = await listPedidos({}, { accountId });
        assertEqual(list.total, 1);
        assertEqual(list.items[0].cliente_nome, 'Cliente A');
      }
    },
    {
      name: 'createPedido e createPedidoFromImport preservam data_emissao',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente Data' }, { accountId });
        const produto = await createProduto({ nome: 'Produto Data', sku: 'SKU-D', preco: 5 }, { accountId });
        const created = await createPedido({ cliente_id: cliente.id, data_emissao: '2026-03-15', itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 5 }] }, { accountId });
        assertEqual(created.pedido.data_emissao, '2026-03-15');

        const imported = await (await import('../../modules/pedidos/pedidos.repository.js')).createPedidoFromImport({ cliente_id: cliente.id, numero: 'IMP-1', data_emissao: '2026-03-16', total: 10, metadata: {} }, { accountId });
        assertEqual(imported.pedido.data_emissao, '2026-03-16');
      }
    },
    {
      name: 'GET /pedidos?cliente_id nao consulta owner_user_id em pedidos',
      run: async () => {
        __resetMemoryPedidosForTests();
        const mock = createSupabaseMock();
        __setPedidosSupabaseClientForTests(mock, true);
        try {
          const app = createApiApp();
          const clienteId = '11111111-1111-4111-8111-111111111111';
          await call(app, { method: 'GET', url: `/pedidos?cliente_id=${clienteId}`, role: 'manager', accountId });
          assertEqual(Object.prototype.hasOwnProperty.call(mock.query._filter, 'owner_user_id'), false);
          assertEqual(mock.query._filter.account_id, accountId);
          assertEqual(mock.query._filter.cliente_id, clienteId);
        } finally {
          __setPedidosSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'listPedidos em supabase nao depende de coluna codigo do cliente',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente Supabase' }, { accountId });
        const produto = await createProduto({ nome: 'Produto Supabase' }, { accountId });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 10 }] }, { accountId });

        const mock = createSupabaseMock();
        mock.state.pedidos = [{ id: 'p-1', account_id: accountId, cliente_id: cliente.id, created_at: '2026-06-30T10:00:00.000Z' }];
        mock.state.clientes = [{ id: cliente.id, nome: 'Cliente Supabase' }];
        mock.from = (table) => {
          if (table === 'pedidos') {
            return {
              _filter: {},
              select(fields) {
                this._select = fields;
                return this;
              },
              eq(key, value) { this._filter[key] = value; return this; },
              order() { return this; },
              range() { return Promise.resolve({ data: mock.state.pedidos, count: mock.state.pedidos.length, error: null }); }
            };
          }
          if (table === 'clientes') {
            return {
              select(fields) {
                assertEqual(String(fields).includes('codigo'), false);
                return this;
              },
              eq() { return this; },
              in() { return Promise.resolve({ data: mock.state.clientes, error: null }); }
            };
          }
          if (table === 'pedido_itens') {
            return {
              select() { return this; },
              eq() { return this; },
              in() { return Promise.resolve({ data: [], error: null }); }
            };
          }
          if (table === 'vendedores') {
            return {
              select() { return this; },
              eq() { return this; },
              in() { return Promise.resolve({ data: [], error: null }); }
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        };
        __setPedidosSupabaseClientForTests(mock, true);
        try {
          const result = await listPedidos({ cliente_id: cliente.id }, { accountId });
          assertEqual(result.total, 1);
          assertEqual(result.items[0].cliente_nome, 'Cliente Supabase');
        } finally {
          __setPedidosSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'listPedidos registra erro bruto do supabase antes de falhar',
      run: async () => {
        __resetMemoryPedidosForTests();
        const mock = createSupabaseMock();
        mock.from = (table) => {
          if (table === 'pedidos') {
            return {
              _filter: {},
              select() { return this; },
              eq() { return this; },
              order() { return this; },
              range() { return Promise.resolve({ data: null, count: null, error: { message: 'boom', code: '42703', details: 'missing column', hint: 'check schema' } }); }
            };
          }
          if (table === 'clientes') return { select() { return this; }, eq() { return this; }, in() { return Promise.resolve({ data: [], error: null }); } };
          if (table === 'vendedores') return { select() { return this; }, eq() { return this; }, in() { return Promise.resolve({ data: [], error: null }); } };
          if (table === 'pedido_itens') return { select() { return this; }, eq() { return this; }, in() { return Promise.resolve({ data: [], error: null }); } };
          throw new Error(`Unexpected table: ${table}`);
        };
        const logs = [];
        const originalError = console.error;
        console.error = (...args) => { logs.push(args); };
        __setPedidosSupabaseClientForTests(mock, true);
        try {
          let failed = false;
          try {
            await listPedidos({}, { accountId });
          } catch (error) {
            failed = String(error?.message || '').includes('Falha ao listar pedidos');
          }
          assertEqual(failed, true);
          const logged = logs.map((entry) => {
            try { return JSON.parse(String(entry[0] || '{}')); } catch { return null; }
          }).find((entry) => entry && entry.message === 'pedidos_list_supabase_failed');
          assertEqual(Boolean(logged), true);
          assertEqual(logged.code, '42703');
          assertEqual(logged.details, 'missing column');
          assertEqual(logged.hint, 'check schema');
          assertEqual(logged.stack === undefined || logged.stack === null, true);
        } finally {
          console.error = originalError;
          __setPedidosSupabaseClientForTests(null, false);
        }
      }
    },
    {
      name: 'GET /pedidos?cliente_id usa o mesmo fluxo do repository',
      run: async () => {
        __resetMemoryPedidosForTests();
        const app = createApiApp();
        const accountId = 'acc-ped-route';
        const cliente = await call(app, { method: 'POST', url: '/clientes', role: 'admin', accountId, body: { nome: 'Cliente Rota' } });
        const produto = await call(app, { method: 'POST', url: '/produtos', role: 'admin', accountId, body: { nome: 'Produto Rota', preco: 15 } });
        await call(app, { method: 'POST', url: '/pedidos', role: 'admin', accountId, body: { cliente_id: cliente.body.item.id, itens: [{ produto_id: produto.body.item.id, quantidade: 1, preco_unitario: 15 }] } });
        const list = await call(app, { method: 'GET', url: `/pedidos?cliente_id=${cliente.body.item.id}`, role: 'manager', accountId });
        assertEqual(list.res.statusCode, 200);
        assertEqual(list.body.items.length, 1);
        assertEqual(list.body.items[0].cliente_id, cliente.body.item.id);
        assertEqual(list.body.items[0].cliente_nome, 'Cliente Rota');
      }
    },
    {
      name: 'listPedidos nao vaza cliente_nome entre tenants e tolera cliente ausente',
      run: async () => {
        __resetMemoryPedidosForTests();
        const clienteA = await createCliente({ nome: 'Cliente Tenant A' }, { accountId: 'acc-a' });
        const clienteB = await createCliente({ nome: 'Cliente Tenant B' }, { accountId: 'acc-b' });
        const produtoA = await createProduto({ nome: 'Produto A', sku: 'A-1' }, { accountId: 'acc-a' });
        const produtoB = await createProduto({ nome: 'Produto B', sku: 'B-1' }, { accountId: 'acc-b' });

        await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 1, preco_unitario: 10 }] }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: clienteB.id, itens: [{ produto_id: produtoB.id, quantidade: 1, preco_unitario: 10 }] }, { accountId: 'acc-b' });

        const listA = await listPedidos({}, { accountId: 'acc-a' });
        assertEqual(listA.items.length, 1);
        assertEqual(listA.items[0].cliente_nome, 'Cliente Tenant A');

        await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 1, preco_unitario: 10 }] }, { accountId: 'acc-a' });
        const snapshot = __dumpMemoryPedidos();
        snapshot.pedidos[0].cliente_id = '00000000-0000-0000-0000-000000000001';
        __loadMemoryPedidos(snapshot);
        const withMissingCliente = await listPedidos({}, { accountId: 'acc-a' });
        assertEqual(withMissingCliente.items.some((item) => item.cliente_nome === null), true);
      }
    },
    {
      name: 'getPedidoById retorna pedido + itens + cliente_nome no mesmo tenant',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente A' }, { accountId });
        const produto = await createProduto({ nome: 'Produto A', sku: 'SKU-1', preco: 5 }, { accountId });
        const created = await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 5 }] }, { accountId });
        const found = await getPedidoById(created.pedido.id, { accountId });
        assertEqual(found.pedido.id, created.pedido.id);
        assertEqual(found.pedido.cliente_nome, 'Cliente A');
        assertEqual(found.itens.length, 1);
        assertEqual(found.itens[0].produto_nome, 'Produto A');
        assertEqual(found.itens[0].preco_unitario > 0, true);
        assertEqual(found.itens[0].total > 0, true);
        assertEqual(found.pedido.total > 0, true);
      }
    },
    {
      name: 'getPedidoById abre pedido importado sem owner_user_id no mesmo tenant e bloqueia outro tenant',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente Importado' }, { accountId });
        const produto = await createProduto({ nome: 'Produto Importado', sku: 'SKU-I', preco: 5 }, { accountId });
        const created = await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 5 }] }, { accountId });
        const snapshot = __dumpMemoryPedidos();
        const idx = snapshot.pedidos.findIndex((item) => item.id === created.pedido.id);
        delete snapshot.pedidos[idx].owner_user_id;
        __loadMemoryPedidos(snapshot);

        const found = await getPedidoById(created.pedido.id, { accountId });
        assertEqual(found.pedido.id, created.pedido.id);

        let forbidden = false;
        try {
          await getPedidoById(created.pedido.id, { accountId: 'acc-outro' });
        } catch (error) {
          forbidden = String(error?.message || '').includes('Pedido nao encontrado');
        }
        assertEqual(forbidden, true);
      }
    },
    {
      name: 'updatePedidoVendedor vincula vendedor do mesmo tenant e bloqueia outro tenant',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente Vendedor' }, { accountId });
        const produto = await createProduto({ nome: 'Produto Vendedor', sku: 'SKU-V', preco: 5 }, { accountId });
        const vendedor = await createVendedor({ nome: 'Vendedor A' }, { accountId });
        const outroVendedor = await createVendedor({ nome: 'Vendedor B' }, { accountId: 'acc-outro' });
        const created = await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 5 }] }, { accountId });
        const result = await updatePedidoVendedor(created.pedido.id, { vendedor_id: vendedor.id }, { accountId });
        assertEqual(result.item.vendedor_id, vendedor.id);
        const found = await getPedidoById(created.pedido.id, { accountId });
        assertEqual(found.pedido.vendedor_id, vendedor.id);
        assertEqual(found.pedido.vendedor.nome, 'Vendedor A');

        let blocked = false;
        try {
          await updatePedidoVendedor(created.pedido.id, { vendedor_id: outroVendedor.id }, { accountId });
        } catch (error) {
          blocked = String(error?.message || '').includes('Vendedor nao encontrado') || String(error?.message || '').includes('Vendedor invalido');
        }
        assertEqual(blocked, true);
      }
    },
    {
      name: 'getPedidoById nao usa cliente de outro tenant e mantem itens',
      run: async () => {
        __resetMemoryPedidosForTests();
        const clienteA = await createCliente({ nome: 'Cliente A' }, { accountId: 'acc-a' });
        const clienteB = await createCliente({ nome: 'Cliente B' }, { accountId: 'acc-b' });
        const produtoA = await createProduto({ nome: 'Produto A', sku: 'SKU-A' }, { accountId: 'acc-a' });

        const created = await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 2, preco_unitario: 7.5 }] }, { accountId: 'acc-a' });
        const snapshot = __dumpMemoryPedidos();
        const idx = snapshot.pedidos.findIndex((item) => item.id === created.pedido.id);
        snapshot.pedidos[idx].cliente_id = clienteB.id;
        __loadMemoryPedidos(snapshot);

        const found = await getPedidoById(created.pedido.id, { accountId: 'acc-a' });
        assertEqual(found.pedido.cliente_nome, null);
        assertEqual(found.pedido.cliente_id, clienteB.id);
        assertEqual(found.itens.length, 1);
        assertEqual(found.itens[0].quantidade, 2);
      }
    },
    {
      name: 'getPedidoById com cliente ausente nao quebra e nao retorna UUID como nome',
      run: async () => {
        __resetMemoryPedidosForTests();
        const cliente = await createCliente({ nome: 'Cliente A' }, { accountId: 'acc-missing' });
        const produto = await createProduto({ nome: 'Produto A', sku: 'SKU-M' }, { accountId: 'acc-missing' });
        const created = await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 9 }] }, { accountId: 'acc-missing' });

        const snapshot = __dumpMemoryPedidos();
        const idx = snapshot.pedidos.findIndex((item) => item.id === created.pedido.id);
        snapshot.pedidos[idx].cliente_id = '00000000-0000-0000-0000-000000000001';
        __loadMemoryPedidos(snapshot);

        const found = await getPedidoById(created.pedido.id, { accountId: 'acc-missing' });
        assertEqual(found.pedido.cliente_nome, null);
        assertEqual(found.pedido.cliente_id, '00000000-0000-0000-0000-000000000001');
        assertEqual(found.itens.length, 1);
      }
    },
    {
      name: 'getPedidoById tolera falha ao enriquecer cliente e vendedor no supabase',
      run: async () => {
        __resetMemoryPedidosForTests();
        const mock = createSupabaseMock();
        mock.state.pedidos = [{ id: 'pedido-1', account_id: accountId, cliente_id: 'cliente-fallback', vendedor_id: 'vendedor-fallback', total: 10, status: 'rascunho' }];
        mock.state.pedidosItens = [];
        mock.state.clientesError = { message: 'boom' };
        __setPedidosSupabaseClientForTests(mock, true);
        try {
          const found = await getPedidoById('pedido-1', { accountId });
          assertEqual(found.pedido.cliente_nome, null);
          assertEqual(found.pedido.vendedor_nome, null);
          assertEqual(found.pedido.cliente, null);
          assertEqual(found.pedido.vendedor, null);
        } finally {
          __setPedidosSupabaseClientForTests(null, false);
        }
      }
    }
  ];
}
