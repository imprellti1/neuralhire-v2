import { getRevenueIntelligence } from './revenue-intelligence.repository.js';
export async function getRevenueIntelligenceHandler(ctx){ return getRevenueIntelligence(ctx.params.accountId); }
