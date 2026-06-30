import assert from 'node:assert/strict';
import { embedKnowledge, healthCheckEmbeddingProvider, resolveEmbeddingProviderName, searchKnowledge } from './embedding-provider.js';

function restoreEnv(key, value) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

export function getEmbeddingProviderTests() {
  return [
    {
      name: 'provider padrao de embedding e disabled',
      run: async () => {
        const previousProvider = process.env.EMBEDDING_PROVIDER;
        delete process.env.EMBEDDING_PROVIDER;
        assert.equal(resolveEmbeddingProviderName(), 'disabled');
        restoreEnv('EMBEDDING_PROVIDER', previousProvider);
      }
    },
    {
      name: 'embedKnowledge com provider disabled retorna contrato seguro',
      run: async () => {
        const previousProvider = process.env.EMBEDDING_PROVIDER;
        const previousEnabled = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_PROVIDER = 'disabled';
        process.env.EMBEDDING_WORKER_ENABLED = 'false';
        const result = await embedKnowledge({ accountId: 'acc-1', customerKnowledgeId: 'ck-1', sourceEventId: 'evt-1' });
        assert.deepEqual(result, {
          status: 'disabled',
          provider: null,
          vector: null,
          dimensions: 0,
          error: null,
          metadata: {
            account_id: 'acc-1',
            customer_knowledge_id: 'ck-1',
            source_event_id: 'evt-1'
          }
        });
        restoreEnv('EMBEDDING_PROVIDER', previousProvider);
        restoreEnv('EMBEDDING_WORKER_ENABLED', previousEnabled);
      }
    },
    {
      name: 'searchKnowledge com provider disabled nao retorna resultados reais',
      run: async () => {
        const previousProvider = process.env.EMBEDDING_PROVIDER;
        const previousEnabled = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_PROVIDER = 'disabled';
        process.env.EMBEDDING_WORKER_ENABLED = 'false';
        const result = await searchKnowledge({ accountId: 'acc-1', customerKnowledgeId: 'ck-1', query: 'teste' });
        assert.deepEqual(result, {
          status: 'disabled',
          provider: null,
          results: [],
          metadata: {
            account_id: 'acc-1',
            customer_knowledge_id: 'ck-1',
            source_event_id: null
          }
        });
        restoreEnv('EMBEDDING_PROVIDER', previousProvider);
        restoreEnv('EMBEDDING_WORKER_ENABLED', previousEnabled);
      }
    },
    {
      name: 'healthCheck reporta provider disabled',
      run: async () => {
        const previousProvider = process.env.EMBEDDING_PROVIDER;
        const previousEnabled = process.env.EMBEDDING_WORKER_ENABLED;
        process.env.EMBEDDING_PROVIDER = 'disabled';
        process.env.EMBEDDING_WORKER_ENABLED = 'false';
        const result = await healthCheckEmbeddingProvider({ accountId: 'acc-1', customerKnowledgeId: 'ck-1' });
        assert.deepEqual(result, {
          ok: true,
          status: 'disabled',
          provider: null,
          enabled: false,
          vector_store: 'not_configured',
          metadata: {
            account_id: 'acc-1',
            customer_knowledge_id: 'ck-1',
            source_event_id: null
          }
        });
        restoreEnv('EMBEDDING_PROVIDER', previousProvider);
        restoreEnv('EMBEDDING_WORKER_ENABLED', previousEnabled);
      }
    }
  ];
}
