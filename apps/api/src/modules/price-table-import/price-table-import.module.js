import { defineModule } from '../../core/module-contract.js';

export const priceTableImportModule = defineModule({
  name: 'price-table-import',
  domain: 'produtos-catalogo',
  dependencies: ['produtos'],
  routes: ['POST /produtos/importacao-tabela-preco/preview', 'POST /produtos/importacao-tabela-preco']
});
