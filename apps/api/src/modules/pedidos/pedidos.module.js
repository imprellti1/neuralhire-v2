import { defineModule } from '../../core/module-contract.js';

export const pedidosModule = defineModule({
  name: 'pedidos',
  domain: 'pedidos-comercial',
  dependencies: [],
  routes: [
    'GET /pedidos',
    'GET /pedidos/:id',
    'GET /pedidos/:id/history',
    'POST /pedidos',
    'PATCH /pedidos/:id',
    'PATCH /pedidos/:id/status',
    'PATCH /pedidos/:id/itens'
  ]
});
