import assert from 'node:assert/strict';
import { runWhatsappLearningEmbeddingWorker } from './whatsapp-learning.embedding-worker.js';
import { createPendingEmbedding, __dumpMemoryCustomerKnowledgeEmbeddingsForTests, __resetMemoryCustomerKnowledgeEmbeddingsForTests, upsertEmbedding } from './customer-knowledge-embedding.repository.js';

function reset() {
  __resetMemoryCustomerKnowledgeEmbeddingsForTests();
}

async function seedPendingEmbedding({ accountId = 'acc-1', customerKnowledgeId = 'ck-1', embeddingHash = 'hash-1', embeddingMetadata = { source_event_id: 'evt-1', note: 'keep-me' } } = {}) {
  return createPendingEmbedding({
    accountId,
    customerKnowledgeId,
    embeddingProvider: 'disabled',
    embeddingVersion: 1,
    embeddingHash,
    embeddingMetadata
  }, { accountId });
}

export function getWhatsappLearningEmbeddingWorkerTests() {
  return [
    {
      name: 'pending vira processing e processed com provider disabled',
      run: async () => {
        reset();
        const previous = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_WORKER_ENABLED = 'true';
        const created = await seedPendingEmbedding();
        try {
          const result = await runWhatsappLearningEmbeddingWorker({ accountId: 'acc-1', limit: 10 });
          assert.equal(result.ok, true);
          assert.equal(result.scanned, 1);
          assert.equal(result.claimed, 1);
          assert.equal(result.processed, 1);
          assert.equal(result.failed, 0);
          const rows = __dumpMemoryCustomerKnowledgeEmbeddingsForTests();
          assert.equal(rows.length, 1);
          assert.equal(rows[0].embedding_status, 'processed');
          assert.equal(rows[0].embedding_provider, 'disabled');
          assert.equal(rows[0].processed_at, rows[0].last_attempt_at);
          assert.equal(rows[0].embedding_metadata.note, 'keep-me');
          assert.equal(rows[0].embedding_metadata.embedding_worker.status, 'disabled');
          assert.equal(rows[0].embedding_metadata.embedding_worker.provider, null);
          assert.equal(rows[0].embedding_metadata.source_event_id, 'evt-1');
          assert.equal(rows[0].account_id, created.item.account_id);
        } finally {
          if (previous === undefined) delete process.env.EMBEDDING_WORKER_ENABLED;
          else process.env.EMBEDDING_WORKER_ENABLED = previous;
        }
      }
    },
    {
      name: 'pending vira failed quando provider lança excecao',
      run: async () => {
        reset();
        const previous = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_WORKER_ENABLED = 'true';
        await seedPendingEmbedding({ embeddingMetadata: { source_event_id: 'evt-2', note: 'failure' } });
        try {
          const result = await runWhatsappLearningEmbeddingWorker({
            accountId: 'acc-1',
            limit: 10,
            embedKnowledge: async () => { throw new Error('boom'); }
          });
          assert.equal(result.failed, 1);
          const rows = __dumpMemoryCustomerKnowledgeEmbeddingsForTests();
          assert.equal(rows[0].embedding_status, 'failed');
          assert.equal(rows[0].error_message, 'boom');
          assert.equal(rows[0].processed_at, null);
          assert.equal(rows[0].embedding_metadata.note, 'failure');
        } finally {
          if (previous === undefined) delete process.env.EMBEDDING_WORKER_ENABLED;
          else process.env.EMBEDDING_WORKER_ENABLED = previous;
        }
      }
    },
    {
      name: 'nao reprocessa processed, processing e respeita tenant',
      run: async () => {
        reset();
        const previous = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_WORKER_ENABLED = 'true';
        await upsertEmbedding({ accountId: 'acc-1', customerKnowledgeId: 'ck-processed', embeddingStatus: 'processed', embeddingProvider: 'disabled', embeddingVersion: 1, embeddingHash: 'hash-processed', embeddingMetadata: { tenant: 'acc-1' }, processedAt: '2026-06-30T10:00:00.000Z', lastAttemptAt: '2026-06-30T10:00:00.000Z' }, { accountId: 'acc-1' });
        await upsertEmbedding({ accountId: 'acc-1', customerKnowledgeId: 'ck-processing', embeddingStatus: 'processing', embeddingProvider: 'disabled', embeddingVersion: 1, embeddingHash: 'hash-processing', embeddingMetadata: { tenant: 'acc-1' }, lastAttemptAt: '2026-06-30T10:00:00.000Z' }, { accountId: 'acc-1' });
        await seedPendingEmbedding({ accountId: 'acc-2', customerKnowledgeId: 'ck-tenant-2', embeddingMetadata: { source_event_id: 'evt-tenant-2' } });
        try {
          const result = await runWhatsappLearningEmbeddingWorker({ accountId: 'acc-1', limit: 10 });
          assert.equal(result.scanned, 0);
          assert.equal(result.processed, 0);
          assert.equal(result.failed, 0);
          assert.equal(__dumpMemoryCustomerKnowledgeEmbeddingsForTests().length, 3);
          const otherTenant = __dumpMemoryCustomerKnowledgeEmbeddingsForTests().find((row) => row.account_id === 'acc-2');
          assert.equal(otherTenant.embedding_status, 'pending');
        } finally {
          if (previous === undefined) delete process.env.EMBEDDING_WORKER_ENABLED;
          else process.env.EMBEDDING_WORKER_ENABLED = previous;
        }
      }
    },
    {
      name: 'resumo do worker preserva metadados e timestamps de processamento',
      run: async () => {
        reset();
        const previous = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_WORKER_ENABLED = 'true';
        await seedPendingEmbedding({ embeddingMetadata: { source_event_id: 'evt-3', stage: 'pending' } });
        try {
          const result = await runWhatsappLearningEmbeddingWorker({ accountId: 'acc-1', limit: 10 });
          assert.equal(result.ok, true);
          assert.equal(result.provider, 'disabled');
          const row = __dumpMemoryCustomerKnowledgeEmbeddingsForTests()[0];
          assert.equal(row.embedding_metadata.stage, 'pending');
          assert.equal(row.embedding_metadata.embedding_worker.status, 'disabled');
          assert.ok(row.processed_at);
          assert.ok(row.last_attempt_at);
          assert.equal(row.processed_at, row.last_attempt_at);
        } finally {
          if (previous === undefined) delete process.env.EMBEDDING_WORKER_ENABLED;
          else process.env.EMBEDDING_WORKER_ENABLED = previous;
        }
      }
    }
  ];
}
