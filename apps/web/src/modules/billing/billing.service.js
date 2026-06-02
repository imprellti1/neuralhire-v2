export async function listPlans(apiClient){ return apiClient.get('/billing/plans'); }
export async function prepareSubscription(apiClient, acct, payload){ return apiClient.post(`/accounts/${acct}/subscription/prepare`, payload); }
export async function activateSubscription(apiClient, acct, payload){ return apiClient.post(`/accounts/${acct}/subscription/activate`, payload); }
export async function cancelSubscription(apiClient, acct){ return apiClient.post(`/accounts/${acct}/subscription/cancel`, {}); }
export async function getSubscription(apiClient, acct){ return apiClient.get(`/accounts/${acct}/subscription`); }

