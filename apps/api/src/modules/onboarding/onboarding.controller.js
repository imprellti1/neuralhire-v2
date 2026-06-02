import { getOnboarding, startOnboarding, saveStep, completeOnboarding } from './onboarding.repository.js';
export const getOnboardingHandler=async(c)=>({ok:true,item:getOnboarding(c.params.accountId)||startOnboarding(c.params.accountId)});
export const startOnboardingHandler=async(c)=>({ok:true,item:startOnboarding(c.params.accountId)});
export const patchOnboardingStepHandler=async(c)=>({ok:true,item:saveStep(c.params.accountId,c.body?.step,c.body?.data||{})});
export const completeOnboardingHandler=async(c)=>({ok:true,item:completeOnboarding(c.params.accountId,c.body||{})});
