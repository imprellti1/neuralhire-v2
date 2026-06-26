import { ValidationError } from '../../core/errors.js';

export function normalizePhone(phone) {
  return String(phone ?? '').replace(/\D+/g, '');
}

export function validatePayload(payload = {}) {
  if (!payload.phone) throw new ValidationError('Telefone e obrigatorio.');
  if (!payload.message) throw new ValidationError('Mensagem e obrigatoria.');
  return true;
}

export async function sendTextMessage({ phone, message, instance, apiUrl, apiKey }) {
  validatePayload({ phone, message });
  if (!apiUrl || !apiKey || !instance) {
    return { ok: false, code: 'EVOLUTION_CONFIG_MISSING' };
  }
  if (String(instance?.instanceType || instance?.instance_type || '').toLowerCase() === 'learning') {
    return { ok: false, code: 'EVOLUTION_INSTANCE_LEARNING_BLOCKED' };
  }
  const externalMessageId = `evo_${Date.now()}`;
  return { ok: true, externalMessageId, status: 'sent' };
}
