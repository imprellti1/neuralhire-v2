import { defineModule } from '../../core/module-contract.js';
export const onboardingModule = defineModule({ name: 'onboarding', domain: 'onboarding', routes: ['GET /accounts/:accountId/onboarding','POST /accounts/:accountId/onboarding/start','PATCH /accounts/:accountId/onboarding/step','POST /accounts/:accountId/onboarding/complete'] });
