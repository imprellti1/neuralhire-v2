export async function getRetention(api, acct){ return api.get(`/accounts/${acct}/customer-retention`); }
