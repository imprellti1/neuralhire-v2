export async function getOnboarding(api, acct){return api.get(`/accounts/${acct}/onboarding`);} 
export async function startOnboarding(api, acct){return api.post(`/accounts/${acct}/onboarding/start`,{});} 
export async function saveOnboardingStep(api, acct, step, data){return api.patch(`/accounts/${acct}/onboarding/step`,{step,data});}
export async function completeOnboarding(api, acct, checklist){return api.post(`/accounts/${acct}/onboarding/complete`,checklist||{});} 
