import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { parsePedidosItensWorkbook } from '../../modules/pedidos-itens/pedidos-itens.parser.js';
import { __buildPedidoItemRowForTests, executePedidosItensImport, normalizeSpreadsheetMoney } from '../../modules/pedidos-itens/pedidos-itens.repository.js';
import { createCliente, __resetMemoryClientesForTests } from '../../modules/clientes/clientes.repository.js';
import { createPedidoFromImport, __dumpMemoryPedidos, __resetMemoryPedidosForTests } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests } from '../../modules/produtos/produtos.repository.js';
import xlsx from 'xlsx';

export function getPedidosItensImportTests() {
  return [
    {
      name: 'parser separa codigo e descricao quando as colunas existem',
      run: async () => {
        const ws = xlsx.utils.aoa_to_sheet([
          ['Produto / Código / SKU', 'Descrição / Nome', 'Cor', 'Tamanho', 'Quantidade', 'Valor Total'],
          ['850400110.949.00004', 'JOGO DE CAMA EXEMPLO', 'BRANCO', 'UNI', 4, 6856]
        ]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Itens');
        const buffer = Buffer.from(xlsx.write(wb, { type: 'base64', bookType: 'xlsx' }), 'base64');

        const parsed = parsePedidosItensWorkbook(buffer);
        assert.equal(parsed.dataRows.length, 1);
        assert.equal(parsed.dataRows[0].codigo_produto_erp_original, '850400110.949.00004');
        assert.equal(parsed.dataRows[0].nome_produto_original, 'JOGO DE CAMA EXEMPLO');
        assert.equal(parsed.dataRows[0].cor_original, 'BRANCO');
        assert.equal(parsed.dataRows[0].tamanho_original, 'UNI');
        assert.equal(parsed.dataRows[0].quantidade, 4);
        assert.equal(parsed.dataRows[0].valor_total, 68.56);
      }
    },
    {
      name: 'parser usa codigo como fallback quando descricao nao existe',
      run: async () => {
        const ws = xlsx.utils.aoa_to_sheet([
          ['Produto / Código / SKU', 'Cor', 'Tamanho', 'Quantidade', 'Valor Total'],
          ['850400110.949.00004', 'BRANCO', 'UNI', 4, 6856]
        ]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Itens');
        const buffer = Buffer.from(xlsx.write(wb, { type: 'base64', bookType: 'xlsx' }), 'base64');

        const parsed = parsePedidosItensWorkbook(buffer);
        assert.equal(parsed.dataRows.length, 1);
        assert.equal(parsed.dataRows[0].codigo_produto_erp_original, '850400110.949.00004');
        assert.equal(parsed.dataRows[0].nome_produto_original, '850400110.949.00004');
        assert.equal(parsed.dataRows[0].valor_total, 68.56);
      }
    },
    {
      name: 'monta payload compatível com schema real para item nao vinculado',
      run: async () => {
        const row = {
          codigo_produto_erp_original: 'ABC.01',
          nome_produto_original: 'Camisa Premium',
          cor_original: 'Azul',
          tamanho_original: 'M',
          ean_original: '7890000000000',
          quantidade: 2,
          valor_unitario: null,
          valor_total: 79.9,
          sku_base_extraido: 'ABC',
          sku_esperado: 'ABC-M',
          motivo_vinculo: 'Nenhuma variacao candidata encontrada',
          status_vinculo: 'nao_encontrado',
          produto_id: null,
          variacao_id: null
        };

        const payload = __buildPedidoItemRowForTests({
          accountId: 'acc-1',
          pedidoId: 'pedido-1',
          row,
          match: row
        });

        assert.equal(payload.produto_nome, 'Camisa Premium');
        assert.equal(payload.preco_unitario, 39.95);
        assert.equal(payload.status_vinculo, 'nao_encontrado');
        assert.ok(payload.metadata);
        assert.equal(payload.metadata.nome_produto_original, 'Camisa Premium');
        assert.equal(payload.metadata.codigo_produto_erp_original, 'ABC.01');
      }
    },
    {
      name: 'prioriza produto_nome do item vinculado com shape real do preview e preserva nome da planilha para item nao vinculado',
      run: async () => {
        const vinculado = __buildPedidoItemRowForTests({
          accountId: 'acc-1b',
          pedidoId: 'pedido-1b',
          row: {
            produto_nome: 'TAPETE 40cm x 60cm POPCORN',
            codigo_produto_erp_original: '850400051.949.00001',
            nome_produto_original: '850400051.949.00001',
            quantidade: 1,
            valor_total: 120
          },
          match: {
            status_vinculo: 'vinculado',
            produto_id: 'prod-1',
            variacao_id: 'var-1',
          }
        });

        assert.equal(vinculado.produto_nome, 'TAPETE 40cm x 60cm POPCORN');

        const naoVinculado = __buildPedidoItemRowForTests({
          accountId: 'acc-1c',
          pedidoId: 'pedido-1c',
          row: {
            codigo_produto_erp_original: '850400051.949.00001',
            nome_produto_original: 'Produto da Planilha',
            quantidade: 1,
            valor_total: 120
          },
          match: {
            status_vinculo: 'nao_encontrado'
          }
        });

        assert.equal(naoVinculado.produto_nome, 'Produto da Planilha');

        const naoVinculadoDescricaoReal = __buildPedidoItemRowForTests({
          accountId: 'acc-1d',
          pedidoId: 'pedido-1d',
          row: {
            codigo_produto_erp_original: '850400110.949.00004',
            nome_produto_original: 'JOGO DE CAMA EXEMPLO',
            quantidade: 1,
            valor_total: 120
          },
          match: {
            status_vinculo: 'nao_encontrado'
          }
        });

        assert.equal(naoVinculadoDescricaoReal.produto_nome, 'JOGO DE CAMA EXEMPLO');
      }
    },
    {
      name: 'normaliza valor total em centavos antes de calcular preco unitario',
      run: async () => {
        assert.equal(normalizeSpreadsheetMoney(6856), 68.56);
        const payload = __buildPedidoItemRowForTests({
          accountId: 'acc-2',
          pedidoId: 'pedido-2',
          row: {
            codigo_produto_erp_original: 'ABC.01',
            nome_produto_original: 'Produto Centavos',
            quantidade: 4,
            valor_total: 68.56,
            valor_unitario: null
          },
          match: { status_vinculo: 'nao_encontrado' }
        });

        assert.equal(payload.valor_total, 68.56);
        assert.equal(payload.preco_unitario, 17.14);
      }
    },
    {
      name: 'preserva valor decimal corretamente informado na planilha',
      run: async () => {
        const payload = __buildPedidoItemRowForTests({
          accountId: 'acc-3',
          pedidoId: 'pedido-3',
          row: {
            codigo_produto_erp_original: 'ABC.02',
            nome_produto_original: 'Produto Decimal',
            quantidade: 6,
            valor_total: 6.09,
            valor_unitario: null
          },
          match: { status_vinculo: 'nao_encontrado' }
        });

        assert.equal(payload.valor_total, 6.09);
        assert.equal(payload.preco_unitario, 1.015);
      }
    },
    {
      name: 'execute preserva produto_nome enriquecido do preview no insert',
      run: async () => {
        __resetMemoryPedidosForTests();
        __resetMemoryProdutosForTests();
        __resetMemoryClientesForTests();

        const cliente = await createCliente({ nome: 'Cliente Preview', codigo: 'CLI-PREVIEW' }, { accountId: 'acc-preview-import' });
        const pedido = await createPedidoFromImport({ cliente_id: cliente.id, numero: '9992', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-preview-import' });
        const snapshotAntes = __dumpMemoryPedidos();
        snapshotAntes.pedidoItens = [];
        __resetMemoryPedidosForTests();
        const { __loadMemoryPedidos } = await import('../../modules/pedidos/pedidos.repository.js');
        __loadMemoryPedidos(snapshotAntes);

        const ws = xlsx.utils.aoa_to_sheet([
          ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
          ['850400051.949.00001', '850400051.949.00001', 'Azul', 'M', '789', 1, null, 120]
        ]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Itens');
        const base64 = xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });

        await executePedidosItensImport({
          accountId: 'acc-preview-import',
          fileName: '9992.xlsx',
          buffer: Buffer.from(base64, 'base64'),
          previewItems: [{
            status_vinculo: 'vinculado',
            produto_nome: 'TAPETE 40cm x 60cm POPCORN',
            nome_produto_original: '850400051.949.00001',
            codigo_produto_erp_original: '850400051.949.00001',
            produto_id: 'prod-1',
            variacao_id: 'var-1',
            variacao_sku: '850400051.949.00001-M',
            motivo_vinculo: 'OK',
            sku_base_extraido: '850400051.949.00001',
            sku_esperado: '850400051.949.00001-M',
            quantidade: 1,
            valor_unitario: 120,
            valor_total: 120
          }]
        });

        const snapshotDepois = __dumpMemoryPedidos();
        const itens = snapshotDepois.pedidoItens.filter((item) => item.account_id === 'acc-preview-import' && item.pedido_id === pedido.id);
        assert.equal(itens.length, 1);
        assert.equal(itens[0].status_vinculo, 'vinculado');
        assert.equal(itens[0].produto_nome, 'TAPETE 40cm x 60cm POPCORN');
      }
    },
    {
      name: 'reimportacao sobrescreve snapshot do pedido 9992',
      run: async () => {
        __resetMemoryPedidosForTests();
        __resetMemoryProdutosForTests();
        __resetMemoryClientesForTests();

        const cliente = await createCliente({ nome: 'Cliente Reimportacao', codigo: 'CLI-9992' }, { accountId: 'acc-reimport' });
        const pedido = await createPedidoFromImport({ cliente_id: cliente.id, numero: '9992', status: 'rascunho', origem: 'manual', total: 0, metadata: {} }, { accountId: 'acc-reimport' });
        const snapshotAntes = __dumpMemoryPedidos();
        snapshotAntes.pedidoItens = [
          { id: 'old-item-1', account_id: 'acc-reimport', pedido_id: pedido.id, produto_nome: 'Antigo', preco_unitario: 999 }
        ];
        __resetMemoryPedidosForTests();
        const { __loadMemoryPedidos } = await import('../../modules/pedidos/pedidos.repository.js');
        __loadMemoryPedidos(snapshotAntes);

        const ws = xlsx.utils.aoa_to_sheet([
          ['codigo_produto_erp_original', 'nome_produto_original', 'cor_original', 'tamanho_original', 'ean_original', 'quantidade', 'valor_unitario', 'valor_total'],
          ['ABC123.1', 'Produto Novo', 'Azul', 'M', '789', 4, null, 6856]
        ]);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Itens');
        const base64 = xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });

        await executePedidosItensImport({ accountId: 'acc-reimport', fileName: '9992.xlsx', buffer: Buffer.from(base64, 'base64') });

        const snapshotDepois = __dumpMemoryPedidos();
        const itens = snapshotDepois.pedidoItens.filter((item) => item.account_id === 'acc-reimport' && item.pedido_id === pedido.id);
        assert.equal(itens.length, 1);
        assert.equal(itens[0].preco_unitario, 17.14);
        assert.notEqual(itens[0].produto_nome, 'Antigo');
      }
    }
  ];
}
