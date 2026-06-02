import { getCustomerRetention } from './customer-retention.repository.js';
export async function getCustomerRetentionHandler(ctx){ return getCustomerRetention(ctx.params.accountId); }
