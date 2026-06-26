import { defineModule } from '../../../core/module-contract.js';

export const evolutionModule = defineModule({
  name: 'integrations-evolution',
  domain: 'whatsapp',
  routes: ['POST /integrations/evolution/webhook']
});
