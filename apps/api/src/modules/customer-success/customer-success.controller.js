import { getCustomerSuccess } from './customer-success.repository.js';
export async function getCustomerSuccessHandler(ctx){ return getCustomerSuccess(ctx.params.accountId); }
