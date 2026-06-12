import { defineModule } from '../../core/module-contract.js';

export const pedidosImportModule = defineModule({
  name: 'pedidos-import',
  domain: 'pedidos-comercial',
  routes: ['POST /pedidos/importacao/preview', 'POST /pedidos/importacao']
});

