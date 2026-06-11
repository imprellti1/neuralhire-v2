import { defineModule } from '../../core/module-contract.js';
export const iaMemoriasModule = defineModule({ name: 'ia-memorias', domain: 'ia-memorias', routes: ['GET /ia-memorias', 'GET /ia-memorias/:id', 'POST /ia-memorias', 'PATCH /ia-memorias/:id', 'DELETE /ia-memorias/:id', 'POST /ia-memorias/search'] });

