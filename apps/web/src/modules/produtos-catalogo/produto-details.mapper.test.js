import assert from 'node:assert/strict';
import {
  applyProdutoUsageDrillDown,
  applyProdutoUsageFilters,
  mapProdutoDetailsData,
  mapProdutoUpdatePayload,
  mapProdutoUsageCsvContent,
  mapProdutoUsageCsvFilename,
  mapProdutoUsageCsvRows,
  mapProdutoUsageData,
  validateProdutoEditForm
} from './produto-details.mapper.js';

function isoDaysAgo(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function run() {
  const uuid = '123e4567-e89b-12d3-a456-426614174000';
  const produto = mapProdutoDetailsData({ item: { id: 'p1', nome: uuid, preco: 129.9, ativo: true } });
  assert.equal(produto.nomeExibicao, 'Produto não identificado');
  assert.equal(produto.precoFormatado.includes('R$'), true);
  assert.equal(mapProdutoDetailsData({ item: { id: 'p2', nome: 'A', ativo: false } }).status, 'inativo');
  assert.equal(mapProdutoDetailsData({ item: { id: 'p3', nome: 'A' } }).status, 'desconhecido');

  assert.equal(mapProdutoUpdatePayload({ nome: 'A', preco: '129,90', status: 'ativo' }).preco, 129.9);
  assert.equal(mapProdutoUpdatePayload({ nome: 'A', preco: '129.90', status: 'ativo' }).preco, 129.9);
  assert.ok(validateProdutoEditForm({ nome: 'A', preco: 'abc', status: 'ativo' }).preco);

  const pedidos = [
    { id: 'o1', numero: '1', status: 'faturado', cliente_nome: uuid, total: 300, created_at: isoDaysAgo(2), itens: [{ produto_id: 'p1', quantidade: 2, preco_unitario: 100 }] },
    { id: 'o2', numero: '2', status: 'faturado', cliente_nome: 'ACME', total: 200, created_at: isoDaysAgo(10), itens: [{ produto_id: 'p1', quantidade: 1, total: 120 }] },
    { id: 'o3', numero: '3', status: 'cancelado', cliente_nome: 'BETA', total: 100, created_at: isoDaysAgo(35), itens: [{ produto_id: 'p1', quantidade: 1, total: 80 }] },
    { id: 'o4', numero: '4', status: 'faturado', cliente_nome: 'GAMA', total: 100, created_at: isoDaysAgo(65), itens: [{ produto_id: 'p1', quantidade: 1, total: 90 }] },
    { id: 'o5', numero: '5', status: 'faturado', cliente_nome: 'DELTA', total: 100, created_at: isoDaysAgo(100), itens: [{ produto_id: 'p1', quantidade: 1, total: 90 }] }
  ];
  const usage = mapProdutoUsageData('p1', pedidos);
  assert.equal(usage.quantidadeVendida >= 5, true);
  assert.equal(usage.faturamentoTotal >= 490, true);
  assert.equal(usage.ticketMedioProduto > 0, true);
  assert.equal(usage.ultimaVenda instanceof Date, true);
  assert.equal(usage.allPedidos[0].clienteNome, 'Cliente não identificado');

  const view7 = applyProdutoUsageFilters(usage, { period: '7d', status: 'todos' });
  const view30 = applyProdutoUsageFilters(usage, { period: '30d', status: 'todos' });
  const view90Fat = applyProdutoUsageFilters(usage, { period: '90d', status: 'faturado' });
  const viewTodos = applyProdutoUsageFilters(usage, { period: 'todos', status: 'todos' });
  assert.equal(view7.totalPedidos <= view30.totalPedidos, true);
  assert.equal(view30.totalPedidos <= viewTodos.totalPedidos, true);
  assert.equal(view90Fat.pedidosRecentes.every((p) => p.status === 'faturado'), true);
  assert.equal(viewTodos.comparison.message, 'Sem comparação para todos os períodos');

  assert.equal(view7.comparison.enabled, true);
  assert.equal(['positive', 'negative', 'neutral', 'new'].includes(view7.comparison.faturamento.kind), true);
  const zeroUsage = { allPedidos: [] };
  const zeroCompare = applyProdutoUsageFilters(zeroUsage, { period: '7d', status: 'todos' });
  assert.equal(zeroCompare.comparison.faturamento.text, 'Sem variação');
  const newMove = applyProdutoUsageFilters({ allPedidos: [{ criadoEm: new Date(), status: 'faturado', quantidade: 1, totalItem: 100 }] }, { period: '7d', status: 'todos' });
  assert.equal(newMove.comparison.faturamento.text, 'Novo movimento');

  const drillByDay = applyProdutoUsageDrillDown(viewTodos.pedidosRecentes, { key: viewTodos.serieTemporal[0]?.key }, 'dia');
  const monthlyRows = view90Fat.pedidosRecentes.map((p) => ({ ...p, criadoEm: new Date(p.criadoEm) }));
  const drillByMonth = applyProdutoUsageDrillDown(monthlyRows, { key: `${new Date(monthlyRows[0].criadoEm).getFullYear()}-${String(new Date(monthlyRows[0].criadoEm).getMonth() + 1).padStart(2, '0')}` }, 'mes');
  assert.equal(Array.isArray(drillByDay), true);
  assert.equal(drillByMonth.length >= 1, true);
  assert.equal(applyProdutoUsageDrillDown(viewTodos.pedidosRecentes, null, 'dia').length, viewTodos.pedidosRecentes.length);

  const csvRows = mapProdutoUsageCsvRows(view30.pedidosRecentes);
  const csv = mapProdutoUsageCsvContent(csvRows);
  assert.equal(csv.includes(';'), true);
  assert.equal(csv.startsWith('Pedido;Cliente;Status;Quantidade;Valor Unitário;Valor Item;Total Pedido;Data'), true);
  assert.equal(mapProdutoUsageCsvFilename({ nomeExibicao: 'Produto Ção 123' }, 'lista'), 'produto-produto-cao-123-pedidos-lista.csv');
  assert.equal(mapProdutoUsageCsvFilename({ nomeExibicao: 'Produto Ção 123' }, 'periodo'), 'produto-produto-cao-123-pedidos-periodo.csv');
}

run();
console.log('produto-details.mapper.test.js: OK');
