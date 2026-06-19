import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { getAiSalesAlerts, getAiSalesOpportunities, getAiSalesOverview, getAiSalesPerformance, getAiSalesPortfolioData, getAiSalesTasks } from './ai-sales.repository.js';

function parseVendedorId(context = {}) {
  return context?.query?.vendedor_id ? String(context.query.vendedor_id).trim() : undefined;
}

export async function getAiSalesOverviewHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getAiSalesOverview(accountId, { context, filters: { vendedor_id: parseVendedorId(context) } })) };
}

export async function getAiSalesPortfolioHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getAiSalesPortfolioData(accountId, { context, filters: { vendedor_id: parseVendedorId(context) } })) };
}

export async function getAiSalesAlertsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getAiSalesAlerts(accountId, { context, filters: { vendedor_id: parseVendedorId(context) } })) };
}

export async function getAiSalesTasksHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getAiSalesTasks(accountId, { context, vendedor_id: parseVendedorId(context), limit: context?.query?.limit })) };
}

export async function getAiSalesOpportunitiesHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getAiSalesOpportunities(accountId, { context, filters: { vendedor_id: parseVendedorId(context) } })) };
}

export async function getAiSalesPerformanceHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  return { ok: true, ...(await getAiSalesPerformance(accountId, { context, filters: { vendedor_id: parseVendedorId(context) } })) };
}

