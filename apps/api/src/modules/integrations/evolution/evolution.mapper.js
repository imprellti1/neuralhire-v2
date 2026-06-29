import { logger } from '../../../core/logger.js';

const NON_DIGITS = /[^0-9]/g;
const EVOLUTION_PAYLOAD_KEYS = [
  'provider',
  'instance',
  'instance_name',
  'instanceName',
  'instanceType',
  'instance_type',
  'event',
  'eventType',
  'type',
  'messageId',
  'message_id',
  'id',
  'remoteJid',
  'remote_jid',
  'phone',
  'text',
  'timestamp',
  'raw',
  'data'
];

function hasUsefulEvolutionFields(value) {
  return Boolean(value && typeof value === 'object' && EVOLUTION_PAYLOAD_KEYS.some((key) => key in value));
}

function resolveEvolutionPayload(payload = {}) {
  if (hasUsefulEvolutionFields(payload.body)) {
    return payload.body;
  }
  return payload;
}

export function normalizeWhatsAppPhone(value = '') {
  const source = value && typeof value === 'object'
    ? (value.remote_jid || value.remoteJid || value.phone || value.telefone || value.celular || value.whatsapp || '')
    : value;
  return String(source || '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@c\.us$/i, '')
    .replace(/@g\.us$/i, '')
    .replace(NON_DIGITS, '')
    .trim();
}

export function mapEvolutionWebhookEvent(payload = {}) {
  logger.info('evolution_mapper_shapes', {
    rootKeys: Object.keys(payload || {}),
    bodyKeys: payload?.body ? Object.keys(payload.body) : [],
    rawKeys: payload?.raw ? Object.keys(payload.raw) : [],
    rawBodyKeys: payload?.raw?.body ? Object.keys(payload.raw.body) : [],
    hasBody: Boolean(payload?.body),
    hasRaw: Boolean(payload?.raw),
    hasRawBody: Boolean(payload?.raw?.body),
    hasInstance: Boolean(payload?.instance),
    hasEvent: Boolean(payload?.event),
  });
  const resolvedPayload = resolveEvolutionPayload(payload);
  const rawPayload = resolvedPayload.raw && typeof resolvedPayload.raw === 'object' ? resolvedPayload.raw : null;
  const data = resolvedPayload.data || rawPayload?.data || resolvedPayload.message || resolvedPayload.messages?.[0] || rawPayload || resolvedPayload;
  const normalizedDirection = String(resolvedPayload.direction || data?.direction || '').trim().toLowerCase();
  const rawEventType = String(resolvedPayload.event || resolvedPayload.event_type || resolvedPayload.type || rawPayload?.event || rawPayload?.event_type || rawPayload?.type || '').trim();
  const instanceName = String(resolvedPayload.instance || resolvedPayload.instance_name || resolvedPayload.instanceName || data?.instance || data?.instance_name || data?.instanceName || rawPayload?.instance || rawPayload?.instance_name || rawPayload?.instanceName || '').trim();
  const instanceType = String(resolvedPayload.instanceType || resolvedPayload.instance_type || data?.instanceType || data?.instance_type || rawPayload?.instanceType || rawPayload?.instance_type || '').trim().toLowerCase();
  const rawMessage = data?.message || data?.messages?.[0] || rawPayload?.message || rawPayload?.messages?.[0] || data?.msg || data?.messageData || data || {};
  const remoteJid = String(rawMessage.remoteJid || rawMessage.remote_jid || rawMessage.key?.remoteJid || data?.remoteJid || data?.remote_jid || resolvedPayload.remoteJid || resolvedPayload.remote_jid || rawPayload?.remoteJid || rawPayload?.remote_jid || '').trim();
  const messageId = String(
    rawMessage.key?.id
    || rawMessage.id
    || rawMessage.messageId
    || rawMessage.message_id
    || data?.messageId
    || data?.message_id
    || resolvedPayload.messageId
    || resolvedPayload.message_id
    || resolvedPayload.id
    || rawPayload?.messageId
    || rawPayload?.message_id
    || rawPayload?.data?.messageId
    || rawPayload?.data?.message_id
    || ''
  ).trim();
  const fromMe = Boolean(
    rawMessage.key?.fromMe
    ?? rawMessage.fromMe
    ?? data?.fromMe
    ?? rawPayload?.fromMe
    ?? (normalizedDirection ? normalizedDirection === 'outbound' : undefined)
    ?? resolvedPayload.fromMe
  );
  const text =
    rawMessage.message?.conversation
    || rawMessage.message?.extendedTextMessage?.text
    || rawMessage.message?.imageMessage?.caption
    || rawMessage.message?.videoMessage?.caption
    || rawMessage.conversation
    || rawMessage.text
    || data?.text
    || resolvedPayload.text
    || '';
  const messageType = String(
    rawMessage.messageType
    || rawMessage.message?.conversation && 'conversation'
    || Object.keys(rawMessage.message || {})[0]
    || rawMessage.type
    || data?.messageType
    || resolvedPayload.messageType
    || 'unknown'
  ).trim() || 'unknown';
  const fallbackUpsert = Boolean(
    normalizedDirection
    && messageId
    && (remoteJid || resolvedPayload.phone || resolvedPayload.telefone || resolvedPayload.celular || resolvedPayload.whatsapp)
  );
  const eventType = rawEventType || (fallbackUpsert ? 'messages.upsert' : '');

  return {
    eventType,
    instanceName,
    instanceType,
    remoteJid,
    messageId,
    text: String(text || ''),
    messageType,
    fromMe,
    rawMessage,
    timestamp: resolvedPayload.timestamp || data?.timestamp || rawPayload?.timestamp || null
  };
}

export function mapMessageDirection(fromMe) {
  return fromMe ? 'outbound' : 'inbound';
}

export function mapSenderType(direction) {
  return direction === 'outbound' ? 'vendedor' : 'cliente';
}
