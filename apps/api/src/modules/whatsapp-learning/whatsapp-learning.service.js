import { logger } from '../../core/logger.js';
import { mapWhatsappLearningAnalysis } from './whatsapp-learning.mapper.js';
import { listPendingLearningEvents, updateLearningEvent } from './whatsapp-learning.repository.js';

function classifyText(text = '') {
  const value = String(text || '').trim().toLowerCase();
  if (!value) return { intent: 'unknown', sentiment: 'neutral', importance: 1, summary: '', entities: [], topics: [], needs_followup: false, next_action: null };
  if (value === 'oi' || value === 'olá' || value === 'ola' || value === 'bom dia' || value === 'boa tarde' || value === 'boa noite') {
    return { intent: 'greeting', sentiment: 'neutral', importance: 1, summary: 'Saudação inicial.', entities: [], topics: ['saudacao'], needs_followup: false, next_action: null };
  }
  if (value.includes('orçamento') || value.includes('orcamento') || value.includes('cotação') || value.includes('cotacao') || value.includes('preço') || value.includes('preco')) {
    return { intent: 'quotation', sentiment: 'neutral', importance: 7, summary: 'Pedido de orçamento ou cotação.', entities: [], topics: ['orçamento'], needs_followup: true, next_action: 'Responder com orçamento e próximos passos' };
  }
  if (value.includes('não gostei') || value.includes('nao gostei') || value.includes('atraso') || value.includes('problema') || value.includes('reclama')) {
    return { intent: 'complaint', sentiment: 'negative', importance: 8, summary: 'Mensagem com insatisfação ou reclamação.', entities: [], topics: ['reclamação'], needs_followup: true, next_action: 'Acolher a reclamação e investigar a causa' };
  }
  return { intent: 'information', sentiment: 'neutral', importance: 3, summary: text.slice(0, 300), entities: [], topics: ['informação'], needs_followup: false, next_action: null };
}

export async function analyzeWhatsappLearningMessage(message = {}, options = {}) {
  if (String(message.body || '') === '__force_error__') {
    throw new Error('forced_learning_analysis_failure');
  }
  if (String(message.content_type || 'text') !== 'text') {
    return mapWhatsappLearningAnalysis({ intent: 'unknown', sentiment: 'neutral', importance: 1, summary: 'Conteúdo multimodal ainda não habilitado.', entities: [], topics: ['multimodal'], needs_followup: false, next_action: null, metadata: { skipped_reason: 'content_type_not_supported' } });
  }
  return mapWhatsappLearningAnalysis(classifyText(message.body || ''));
}

export async function runWhatsappLearningWorker(context = {}) {
  const accountId = context.accountId || null;
  const limit = Math.max(1, Number(context.limit) || 5);
  const events = await listPendingLearningEvents({ accountId, limit });
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const analysis = await analyzeWhatsappLearningMessage(event, context);
      await updateLearningEvent(event.id, {
        ...analysis,
        status: 'processed',
        processed_at: new Date().toISOString(),
        error: null
      }, { accountId });
      processed += 1;
    } catch (error) {
      logger.error({ message: 'whatsapp_learning_worker_failed', error: error?.message || String(error), account_id: accountId, event_id: event.id });
      await updateLearningEvent(event.id, { status: 'failed', error: error?.message || String(error) }, { accountId });
      failed += 1;
    }
  }

  return { ok: true, processed, failed, scanned: events.length };
}
