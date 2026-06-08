import { defineModule } from '../../core/module-contract.js';

export const produtosImportModule = defineModule({
  name: 'produtos-import',
  domain: 'produtos-catalogo',
  dependencies: ['produtos'],
  routes: ['POST /produtos/importar-estoque/preview', 'POST /produtos/importar-estoque']
});
