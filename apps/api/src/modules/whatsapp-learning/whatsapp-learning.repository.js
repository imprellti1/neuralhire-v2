import { randomUUID } from 'node:crypto';
import { DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { buildMediaAttachment } from '../media-manager/media-manager.js';

const memoryEvents = [];

function now() { return new Date().toISOString(); }
function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'whatsapp-learning' }); }
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }

function normalizeKey(accountId, whatsappMessageId) {
  return `${String(accountId || '').trim()}::${String(whatsappMessageId || '').trim()}`;
}

function normalizeInitialImportance(value) {
  if (value === 'low') return 1;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.min(10, Math.max(1, Math.round(numeric)));
  return 1;
}

function cleanText(value) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : '';
}

function buildMetadata(original = {}, extras = {}) {
  const metadata = original && typeof original === 'object' && !Array.isArray(original) ? { ...original } : {};
  return { ...metadata, ...extras };
}

function normalizeMessageType(value) {
  return cleanText(value).toLowerCase() || 'unknown';
}

function inferDocumentContentType(messageType, metadata = {}) {
  const normalizedType = normalizeMessageType(messageType);
  const mimeType = cleanText(metadata.mime_type || metadata.mimeType).toLowerCase();
  const fileName = cleanText(metadata.file_name || metadata.fileName).toLowerCase();

  if (normalizedType === 'pdf' || mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (normalizedType === 'spreadsheet' || mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'spreadsheet';
  if (normalizedType === 'csv' || mimeType === 'text/csv' || fileName.endsWith('.csv')) return 'csv';
  if (normalizedType === 'document') return 'document';
  return normalizedType;
}

function buildRow(data = {}) {
  return {
    id: randomUUID(),
    account_id: data.accountId,
    whatsapp_message_id: data.whatsappMessageId || null,
    message_id: data.messageId || null,
    conversation_id: data.conversationId || null,
    lead_id: data.leadId || null,
    source: data.source || 'whatsapp',
    content_type: data.contentType || 'text',
    body: data.body || null,
    intent: data.intent || 'unknown',
    sentiment: data.sentiment || 'neutral',
    importance: normalizeInitialImportance(data.importance ?? 'low'),
    summary: data.summary || null,
    needs_followup: Boolean(data.needsFollowup ?? false),
    next_action: data.nextAction || null,
    entities: data.entities && typeof data.entities === 'object' ? data.entities : {},
    topics: Array.isArray(data.topics) ? data.topics : [],
    metadata: data.metadata && typeof data.metadata === 'object' && !Array.isArray(data.metadata) ? data.metadata : {},
    normalized_text: data.normalizedText || null,
    normalized_payload: data.normalizedPayload && typeof data.normalizedPayload === 'object' && !Array.isArray(data.normalizedPayload) ? data.normalizedPayload : null,
    normalized_at: data.normalizedAt || null,
    processing_error: data.processingError || null,
    status: data.status || 'pending',
    processed_at: data.processedAt || null,
    error: data.error || null,
    created_at: now(),
    updated_at: now()
  };
}

export function buildWhatsappLearningNormalizedPayload(event = {}) {
  const metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {};
  const messageType = normalizeMessageType(metadata.message_type || event.content_type || 'text');
  const contentType = inferDocumentContentType(messageType, metadata);
  const body = cleanText(event.body);
  const caption = cleanText(metadata.caption || metadata.text || body);
  const location = metadata.location && typeof metadata.location === 'object' && !Array.isArray(metadata.location) ? metadata.location : null;
  const contact = metadata.contact && typeof metadata.contact === 'object' && !Array.isArray(metadata.contact) ? metadata.contact : null;
  const reaction = metadata.reaction && typeof metadata.reaction === 'object' && !Array.isArray(metadata.reaction) ? metadata.reaction : null;
  const attachments = [];
  let text = '';

  if (contentType === 'text') {
    text = body;
  } else if (contentType === 'image') {
    text = caption;
    attachments.push(buildMediaAttachment('image', metadata, {
      metadata: buildMetadata(metadata.metadata, metadata.original_metadata)
    }));
  } else if (contentType === 'audio') {
    attachments.push(buildMediaAttachment('audio', metadata, {
      metadata: buildMetadata(metadata.metadata, metadata.original_metadata)
    }));
  } else if (contentType === 'video') {
    text = caption;
    attachments.push(buildMediaAttachment('video', metadata, {
      metadata: buildMetadata(metadata.metadata, metadata.original_metadata)
    }));
  } else if (['pdf', 'spreadsheet', 'csv', 'document'].includes(contentType)) {
    attachments.push(buildMediaAttachment(contentType, metadata, {
      metadata: buildMetadata(metadata.metadata, metadata.original_metadata)
    }));
  } else if (contentType === 'location') {
    return {
      version: 1,
      channel: 'whatsapp',
      content_type: 'location',
      language: 'pt-BR',
      text: '',
      attachments: [],
      location: {
        latitude: location?.latitude ?? metadata.latitude ?? metadata.lat ?? null,
        longitude: location?.longitude ?? metadata.longitude ?? metadata.lng ?? null,
        name: location?.name ?? metadata.name ?? null,
        address: location?.address ?? metadata.address ?? null,
        metadata: buildMetadata(location?.metadata, metadata.location_metadata)
      },
      metadata: buildMetadata(metadata, {
        provider: metadata.provider || 'evolution',
        instance_name: metadata.instance_name || null,
        instance_type: metadata.instance_type || null,
        direction: metadata.direction || null,
        learning_source: metadata.learning_source || 'whatsapp_persisted_message',
        message_type: messageType
      })
    };
  } else if (contentType === 'contact') {
    return {
      version: 1,
      channel: 'whatsapp',
      content_type: 'contact',
      language: 'pt-BR',
      text: '',
      attachments: [],
      contact: {
        name: contact?.name ?? metadata.contact_name ?? metadata.name ?? null,
        phone: contact?.phone ?? metadata.phone ?? null,
        email: contact?.email ?? metadata.email ?? null,
        metadata: buildMetadata(contact?.metadata, metadata.contact_metadata)
      },
      metadata: buildMetadata(metadata, {
        provider: metadata.provider || 'evolution',
        instance_name: metadata.instance_name || null,
        instance_type: metadata.instance_type || null,
        direction: metadata.direction || null,
        learning_source: metadata.learning_source || 'whatsapp_persisted_message',
        message_type: messageType
      })
    };
  } else if (contentType === 'reaction') {
    return {
      version: 1,
      channel: 'whatsapp',
      content_type: 'reaction',
      language: 'pt-BR',
      text: '',
      attachments: [],
      reaction: {
        emoji: reaction?.emoji ?? metadata.emoji ?? null,
        target_message_id: reaction?.target_message_id ?? metadata.target_message_id ?? metadata.targetMessageId ?? null,
        metadata: buildMetadata(reaction?.metadata, metadata.reaction_metadata)
      },
      metadata: buildMetadata(metadata, {
        provider: metadata.provider || 'evolution',
        instance_name: metadata.instance_name || null,
        instance_type: metadata.instance_type || null,
        direction: metadata.direction || null,
        learning_source: metadata.learning_source || 'whatsapp_persisted_message',
        message_type: messageType
      })
    };
  } else if (contentType === 'sticker') {
    attachments.push(buildMediaAttachment('sticker', metadata, {
      metadata: buildMetadata(metadata.metadata, metadata.original_metadata)
    }));
  } else {
    return {
      version: 1,
      channel: 'whatsapp',
      content_type: 'unknown',
      language: 'pt-BR',
      text: '',
      attachments: [],
      metadata: buildMetadata(metadata, {
        provider: metadata.provider || 'evolution',
        instance_name: metadata.instance_name || null,
        instance_type: metadata.instance_type || null,
        direction: metadata.direction || null,
        learning_source: metadata.learning_source || 'whatsapp_persisted_message',
        message_type: messageType
      })
    };
  }

  const normalizedMetadata = {
    provider: event.metadata?.provider || 'evolution',
    instance_name: metadata.instance_name || null,
    instance_type: metadata.instance_type || null,
    direction: metadata.direction || null,
    learning_source: metadata.learning_source || 'whatsapp_persisted_message',
    message_type: messageType
  };

  return {
    version: 1,
    channel: 'whatsapp',
    content_type: contentType,
    language: 'pt-BR',
    text,
    attachments,
    metadata: normalizedMetadata
  };
}

export function __resetMemoryWhatsappLearningForTests() { memoryEvents.length = 0; }
export function __dumpMemoryWhatsappLearningForTests() {
  return memoryEvents.map((item) => ({
    ...item,
    entities: Array.isArray(item.entities) ? [...item.entities] : { ...(item.entities || {}) },
    topics: [...(item.topics || [])],
    metadata: { ...(item.metadata || {}) }
  }));
}

export async function createLearningEvent(data = {}, options = {}) {
  const accountId = options.accountId || data.accountId || null;
  assertAccountId(accountId);
  const whatsappMessageId = data.whatsappMessageId || null;
  const key = normalizeKey(accountId, whatsappMessageId);
  if (!whatsappMessageId) throw new DatabaseError('whatsappMessageId obrigatorio');

  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: existing, error: existingError } = await supabase.from('whatsapp_learning_events').select('*').eq('account_id', accountId).eq('whatsapp_message_id', whatsappMessageId).maybeSingle();
    if (existingError) throw new DatabaseError('Falha ao consultar evento de aprendizagem', { details: existingError });
    if (existing) return { item: existing, status: 'already_exists' };
    const row = buildRow({ ...data, accountId, whatsappMessageId });
    const { data: created, error } = await supabase.from('whatsapp_learning_events').insert(row).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar evento de aprendizagem', { details: error });
    return { item: created || row, status: 'created' };
  }

  const existing = memoryEvents.find((item) => normalizeKey(item.account_id, item.whatsapp_message_id) === key) || null;
  if (existing) return { item: existing, status: 'already_exists' };
  const row = buildRow({ ...data, accountId, whatsappMessageId });
  memoryEvents.push(row);
  return { item: row, status: 'created' };
}

export async function normalizeLearningEvent(eventId, patch = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_learning_events')
      .update({ ...patch, updated_at: now() })
      .eq('id', eventId)
      .eq('account_id', accountId)
      .select('*')
      .single();
    if (error) throw new DatabaseError('Falha ao normalizar evento de aprendizagem', { details: error });
    return data;
  }
  const idx = memoryEvents.findIndex((item) => item.id === eventId && item.account_id === accountId);
  if (idx < 0) return null;
  memoryEvents[idx] = { ...memoryEvents[idx], ...patch, updated_at: now() };
  return memoryEvents[idx];
}

export async function listPendingLearningEvents({ accountId, limit = 10 } = {}) {
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('whatsapp_learning_events').select('*').eq('account_id', accountId).eq('status', 'pending').order('created_at', { ascending: true }).limit(Math.max(1, Number(limit) || 10));
    if (error) throw new DatabaseError('Falha ao listar eventos de aprendizagem', { details: error });
    return data || [];
  }
  return memoryEvents.filter((item) => item.account_id === accountId && item.status === 'pending').slice(0, Math.max(1, Number(limit) || 10));
}

export async function listNormalizedLearningEvents({ accountId, limit = 10 } = {}) {
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('whatsapp_learning_events').select('*').eq('account_id', accountId).eq('status', 'normalized').order('created_at', { ascending: true }).limit(Math.max(1, Number(limit) || 10));
    if (error) throw new DatabaseError('Falha ao listar eventos de aprendizagem normalizados', { details: error });
    return data || [];
  }
  return memoryEvents.filter((item) => item.account_id === accountId && item.status === 'normalized').slice(0, Math.max(1, Number(limit) || 10));
}

export async function claimNormalizedLearningEvent(eventId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_learning_events')
      .update({ status: 'processing', processing_error: null, updated_at: now() })
      .eq('id', eventId)
      .eq('account_id', accountId)
      .eq('status', 'normalized')
      .select('*')
      .single();
    if (error) {
      const notFound = String(error?.code || '') === 'PGRST116' || String(error?.message || '').toLowerCase().includes('no rows');
      if (notFound) return null;
      throw new DatabaseError('Falha ao reservar evento de aprendizagem', { details: error });
    }
    return data;
  }
  const idx = memoryEvents.findIndex((item) => item.id === eventId && item.account_id === accountId && item.status === 'normalized');
  if (idx < 0) return null;
  memoryEvents[idx] = { ...memoryEvents[idx], status: 'processing', processing_error: null, updated_at: now() };
  return memoryEvents[idx];
}

export async function updateLearningEvent(eventId, patch = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('whatsapp_learning_events').update({ ...patch, updated_at: now() }).eq('id', eventId).eq('account_id', accountId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar evento de aprendizagem', { details: error });
    return data;
  }
  const idx = memoryEvents.findIndex((item) => item.id === eventId && item.account_id === accountId);
  if (idx < 0) return null;
  memoryEvents[idx] = { ...memoryEvents[idx], ...patch, updated_at: now() };
  return memoryEvents[idx];
}
