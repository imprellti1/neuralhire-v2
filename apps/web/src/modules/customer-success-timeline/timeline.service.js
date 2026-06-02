export async function getTimeline(api, acct){ return api.get(`/accounts/${acct}/customer-success-timeline`); }
