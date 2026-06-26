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
  const eventType = String(payload.event || payload.event_type || payload.type || '').trim();
  const data = payload.data || payload.message || payload.messages?.[0] || payload;
  const instanceName = String(payload.instance || payload.instance_name || payload.instanceName || data?.instance || data?.instance_name || '').trim();
  const rawMessage = data?.message || data?.messages?.[0] || data?.msg || data?.messageData || data || {};
  const remoteJid = String(rawMessage.remoteJid || rawMessage.remote_jid || rawMessage.key?.remoteJid || data?.remoteJid || data?.remote_jid || payload.remoteJid || payload.remote_jid || '').trim();
  const messageId = String(rawMessage.key?.id || rawMessage.id || data?.messageId || data?.message_id || payload.messageId || payload.message_id || '').trim();
  const fromMe = Boolean(rawMessage.key?.fromMe ?? rawMessage.fromMe ?? data?.fromMe ?? payload.fromMe);
  const text =
    rawMessage.message?.conversation
    || rawMessage.message?.extendedTextMessage?.text
    || rawMessage.message?.imageMessage?.caption
    || rawMessage.message?.videoMessage?.caption
    || rawMessage.conversation
    || rawMessage.text
    || data?.text
    || '';
  const messageType = String(
    rawMessage.messageType
    || rawMessage.message?.conversation && 'conversation'
    || Object.keys(rawMessage.message || {})[0]
    || rawMessage.type
    || data?.messageType
    || 'unknown'
  ).trim() || 'unknown';

  return {
    eventType,
    instanceName,
    remoteJid,
    messageId,
    text: String(text || ''),
    messageType,
    fromMe,
    rawMessage
  };
}

export function mapMessageDirection(fromMe) {
  return fromMe ? 'outbound' : 'inbound';
}

export function mapSenderType(direction) {
  return direction === 'outbound' ? 'vendedor' : 'cliente';
}
