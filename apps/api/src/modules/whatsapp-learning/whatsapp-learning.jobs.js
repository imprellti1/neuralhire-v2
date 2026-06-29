import { defineModule } from '../../core/module-contract.js';

export const whatsappLearningModule = defineModule({
  name: 'whatsapp-learning',
  domain: 'whatsapp-learning',
  dependencies: ['whatsapp-conversations'],
  routes: ['POST /jobs/whatsapp-learning/run']
});

