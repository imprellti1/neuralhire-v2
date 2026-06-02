import { normalizeSendPayload, normalizeWebhookPayload } from './whatsapp-delivery.schemas.js';
import { getWhatsappDeliveryRepositoryMode, registerWebhookEvent, sendApprovedDraft } from './whatsapp-delivery.repository.js';

export async function sendWhatsappDeliveryHandler(context = {}) {
  const { draftId } = normalizeSendPayload(context.body || {});
  return { ...await sendApprovedDraft(draftId, { accountId: context.accountId, createdBy: context.user?.id || null }), repositoryMode: getWhatsappDeliveryRepositoryMode() };
}

export async function whatsappDeliveryWebhookHandler(context = {}) {
  await registerWebhookEvent(normalizeWebhookPayload(context.body || {}), { accountId: context.accountId, createdBy: context.user?.id || null });
  return { ok: true };
}
