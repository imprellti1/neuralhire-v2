export async function getExecutiveDashboard(api, acct){ return api.get(`/accounts/${acct}/executive-dashboard`); }
