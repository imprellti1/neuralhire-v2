import { createCliente } from '../modules/clientes/clientes.repository.js';
import { createProduto } from '../modules/produtos/produtos.repository.js';
import { createPedido, updatePedidoStatus, __resetMemoryPedidosForTests } from '../modules/pedidos/pedidos.repository.js';
import { __resetMemoryClientesForTests } from '../modules/clientes/clientes.repository.js';
import { __resetMemoryProdutosForTests } from '../modules/produtos/produtos.repository.js';
import { getDemoMemoryFilePath, saveDemoMemoryToDisk } from './demo-memory.store.js';

const ACCOUNT_ID = 'acc-analytics-001';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isoDaysAgo(daysAgo) {
  return new Date(Date.now() - (daysAgo * MS_PER_DAY)).toISOString();
}

function assertNonProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:demo bloqueado em production');
  }
}

async function seedClientes(accountId) {
  const clientes = [
    { nome: 'Alfa Construcoes', documento: '12.345.678/0001-10', email: 'compras@alfa.com', cidade: 'Sao Paulo', estado: 'SP' },
    { nome: 'Beta Varejo', documento: '23.456.789/0001-21', email: 'suprimentos@beta.com', cidade: 'Campinas', estado: 'SP' },
    { nome: 'Gamma Foods', documento: '34.567.890/0001-32', email: 'financeiro@gamma.com', cidade: 'Curitiba', estado: 'PR' },
    { nome: 'Delta Servicos', documento: '45.678.901/0001-43', email: 'operacao@delta.com', cidade: 'Belo Horizonte', estado: 'MG' },
    { nome: 'Epsilon Tech', documento: '56.789.012/0001-54', email: 'compras@epsilon.com', cidade: 'Rio de Janeiro', estado: 'RJ' }
  ];
  const created = [];
  for (const cliente of clientes) {
    created.push(await createCliente(cliente, { accountId }));
  }
  return created;
}

async function seedProdutos(accountId) {
  const produtos = [
    { codigo: 'PRD-001', sku: 'SKU-001', nome: 'Notebook Pro 14', categoria: 'Informatica', marca: 'Neural', preco: 4899.9, estoque: 25 },
    { codigo: 'PRD-002', sku: 'SKU-002', nome: 'Monitor 27 IPS', categoria: 'Informatica', marca: 'ViewTech', preco: 1599.5, estoque: 30 },
    { codigo: 'PRD-003', sku: 'SKU-003', nome: 'Teclado Mecanico', categoria: 'Perifericos', marca: 'TypeFast', preco: 399.9, estoque: 80 },
    { codigo: 'PRD-004', sku: 'SKU-004', nome: 'Mouse Ergonomico', categoria: 'Perifericos', marca: 'TypeFast', preco: 219.9, estoque: 120 },
    { codigo: 'PRD-005', sku: 'SKU-005', nome: 'Headset Pro', categoria: 'Audio', marca: 'Sonic', preco: 599.0, estoque: 40 },
    { codigo: 'PRD-006', sku: 'SKU-006', nome: 'Webcam Full HD', categoria: 'Video', marca: 'Vision', preco: 329.0, estoque: 65 },
    { codigo: 'PRD-007', sku: 'SKU-007', nome: 'Dock USB-C', categoria: 'Acessorios', marca: 'Connect', preco: 449.0, estoque: 50 },
    { codigo: 'PRD-008', sku: 'SKU-008', nome: 'SSD 1TB NVMe', categoria: 'Armazenamento', marca: 'FlashUp', preco: 739.0, estoque: 55 }
  ];
  const created = [];
  for (const produto of produtos) {
    created.push(await createProduto(produto, { accountId }));
  }
  return created;
}

async function seedPedidos(accountId, clientes, produtos) {
  const statusPlan = ['rascunho', 'aprovado', 'faturado', 'cancelado', 'faturado', 'aprovado', 'rascunho', 'faturado', 'cancelado', 'aprovado', 'faturado', 'rascunho', 'aprovado', 'faturado', 'cancelado'];
  let createdCount = 0;

  for (let i = 0; i < 15; i += 1) {
    const cliente = clientes[i % clientes.length];
    const p1 = produtos[i % produtos.length];
    const p2 = produtos[(i + 3) % produtos.length];
    const p3 = produtos[(i + 5) % produtos.length];
    const createdAt = isoDaysAgo((i * 2) % 30);

    const pedidoPayload = {
      cliente_id: cliente.id,
      numero: `PED-${String(i + 1).padStart(4, '0')}`,
      origem: i % 2 === 0 ? 'crm' : 'manual',
      observacoes: `Pedido demo ${i + 1}`,
      metadata: { createdAt },
      itens: [
        { produto_id: p1.id, quantidade: 1 + (i % 3), preco_unitario: p1.preco, desconto: i % 2 === 0 ? 50 : 0 },
        { produto_id: p2.id, quantidade: 1 + (i % 2), preco_unitario: p2.preco, desconto: 0 },
        { produto_id: p3.id, quantidade: 2, preco_unitario: p3.preco, desconto: i % 5 === 0 ? 20 : 0 }
      ]
    };

    const { pedido } = await createPedido(pedidoPayload, { accountId, context: { auth: { userId: 'seed-script' } } });
    const targetStatus = statusPlan[i];
    if (targetStatus === 'aprovado') {
      await updatePedidoStatus(pedido.id, { status: 'enviado', motivo: 'Seed demo' }, { accountId, context: { auth: { userId: 'seed-script' } } });
      await updatePedidoStatus(pedido.id, { status: 'aprovado', motivo: 'Seed demo' }, { accountId, context: { auth: { userId: 'seed-script' } } });
    }
    if (targetStatus === 'faturado') {
      await updatePedidoStatus(pedido.id, { status: 'enviado', motivo: 'Seed demo' }, { accountId, context: { auth: { userId: 'seed-script' } } });
      await updatePedidoStatus(pedido.id, { status: 'aprovado', motivo: 'Seed demo' }, { accountId, context: { auth: { userId: 'seed-script' } } });
      await updatePedidoStatus(pedido.id, { status: 'faturado', motivo: 'Seed demo' }, { accountId, context: { auth: { userId: 'seed-script' } } });
    }
    if (targetStatus === 'cancelado') {
      await updatePedidoStatus(pedido.id, { status: 'cancelado', motivo: 'Seed demo' }, { accountId, context: { auth: { userId: 'seed-script' } } });
    }
    createdCount += 1;
  }

  return createdCount;
}

async function run() {
  assertNonProduction();
  __resetMemoryClientesForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryPedidosForTests();
  const clientes = await seedClientes(ACCOUNT_ID);
  const produtos = await seedProdutos(ACCOUNT_ID);
  const pedidos = await seedPedidos(ACCOUNT_ID, clientes, produtos);
  const persisted = await saveDemoMemoryToDisk();

  console.log('Seed demo concluido');
  console.log(`accountId: ${ACCOUNT_ID}`);
  console.log(`clientes criados: ${clientes.length}`);
  console.log(`produtos criados: ${produtos.length}`);
  console.log(`pedidos criados: ${pedidos}`);
  if (persisted.saved) console.log(`arquivo demo: ${getDemoMemoryFilePath()}`);
}

run().catch((error) => {
  console.error('Falha no seed:demo');
  console.error(error);
  process.exit(1);
});
