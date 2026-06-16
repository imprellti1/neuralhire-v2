import assert from 'node:assert/strict';
import { __buildPedidoItemRowForTests } from '../../modules/pedidos-itens/pedidos-itens.repository.js';

export function getPedidosItensImportTests() {
  return [
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
    }
  ];
}
