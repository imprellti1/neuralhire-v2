import { defineModule } from '../../core/module-contract.js';

export const pedidosItensModule = defineModule({
  name: 'pedidos-itens',
  domain: 'pedidos-comercial',
  routes: ['POST /pedidos/itens/importacao/preview', 'POST /pedidos/itens/importacao']
});
