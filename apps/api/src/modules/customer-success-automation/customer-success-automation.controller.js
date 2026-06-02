import { getCustomerSuccessAutomation } from './customer-success-automation.repository.js';
export async function getCustomerSuccessAutomationHandler(ctx){ return getCustomerSuccessAutomation(ctx.params.accountId); }
