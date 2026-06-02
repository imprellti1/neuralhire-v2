import { defineModule } from '../../core/module-contract.js';
export const accountActivationModule = defineModule({ name: 'account-activation', domain: 'account-activation', routes: ['GET /accounts/:accountId/activation-status'] });
