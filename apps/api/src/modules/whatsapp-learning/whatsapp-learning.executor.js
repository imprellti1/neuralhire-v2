import { logger } from '../../core/logger.js';
import { claimNormalizedLearningEvent, listNormalizedLearningEvents, normalizeLearningEvent } from './whatsapp-learning.repository.js';
import { analyzeLearningEvent } from './cognitive-provider.js';

function safeAnalysisMetadata(event = {}, analysis = {}) {
  const processedAt = new Date().toISOString();
  return {
    ...(event.metadata && typeof event.metadata === 'object' ? event.metadata : {}),
    cognitive: {
      status: analysis.status || 'disabled',
      provider: analysis.provider ?? null,
      model: analysis.model ?? null,
      processed_at: processedAt,
      error: analysis.error ?? null
    },
  };
}

function buildCognitivePayload(event = {}, analysis = {}) {
  const processedAt = new Date().toISOString();
  return {
    status: analysis.status || 'disabled',
    provider: analysis.provider ?? null,
    model: analysis.model ?? null,
    processed_at: processedAt,
    error: analysis.error ?? null
  };
}

function sanitizeAnalysisResult(analysis = {}) {
  return {
    intent: analysis.intent || 'unknown',
    sentiment: analysis.sentiment || 'neutral',
    importance: Number.isFinite(Number(analysis.importance)) ? Math.min(10, Math.max(1, Math.round(Number(analysis.importance)))) : 1,
    summary: analysis.summary ?? null,
    entities: analysis.entities && typeof analysis.entities === 'object' && !Array.isArray(analysis.entities) ? analysis.entities : {},
    topics: Array.isArray(analysis.topics) ? analysis.topics : [],
    needs_followup: Boolean(analysis.needs_followup),
    next_action: analysis.next_action ?? null
  };
}

export async function executeWhatsappLearningWorker(context = {}) {
  const accountId = context.accountId || null;
  const limit = Math.max(1, Number(context.limit) || 5);
  const normalizedEvents = await listNormalizedLearningEvents({ accountId, limit });
  let processed = 0;
  let cognitivelyProcessed = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of normalizedEvents) {
    const claimed = await claimNormalizedLearningEvent(event.id, { accountId });
    if (!claimed) {
      skipped += 1;
      continue;
    }

    try {
      const analysis = await analyzeLearningEvent({
        event_id: claimed.id,
        account_id: accountId,
        normalized_text: claimed.normalized_text || '',
        normalized_payload: claimed.normalized_payload && typeof claimed.normalized_payload === 'object' ? claimed.normalized_payload : {},
        metadata: claimed.metadata && typeof claimed.metadata === 'object' ? claimed.metadata : {}
      });

      const cognitive = buildCognitivePayload(claimed, analysis);
      await normalizeLearningEvent(claimed.id, {
        status: 'processed',
        ...sanitizeAnalysisResult(analysis),
        processing_error: null,
        processed_at: cognitive.processed_at,
        metadata: safeAnalysisMetadata(claimed, analysis),
        normalized_payload: {
          ...(claimed.normalized_payload && typeof claimed.normalized_payload === 'object' ? claimed.normalized_payload : {}),
          cognitive
        }
      }, { accountId });
      processed += 1;
      cognitivelyProcessed += 1;
    } catch (error) {
      logger.error({ message: 'whatsapp_learning_worker_failed', error: error?.message || String(error), account_id: accountId, event_id: claimed.id });
      await normalizeLearningEvent(claimed.id, {
        status: 'failed',
        processing_error: error?.message || String(error),
        error: error?.message || String(error)
      }, { accountId });
      failed += 1;
    }
  }

  return { ok: true, processed, cognitivelyProcessed, failed, skipped, scanned: normalizedEvents.length };
}
