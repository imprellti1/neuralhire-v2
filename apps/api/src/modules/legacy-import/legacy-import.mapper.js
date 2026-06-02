import { supportedEntities } from './legacy-import.schemas.js';

export function buildLegacyImportSummary(normalized = {}, duplicates = {}, issues = []) {
  const summary = {};
  for (const entity of supportedEntities) {
    const items = Array.isArray(normalized[entity]) ? normalized[entity] : [];
    const entityIssues = issues.filter((issue) => issue.entity === entity);
    summary[entity] = {
      received: items.length,
      valid: Math.max(0, items.length - entityIssues.length),
      invalid: entityIssues.filter((issue) => issue.code !== 'DUPLICATE').length,
      duplicates: duplicates[entity] || 0
    };
  }
  return summary;
}

export function buildLegacyExecuteSummary(normalized = {}) {
  const summary = { created: {}, updated: {}, skipped: {}, invalid: {} };
  for (const entity of supportedEntities) {
    summary.created[entity] = Array.isArray(normalized[entity]) ? normalized[entity].length : 0;
    summary.updated[entity] = 0;
    summary.skipped[entity] = 0;
    summary.invalid[entity] = 0;
  }
  return summary;
}
