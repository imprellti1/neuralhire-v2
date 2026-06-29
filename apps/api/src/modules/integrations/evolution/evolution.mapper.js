const NON_DIGITS = /[^0-9]/g;

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
  const rawPayload = payload.raw && typeof payload.raw === 'object' ? payload.raw : null;
  const data = payload.data || rawPayload?.data || payload.message || payload.messages?.[0] || rawPayload || payload;
  const normalizedDirection = String(payload.direction || data?.direction || '').trim().toLowerCase();
  const rawEventType = String(payload.event || payload.event_type || payload.type || rawPayload?.event || rawPayload?.event_type || rawPayload?.type || '').trim();
  const instanceName = String(payload.instance || payload.instance_name || payload.instanceName || data?.instance || data?.instance_name || data?.instanceName || rawPayload?.instance || rawPayload?.instance_name || rawPayload?.instanceName || '').trim();
  const instanceType = String(payload.instanceType || payload.instance_type || data?.instanceType || data?.instance_type || rawPayload?.instanceType || rawPayload?.instance_type || '').trim().toLowerCase();
  const rawMessage = data?.message || data?.messages?.[0] || rawPayload?.message || rawPayload?.messages?.[0] || data?.msg || data?.messageData || data || {};
  const remoteJid = String(rawMessage.remoteJid || rawMessage.remote_jid || rawMessage.key?.remoteJid || data?.remoteJid || data?.remote_jid || payload.remoteJid || payload.remote_jid || rawPayload?.remoteJid || rawPayload?.remote_jid || '').trim();
  const messageId = String(
    rawMessage.key?.id
    || rawMessage.id
    || rawMessage.messageId
    || rawMessage.message_id
    || data?.messageId
    || data?.message_id
    || payload.messageId
    || payload.message_id
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
    ?? payload.fromMe
  );
  const text =
    rawMessage.message?.conversation
    || rawMessage.message?.extendedTextMessage?.text
    || rawMessage.message?.imageMessage?.caption
    || rawMessage.message?.videoMessage?.caption
    || rawMessage.conversation
    || rawMessage.text
    || data?.text
    || payload.text
    || '';
  const messageType = String(
    rawMessage.messageType
    || rawMessage.message?.conversation && 'conversation'
    || Object.keys(rawMessage.message || {})[0]
    || rawMessage.type
    || data?.messageType
    || payload.messageType
    || 'unknown'
  ).trim() || 'unknown';
  const fallbackUpsert = Boolean(
    normalizedDirection
    && messageId
    && (remoteJid || payload.phone || payload.telefone || payload.celular || payload.whatsapp)
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
    timestamp: payload.timestamp || data?.timestamp || rawPayload?.timestamp || null
  };
}

export function mapMessageDirection(fromMe) {
  return fromMe ? 'outbound' : 'inbound';
}

export function mapSenderType(direction) {
  return direction === 'outbound' ? 'vendedor' : 'cliente';
}
