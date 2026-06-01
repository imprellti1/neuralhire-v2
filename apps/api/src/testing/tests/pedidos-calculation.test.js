import { assertEqual } from '../assert.js';
import { calculatePedidoTotals } from '../../modules/pedidos/pedidos.repository.js';

export function getPedidosCalculationTests() {
  return [
    {
      name: 'calculo subtotal e total item',
      run: async () => {
        const result = calculatePedidoTotals([{ quantidade: 2, preco_unitario: 10, desconto: 3 }]);
        assertEqual(result.itensCalculados[0].subtotal, 20);
        assertEqual(result.itensCalculados[0].total, 17);
      }
    },
    {
      name: 'calculo subtotal pedido e total pedido',
      run: async () => {
        const result = calculatePedidoTotals([
          { quantidade: 2, preco_unitario: 10, desconto: 0 },
          { quantidade: 1, preco_unitario: 5, desconto: 1 }
        ], 2);
        assertEqual(result.subtotal, 25);
        assertEqual(result.total, 22);
      }
    },
    {
      name: 'arredondamento basico',
      run: async () => {
        const result = calculatePedidoTotals([{ quantidade: 3, preco_unitario: 3.333, desconto: 0 }]);
        assertEqual(result.itensCalculados[0].subtotal, 10);
      }
    }
  ];
}