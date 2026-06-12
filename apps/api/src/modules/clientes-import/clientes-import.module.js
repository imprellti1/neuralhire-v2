import { defineModule } from '../../core/module-contract.js';

export const clientesImportModule = defineModule({
  name: 'clientes-import',
  domain: 'clientes-crm',
  routes: ['POST /clientes/importacao/preview', 'POST /clientes/importacao']
});
