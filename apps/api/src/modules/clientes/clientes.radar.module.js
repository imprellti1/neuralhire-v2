import { defineModule } from '../../core/module-contract.js';
export const clientesRadarModule = defineModule({ name: 'clientes-radar', domain: 'clientes-crm', routes: ['GET /clientes/radar'] });
