import { ValidationError } from '../../core/errors.js';

function clean(v, max = 4000) {
  return String(v ?? '').trim().slice(0, max);
}

export function normalizeSendPayload(payload = {}) {
  const draftId = clean(payload.draftId ?? payload.draft_id, 120);
  if (!draftId) throw new ValidationError('draftId e obrigatorio.');
  return { draftId };
}

export function normalizeWebhookPayload(payload = {}) {
  return payload && typeof payload === 'object' ? payload : {};
}
