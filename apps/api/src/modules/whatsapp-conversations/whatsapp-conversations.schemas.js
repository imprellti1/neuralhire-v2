import { ValidationError } from '../../core/errors.js';

const ALLOWED_STATUS = new Set(['open', 'pending_human', 'waiting_customer', 'closed', 'archived']);
const ALLOWED_ORIGINS = new Set(['manual', 'import', 'webhook', 'agent', 'campaign']);
const ALLOWED_DIRECTIONS = new Set(['inbound', 'outbound']);
const ALLOWED_SENDER_TYPES = new Set(['customer', 'seller', 'agent', 'system']);
const ALLOWED_MESSAGE_STATUS = new Set(['received', 'queued', 'sent', 'delivered', 'read', 'failed', 'draft', 'approved', 'rejected']);
const ALLOWED_EVENTS = new Set(['conversation_created', 'message_received', 'message_created', 'status_changed', 'assigned', 'closed', 'reopened', 'note_added']);

const FORBIDDEN = new Set(['account_id', 'accountId', 'tenant_id', 'tenantId', 'owner_user_id', 'ownerUserId']);

function clean(v, max = 255) {
  return String(v ?? '').trim().slice(0, max);
}

function assertForbidden(payload = {}) {
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN.has(key)) throw new ValidationError(`Campo nao permitido: ${key}`);
  }
}

function normalizePhone(phone) {
  const digits = String(phone ?? '').replace(/\D+/g, '');
  if (!digits) throw new ValidationError('Telefone e obrigatorio.');
  return digits;
}

export function normalizeConversationListFilters(query = {}) {
  assertForbidden(query);
  return {
    status: clean(query.status, 40),
    clienteId: clean(query.clienteId ?? query.cliente_id, 80),
    phone: clean(query.phone, 40).replace(/\D+/g, ''),
    page: Math.max(1, Number.parseInt(String(query.page || '1'), 10) || 1),
    limit: Math.min(100, Math.max(1, Number.parseInt(String(query.limit || '20'), 10) || 20))
  };
}

export function normalizeCreateConversationPayload(payload = {}) {
  assertForbidden(payload);
  const phone = normalizePhone(payload.phone);
  const clienteId = clean(payload.clienteId ?? payload.cliente_id, 80);
  const contactName = clean(payload.contactName ?? payload.contact_name, 120);
  const vendedorId = clean(payload.vendedorId ?? payload.vendedor_id, 80);
  return { phone, clienteId: clienteId || null, contactName: contactName || null, vendedorId: vendedorId || null };
}

export function normalizeAddMessagePayload(payload = {}) {
  assertForbidden(payload);
  const direction = clean(payload.direction, 20);
  const body = clean(payload.body, 4000);
  const senderType = clean(payload.senderType ?? payload.sender_type, 20);
  const status = clean(payload.status, 20);
  if (!ALLOWED_DIRECTIONS.has(direction)) throw new ValidationError('Direction invalida.');
  if (!body) throw new ValidationError('Body e obrigatorio.');
  if (!ALLOWED_SENDER_TYPES.has(senderType)) throw new ValidationError('Sender type invalido.');
  if (!ALLOWED_MESSAGE_STATUS.has(status)) throw new ValidationError('Status de mensagem invalido.');
  return { direction, body, senderType, status };
}

export function normalizeStatusPayload(payload = {}) {
  assertForbidden(payload);
  const status = clean(payload.status, 40);
  if (!ALLOWED_STATUS.has(status)) throw new ValidationError('Status invalido.');
  return { status };
}

export function normalizeEventPayload(payload = {}) {
  assertForbidden(payload);
  const type = clean(payload.type, 60);
  if (!ALLOWED_EVENTS.has(type)) throw new ValidationError('Tipo de evento invalido.');
  const rawPayload = payload.payload && typeof payload.payload === 'object' ? payload.payload : {};
  return { type, payload: rawPayload };
}

export function normalizeConversationStatus(value) {
  const status = clean(value, 40);
  if (!ALLOWED_STATUS.has(status)) throw new ValidationError('Status invalido.');
  return status;
}

export function normalizeOrigin(value) {
  const origin = clean(value || 'manual', 40);
  if (!ALLOWED_ORIGINS.has(origin)) return 'manual';
  return origin;
}
