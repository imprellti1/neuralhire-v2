import { logger } from '../../core/logger.js';
import { embedKnowledge } from './embedding-provider.js';
import { findPendingEmbeddings, markEmbeddingFailed, markEmbeddingProcessed, markEmbeddingProcessing } from './customer-knowledge-embedding.repository.js';

function cleanMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildEmbeddingInput(embedding = {}, accountId = null) {
  return {
    accountId,
    customerKnowledgeId: embedding.customer_knowledge_id || null,
    sourceEventId: embedding.embedding_metadata?.source_event_id || null,
    embeddingHash: embedding.embedding_hash || null,
    embeddingVersion: embedding.embedding_version || 1,
    enabled: false
  };
}

function buildWorkerSummary({ scanned = 0, claimed = 0, processed = 0, failed = 0, skipped = 0, provider = 'disabled' } = {}) {
  return {
    ok: true,
    scanned,
    claimed,
    processed,
    failed,
    skipped,
    ignored: skipped,
    provider,
    disabled: provider === 'disabled'
  };
}

export async function runWhatsappLearningEmbeddingWorker(context = {}) {
  const accountId = context.accountId || null;
  const limit = Math.max(1, Number(context.limit) || 5);
  const embedKnowledgeFn = typeof context.embedKnowledge === 'function' ? context.embedKnowledge : embedKnowledge;
  const workerEnabled = String(context.enabled ?? process.env.EMBEDDING_WORKER_ENABLED ?? 'false').toLowerCase() === 'true';

  if (!workerEnabled) {
    return {
      ok: true,
      disabled: true,
      scanned: 0,
      processed: 0,
      failed: 0,
      ignored: 0,
      provider: 'disabled'
    };
  }

  const embeddings = await findPendingEmbeddings({ accountId, limit });
  let claimed = 0;
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  let lastProvider = 'disabled';

  for (const embedding of embeddings) {
    const claimedEmbedding = await markEmbeddingProcessing({
      accountId,
      id: embedding.id,
      embeddingMetadata: cleanMetadata(embedding.embedding_metadata),
      embeddingProvider: embedding.embedding_provider || null,
      embeddingModel: embedding.embedding_model || null
    });

    if (!claimedEmbedding) {
      skipped += 1;
      continue;
    }

    claimed += 1;

    try {
      const result = await embedKnowledgeFn({
        ...buildEmbeddingInput(claimedEmbedding, accountId),
        enabled: workerEnabled
      });
      lastProvider = result.provider || claimedEmbedding.embedding_provider || 'disabled';
      const metadata = {
        ...cleanMetadata(claimedEmbedding.embedding_metadata),
        embedding_worker: {
          status: result.status || 'disabled',
          provider: result.provider ?? null,
          processed_at: new Date().toISOString()
        }
      };

      if (result.status === 'disabled') {
        await markEmbeddingProcessed({
          accountId,
          id: claimedEmbedding.id,
          embeddingMetadata: metadata,
          embeddingProvider: result.provider || claimedEmbedding.embedding_provider || 'disabled',
          embeddingModel: claimedEmbedding.embedding_model || null,
          embeddingDimensions: result.dimensions || 0
        });
        processed += 1;
        continue;
      }

      await markEmbeddingFailed({
        accountId,
        id: claimedEmbedding.id,
        errorMessage: result.error || 'embedding provider returned unsupported status',
        embeddingMetadata: metadata
      });
      failed += 1;
    } catch (error) {
      logger.error({ message: 'whatsapp_learning_embedding_worker_failed', error: error?.message || String(error), account_id: accountId, embedding_id: claimedEmbedding.id });
      await markEmbeddingFailed({
        accountId,
        id: claimedEmbedding.id,
        errorMessage: error?.message || String(error),
        embeddingMetadata: cleanMetadata(claimedEmbedding.embedding_metadata)
      });
      failed += 1;
    }
  }

  return buildWorkerSummary({ scanned: embeddings.length, claimed, processed, failed, skipped, provider: lastProvider });
}
