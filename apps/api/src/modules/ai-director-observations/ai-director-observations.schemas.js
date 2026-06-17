const severities = new Set(['low', 'medium', 'high', 'critical']);
const statuses = new Set(['open', 'acknowledged', 'resolved']);
const categories = new Set(['comercial', 'produtos', 'auditoria', 'administrativo', 'followup', 'geral']);

function trimText(value) {
  return String(value ?? '').trim();
}

export function normalizeCreateObservationPayload(payload = {}) {
  const manager_id = trimText(payload.manager_id ?? payload.managerId);
  const manager_name = trimText(payload.manager_name ?? payload.managerName);
  const category = trimText(payload.category);
  const title = trimText(payload.title);
  const description = trimText(payload.description);
  const severity = trimText(payload.severity || 'medium');
  const status = trimText(payload.status || 'open');
  const impact_score = Number(payload.impact_score ?? payload.impactScore ?? 0);
  const urgency_score = Number(payload.urgency_score ?? payload.urgencyScore ?? 0);
  const metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata) ? payload.metadata : null;

  return {
    manager_id,
    manager_name,
    category,
    title,
    description,
    severity,
    status,
    impact_score,
    urgency_score,
    metadata,
    source_type: payload.source_type ?? payload.sourceType ?? null,
    source_id: payload.source_id ?? payload.sourceId ?? null
  };
}

export function normalizeUpdateObservationPayload(payload = {}) {
  const normalized = {};
  if (payload.status !== undefined) normalized.status = trimText(payload.status);
  if (payload.severity !== undefined) normalized.severity = trimText(payload.severity);
  if (payload.metadata !== undefined) normalized.metadata = payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata) ? payload.metadata : null;
  return normalized;
}

export function validateObservationPayload(payload = {}, { partial = false } = {}) {
  const errors = [];
  const required = ['manager_id', 'manager_name', 'category', 'title', 'description'];
  for (const field of required) {
    if (!partial && !trimText(payload[field])) errors.push({ field, message: `${field} obrigatorio` });
  }
  if (payload.manager_id !== undefined && !trimText(payload.manager_id)) errors.push({ field: 'manager_id', message: 'manager_id obrigatorio' });
  if (payload.manager_name !== undefined && !trimText(payload.manager_name)) errors.push({ field: 'manager_name', message: 'manager_name obrigatorio' });
  if (payload.category !== undefined && !categories.has(trimText(payload.category))) errors.push({ field: 'category', message: 'category invalida' });
  if (payload.severity !== undefined && !severities.has(trimText(payload.severity))) errors.push({ field: 'severity', message: 'severity invalida' });
  if (payload.status !== undefined && !statuses.has(trimText(payload.status))) errors.push({ field: 'status', message: 'status invalido' });
  if (payload.impact_score !== undefined && (!Number.isInteger(payload.impact_score) || payload.impact_score < 0 || payload.impact_score > 100)) errors.push({ field: 'impact_score', message: 'impact_score invalido' });
  if (payload.urgency_score !== undefined && (!Number.isInteger(payload.urgency_score) || payload.urgency_score < 0 || payload.urgency_score > 100)) errors.push({ field: 'urgency_score', message: 'urgency_score invalido' });
  if (payload.metadata !== undefined && (payload.metadata === null || typeof payload.metadata !== 'object' || Array.isArray(payload.metadata))) errors.push({ field: 'metadata', message: 'metadata deve ser objeto' });
  return errors;
}
