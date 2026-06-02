import { defineModule } from '../../core/module-contract.js';

export const whatsappDeliveryModule = defineModule({
  name: 'whatsapp-delivery',
  domain: 'whatsapp',
  routes: [
    'POST /whatsapp-delivery/send',
    'POST /whatsapp-delivery/webhook'
  ]
});
