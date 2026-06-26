import { logger } from '../../../core/logger.js';
import { env } from '../../../config/env.js';
import { createTimelineEventForCustomer, findCustomerByPhone, findOrCreateConversation, findOrCreateLead, linkMessageAfterSave, normalizeInstanceType, upsertWhatsappMessage } from './evolution.repository.js';
import { mapEvolutionWebhookEvent, mapMessageDirection, mapSenderType, normalizeWhatsAppPhone } from './evolution.mapper.js';

function allowHeaderAccountFallback() {
  const appEnv = String(env.APP_ENV || '').toLowerCase();
  return appEnv === 'development' || appEnv === 'homologation' || env.NODE_ENV === 'test';
}

function resolveAccountId(context = {}) {
  if (context.accountId) return { accountId: context.accountId, source: 'context' };
  if (allowHeaderAccountFallback()) {
    const headerAccountId = context.headers?.['x-account-id'] || context.headers?.['X-Account-Id'] || null;
    if (headerAccountId) return { accountId: headerAccountId, source: 'header-x-account-id' };
  }
  return { accountId: null, source: 'unresolved' };
}

function resolveContactName(payload = {}, mapped = {}) {
  return payload.contact_name || payload.contactName || payload.name || mapped.instanceName || null;
}

function resolveInstanceType(context = {}) {
  const headerValue = context.headers?.['x-instance-type'] || context.headers?.['X-Instance-Type'] || context.headers?.['X-INSTANCE-TYPE'] || null;
  return normalizeInstanceType(headerValue || 'operational');
}

export async function processEvolutionWebhook(payload = {}, context = {}) {
  const { accountId, source } = resolveAccountId(context);
  const mapped = mapEvolutionWebhookEvent(payload);
  const instanceType = resolveInstanceType(context);
  const phone = normalizeWhatsAppPhone({ remote_jid: mapped.remoteJid, phone: payload.phone, telefone: payload.telefone, celular: payload.celular, whatsapp: payload.whatsapp });

  logger.info('evolution_webhook_received', { accountId, accountSource: source, eventType: mapped.eventType, instanceName: mapped.instanceName, instanceType, remoteJid: mapped.remoteJid, phoneNormalized: phone });
  logger.info('evolution_instance_type_detected', { accountId, instanceType, instanceName: mapped.instanceName, eventType: mapped.eventType });

  if (!accountId) {
    return { ok: false, processed: false, status: 'ignored', eventType: mapped.eventType || 'unknown', messageId: null, code: 'ACCOUNT_ID_REQUIRED' };
  }

  if (!mapped.eventType || mapped.eventType !== 'messages.upsert') {
    logger.info('evolution_message_skipped', { accountId, eventType: mapped.eventType || 'unknown', reason: 'event_not_supported' });
    return { ok: true, processed: false, status: 'ignored', eventType: mapped.eventType || 'unknown', messageId: null };
  }

  if (!mapped.messageId) {
    return { ok: false, processed: false, status: 'ignored', eventType: mapped.eventType, messageId: null, code: 'MESSAGE_ID_REQUIRED' };
  }

  const direction = mapMessageDirection(mapped.fromMe);
  const contactName = resolveContactName(payload, mapped);
  const itemPayload = {
    provider: 'evolution',
    eventType: mapped.eventType,
    messageId: mapped.messageId,
    remoteJid: mapped.remoteJid,
    phoneNormalized: phone,
    direction,
    senderType: mapSenderType(direction),
    messageType: mapped.messageType,
    body: mapped.text,
    metadata: { instance_type: instanceType, learning_only: instanceType === 'learning' },
    rawPayload: payload,
    receivedAt: new Date().toISOString()
  };

  const messageResult = await upsertWhatsappMessage(itemPayload, { accountId });
  if (messageResult.status === 'already_exists' && !messageResult.needsLinking) {
    logger.info('evolution_message_skipped', { accountId, eventType: mapped.eventType, messageId: mapped.messageId, reason: 'already_exists' });
    return { ok: true, processed: true, messageId: mapped.messageId, eventType: mapped.eventType, status: 'already_exists' };
  }

  const match = await findCustomerByPhone(accountId, phone);
  const customer = match.cliente || null;
  const ambiguous = Array.isArray(match.candidates) && match.candidates.length > 1 && !customer;

  if (customer) {
    logger.info('evolution_customer_match_found', { accountId, messageId: mapped.messageId, phoneNormalized: phone, customerId: customer.id, matchStrength: match.matchStrength });
    const conversation = await findOrCreateConversation({
      accountId,
      instanceId: null,
      clienteId: customer.id,
      remoteJid: mapped.remoteJid,
      phoneNormalized: phone,
      contactName,
      lastMessageAt: new Date().toISOString(),
    metadata: { source: 'evolution', event_type: mapped.eventType, instance_name: mapped.instanceName, instance_type: instanceType, match_strength: match.matchStrength, provider: 'evolution' }
    });
    logger.info('evolution_conversation_linked', { accountId, messageId: mapped.messageId, conversationId: conversation?.id || null, clienteId: customer.id });
    await linkMessageAfterSave(messageResult.item, { conversationId: conversation?.id || null, clienteId: customer.id, phoneNormalized: phone }, { accountId });
    logger.info('evolution_message_attached', { accountId, messageId: mapped.messageId, conversationId: conversation?.id || null, clienteId: customer.id });

    const timelineResult = await createTimelineEventForCustomer(customer.id, {
      tipo: direction === 'outbound' ? 'whatsapp_message_sent' : 'whatsapp_message_received',
      categoria: 'whatsapp',
      titulo: direction === 'outbound' ? 'Mensagem WhatsApp enviada' : 'Mensagem WhatsApp recebida',
      descricao: mapped.text || '',
      referencia_id: mapped.messageId,
      metadata: {
        provider: 'evolution',
        message_id: mapped.messageId,
        conversation_id: conversation?.id || null,
        remote_jid: mapped.remoteJid,
        direction,
        message_type: mapped.messageType,
        instance_type: instanceType
      }
    }, { accountId });

    if (timelineResult && timelineResult.ok === false) {
      logger.warn('evolution_webhook_error', { accountId, messageId: mapped.messageId, stage: 'timeline', error: timelineResult.error?.message || 'timeline_failed' });
    } else {
      logger.info('evolution_timeline_event_created', { accountId, messageId: mapped.messageId, clienteId: customer.id, conversationId: conversation?.id || null });
    }

    if (messageResult.status === 'created') {
      logger.info(instanceType === 'learning' ? 'evolution_learning_message_ingested' : 'evolution_operational_message_ingested', { accountId, eventType: mapped.eventType, messageId: mapped.messageId, direction, instanceType });
    }
    return { ok: true, processed: true, messageId: mapped.messageId, eventType: mapped.eventType, status: messageResult.status === 'already_exists' ? 'already_exists' : 'created' };
  }

  if (ambiguous) {
    logger.info('evolution_customer_match_ambiguous', { accountId, messageId: mapped.messageId, phoneNormalized: phone, candidateCount: match.candidates.length });
  }

  const leadMetadata = {
    source: 'evolution',
    event_type: mapped.eventType,
    instance_name: mapped.instanceName,
    instance_type: instanceType,
    provider: 'evolution',
    ...(ambiguous ? { match_candidates: match.candidates.map((item) => ({ id: item.id || null, nome: item.nome || null, telefone: item.telefone || item.celular || item.whatsapp || null })) } : {}),
    ...(match.matchStrength === 'weak' ? { match_strength: 'weak' } : {})
  };

  const lead = await findOrCreateLead({
    accountId,
    instanceId: null,
    remoteJid: mapped.remoteJid,
    phoneNormalized: phone,
    contactName,
    metadata: leadMetadata,
    firstMessageAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString()
  });

  logger.info('evolution_lead_created', { accountId, messageId: mapped.messageId, leadId: lead?.id || null, phoneNormalized: phone });
  const conversation = await findOrCreateConversation({
    accountId,
    instanceId: null,
    leadId: lead?.id || null,
    remoteJid: mapped.remoteJid,
    phoneNormalized: phone,
    contactName,
    lastMessageAt: new Date().toISOString(),
    metadata: { source: 'evolution', event_type: mapped.eventType, instance_name: mapped.instanceName, instance_type: instanceType, provider: 'evolution', ...(ambiguous ? { match_candidates: leadMetadata.match_candidates } : {}) }
  });

  logger.info('evolution_conversation_linked', { accountId, messageId: mapped.messageId, conversationId: conversation?.id || null, leadId: lead?.id || null });
  await linkMessageAfterSave(messageResult.item, { conversationId: conversation?.id || null, leadId: lead?.id || null, phoneNormalized: phone }, { accountId });
  logger.info('evolution_message_attached', { accountId, messageId: mapped.messageId, conversationId: conversation?.id || null, leadId: lead?.id || null });

  if (messageResult.status === 'created') {
    logger.info(instanceType === 'learning' ? 'evolution_learning_message_ingested' : 'evolution_operational_message_ingested', { accountId, eventType: mapped.eventType, messageId: mapped.messageId, direction, instanceType });
  }

  return { ok: true, processed: true, messageId: mapped.messageId, eventType: mapped.eventType, status: messageResult.status === 'already_exists' ? 'already_exists' : 'created' };
}
