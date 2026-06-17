import { defineModule } from '../../core/module-contract.js';

export const clientesModule = defineModule({
  name: 'clientes',
  domain: 'clientes-crm',
  routes: ['GET /clientes', 'GET /clientes/:id', 'POST /clientes', 'POST /clientes/:id/enriquecer', 'POST /clientes/:id/geolocalizar', 'POST /clientes/:id/calcular-score', 'POST /clientes/:id/gerar-alertas', 'GET /clientes/:id/alertas', 'PATCH /clientes/alertas/:id/resolver']
});
