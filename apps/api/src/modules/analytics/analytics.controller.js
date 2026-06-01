import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { ValidationError } from '../../core/errors.js';
import { getAnalyticsRepositoryMode, getAnalyticsSummary, getSalesTimeline, getTopCustomers, getTopProducts } from './analytics.repository.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDateOrThrow(value) {
  if (!ISO_DATE_RE.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return value;
}

function validateDateFilters(query = {}) {
  const { startDate, endDate } = query;

  if (startDate !== undefined) {
    const parsed = toIsoDateOrThrow(startDate);
    if (!parsed) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD.', {
        code: 'INVALID_DATE',
        domain: 'analytics-comercial'
      });
    }
  }

  if (endDate !== undefined) {
    const parsed = toIsoDateOrThrow(endDate);
    if (!parsed) {
      throw new ValidationError('Invalid date format. Use YYYY-MM-DD.', {
        code: 'INVALID_DATE',
        domain: 'analytics-comercial'
      });
    }
  }

  if (startDate !== undefined && endDate !== undefined && startDate > endDate) {
    throw new ValidationError('startDate must be less than or equal to endDate.', {
      code: 'INVALID_DATE_RANGE',
      domain: 'analytics-comercial'
    });
  }
}

function filtersFromQuery(query = {}) {
  validateDateFilters(query);
  return { startDate: query.startDate, endDate: query.endDate, limit: query.limit !== undefined ? Number(query.limit) : undefined };
}

export async function getAnalyticsSummaryHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const summary = await getAnalyticsSummary(filtersFromQuery(context.query || {}), { accountId, context });
  return { ok: true, repositoryMode: getAnalyticsRepositoryMode(), ...summary };
}

export async function getTopProductsHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const items = await getTopProducts(filtersFromQuery(context.query || {}), { accountId, context });
  return { ok: true, repositoryMode: getAnalyticsRepositoryMode(), items };
}

export async function getTopCustomersHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const items = await getTopCustomers(filtersFromQuery(context.query || {}), { accountId, context });
  return { ok: true, repositoryMode: getAnalyticsRepositoryMode(), items };
}

export async function getSalesTimelineHandler(context = {}) {
  const accountId = getAccountIdFromContext(context);
  const items = await getSalesTimeline(filtersFromQuery(context.query || {}), { accountId, context });
  return { ok: true, repositoryMode: getAnalyticsRepositoryMode(), items };
}
