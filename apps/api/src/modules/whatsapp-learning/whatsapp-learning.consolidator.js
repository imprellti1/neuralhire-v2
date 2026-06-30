import { logger } from '../../core/logger.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { markLearningKnowledgeConsolidated } from './whatsapp-learning.repository.js';
import { upsertCustomerKnowledge } from './customer-knowledge.repository.js';

const KNOWLEDGE_RULES = [
  { key: 'preferencia_entrega', type: 'preference', patterns: [/entrega/i, /frete/i, /entregar/i, /receber/i] },
  { key: 'endereco_localizacao', type: 'location', patterns: [/endereco/i, /rua/i, /avenida/i, /bairro/i, /cidade/i, /cep/i, /local/i] },
  { key: 'objecao_comercial', type: 'objection', patterns: [/caro/i, /preco/i, /valor/i, /na[oã] quero/i, /sem interesse/i, /depois/i] },
  { key: 'interesse_produto', type: 'interest', patterns: [/quero/i, /preciso/i, /tenho interesse/i, /cotacao/i, /orcamento/i, /pedido/i] },
  { key: 'reclamacao', type: 'complaint', patterns: [/reclama/i, /problema/i, /erro/i, /falha/i, /atraso/i, /ruim/i] },
  { key: 'condicao_comercial', type: 'commercial_condition', patterns: [/prazo/i, /pagamento/i, /parcel/i, /condicao/i, /desconto/i] },
  { key: 'preferencia_contato', type: 'contact_preference', patterns: [/whatsapp/i, /ligar/i, /telefone/i, /contato/i, /retornar/i] },
  { key: 'informacao_operacional', type: 'operational', patterns: [/estoque/i, /dispon[ií]vel/i, /aberto/i, /horario/i, /coleta/i, /retirada/i] }
];

function cleanText(value) { return String(value ?? '').trim(); }
function hasUsefulContent(text) { return cleanText(text).length > 0; }
function normalizeScope(event = {}) {
  const metadata = event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata) ? event.metadata : {};
  const normalizedPayload = event.normalized_payload && typeof event.normalized_payload === 'object' ? event.normalized_payload : {};
  return {
    phone: cleanText(event.phone || metadata.phone || normalizedPayload.contact?.phone || ''),
    remoteJid: cleanText(event.remote_jid || metadata.remote_jid || metadata.remoteJid || ''),
    sourceInstanceType: cleanText(metadata.instance_type || normalizedPayload.metadata?.instance_type || ''),
    sourceInstance: cleanText(metadata.instance_name || normalizedPayload.metadata?.instance_name || '')
  };
}

function inferKnowledgeKey(text) {
  const normalized = cleanText(text).toLowerCase();
  for (const rule of KNOWLEDGE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) return { knowledgeKey: rule.key, knowledgeType: rule.type };
  }
  return null;
}

function buildSourceEventRef(event, rule) {
  return {
    event_id: event.id,
    source_event_id: event.source_event_id || event.id,
    created_at: event.created_at || null,
    last_seen_at: event.created_at || event.updated_at || null,
    knowledge_key: rule.knowledgeKey
  };
}

async function listEligibleLearningKnowledge(accountId, limit = 100) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('whatsapp_learning_knowledge')
      .select('*')
      .eq('account_id', accountId)
      .or('status.is.null,status.eq.learned,status.eq.consolidation_pending')
      .order('created_at', { ascending: true })
      .limit(Math.max(1, Number(limit) || 100));
    if (error) throw error;
    return data || [];
  }
  const { __dumpMemoryWhatsappLearningKnowledgeForTests } = await import('./whatsapp-learning.repository.js');
  return __dumpMemoryWhatsappLearningKnowledgeForTests().filter((item) => item.account_id === accountId && ['learned', 'consolidation_pending', null, undefined].includes(item.status)).slice(0, Math.max(1, Number(limit) || 100));
}

export async function consolidateWhatsappLearningKnowledge(context = {}) {
  const accountId = context.accountId || null;
  const limit = Math.max(1, Number(context.limit) || 100);
  const events = await listEligibleLearningKnowledge(accountId, limit);
  let processed = 0;
  let skipped = 0;

  for (const event of events) {
    const normalizedText = cleanText(event.normalized_text || event.normalizedText || '');
    if (!hasUsefulContent(normalizedText)) {
      skipped += 1;
      continue;
    }
    const rule = inferKnowledgeKey(normalizedText);
    if (!rule) {
      skipped += 1;
      continue;
    }
    const scope = normalizeScope(event);
    if (!scope.phone && !scope.remoteJid) {
      skipped += 1;
      continue;
    }

    const sourceMetadata = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
    const result = await upsertCustomerKnowledge({
      accountId,
      customerId: event.customer_id || null,
      phone: scope.phone || null,
      remoteJid: scope.remoteJid || null,
      knowledgeKey: rule.knowledgeKey,
      knowledgeValue: normalizedText,
      knowledgeType: rule.knowledgeType,
      confidence: Number(event.confidence ?? 0.5),
      firstSeenAt: event.created_at || new Date().toISOString(),
      lastSeenAt: event.created_at || event.updated_at || new Date().toISOString(),
      occurrences: 1,
      sourceEvents: [buildSourceEventRef(event, rule)],
      metadata: {
        source_instance_type: scope.sourceInstanceType || sourceMetadata.instance_type || null,
        source_instance: scope.sourceInstance || sourceMetadata.instance_name || null,
        source_provider: sourceMetadata.provider || null,
        learning_source: sourceMetadata.learning_source || 'whatsapp_persisted_message',
        original_status: event.status || 'learned'
      },
      status: 'active'
    }, { accountId });

    await markLearningKnowledgeConsolidated(event.source_event_id || event.id, {
      knowledge_key: rule.knowledgeKey,
      customer_knowledge_id: result.item?.id || null,
      metadata: {
        consolidated_at: new Date().toISOString(),
        source_instance_type: scope.sourceInstanceType || sourceMetadata.instance_type || null,
        knowledge_key: rule.knowledgeKey
      }
    }, { accountId }).catch(() => null);
    processed += 1;
  }

  if (processed > 0) {
    logger.info({ message: 'whatsapp_learning_knowledge_consolidated', account_id: accountId, processed, skipped });
  }

  return { ok: true, processed, skipped, scanned: events.length };
}
