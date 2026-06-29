import { defineModule } from '../../core/module-contract.js';

export const clientesModule = defineModule({
  name: 'clientes',
  domain: 'clientes-crm',
  routes: ['GET /clientes', 'GET /clientes/radar', 'POST /clientes/radar/recalcular', 'GET /clientes/:id', 'POST /clientes/:id/enriquecer', 'POST /clientes/:id/geolocalizar', 'POST /clientes/:id/calcular-score', 'POST /clientes/:id/calcular-segmentacao', 'POST /clientes/:id/gerar-alertas', 'GET /clientes/:id/alertas', 'GET /clientes/:id/timeline', 'GET /clientes/:id/whatsapp/conversations', 'GET /clientes/:id/whatsapp/conversations/:conversationId/messages', 'PATCH /clientes/alertas/:id/resolver']
});
