import { getActivationStatus } from './account-activation.repository.js';
export async function getActivationStatusHandler(ctx){ const accountId=ctx?.params?.accountId; return { item: await getActivationStatus(accountId) }; }
