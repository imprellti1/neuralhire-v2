import assert from 'node:assert/strict';
import { createKnowledgeFromLearningEvent, __dumpMemoryWhatsappLearningKnowledgeForTests, __resetMemoryWhatsappLearningKnowledgeForTests } from './whatsapp-learning.repository.js';
import { __dumpMemoryCustomerKnowledgeForTests, __resetMemoryCustomerKnowledgeForTests } from './customer-knowledge.repository.js';
import { consolidateWhatsappLearningKnowledge } from './whatsapp-learning.consolidator.js';

async function seedLearningKnowledge({
  accountId = 'acc-1',
  sourceEventId,
  phone = '5511999999999',
  remoteJid = '5511999999999@s.whatsapp.net',
  normalizedText = 'quero pagar no boleto',
  createdAt = '2026-06-30T10:00:00.000Z',
  updatedAt = '2026-06-30T10:00:00.000Z',
  status = 'learned',
  metadata = {}
} = {}) {
  const result = await createKnowledgeFromLearningEvent({
    accountId,
    sourceEventId,
    sourceProvider: 'evolution',
    sourceInstance: 'main',
    sourceInstanceType: 'learning',
    direction: 'inbound',
    phone,
    remoteJid,
    normalizedText,
    knowledgeType: 'observation',
    confidence: 0.4,
    status,
    createdAt,
    updatedAt,
    metadata: {
      provider: 'evolution',
      instance_type: 'learning',
      instance_name: 'main',
      learning_source: 'whatsapp_persisted_message',
      ...metadata
    }
  }, { accountId });
  return result.item;
}

function reset() {
  __resetMemoryWhatsappLearningKnowledgeForTests();
  __resetMemoryCustomerKnowledgeForTests();
}

export function getWhatsappLearningConsolidatorTests() {
  return [
    {
      name: 'cria customer_knowledge a partir de whatsapp_learning_knowledge',
      run: async () => {
        reset();
        const seeded = await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: 'aceito pagamento no boleto com prazo de 30 dias' });
        const result = await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        assert.equal(result.processed, 1);
        const consolidated = __dumpMemoryCustomerKnowledgeForTests();
        assert.equal(consolidated.length, 1);
        assert.equal(consolidated[0].account_id, 'acc-1');
        assert.equal(consolidated[0].knowledge_key, 'condicao_comercial');
        assert.equal(consolidated[0].occurrences, 1);
        assert.equal(consolidated[0].version, 1);
        assert.equal(consolidated[0].change_count, 0);
        assert.equal(consolidated[0].last_source_event_id, 'source-1');
        assert.equal(consolidated[0].last_source_instance_type, 'learning');
        assert.equal(consolidated[0].first_seen_at, seeded.created_at);
        assert.equal(consolidated[0].last_seen_at, seeded.created_at);
      }
    },
    {
      name: 'consolida repetidos sem duplicar e incrementa occurrences',
      run: async () => {
        reset();
        const first = await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: 'aceito pagamento no boleto com prazo de 30 dias', createdAt: '2026-06-30T10:00:00.000Z' });
        const second = await seedLearningKnowledge({ sourceEventId: 'source-2', normalizedText: 'condicao de pagamento no boleto com prazo de 30 dias', createdAt: '2026-06-30T11:00:00.000Z' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        const consolidated = __dumpMemoryCustomerKnowledgeForTests();
        assert.equal(consolidated.length, 1);
        assert.equal(consolidated[0].occurrences, 2);
        assert.equal(consolidated[0].version, 2);
        assert.equal(consolidated[0].change_count, 1);
        assert.equal(consolidated[0].first_seen_at, first.created_at);
        assert.equal(consolidated[0].last_seen_at, second.created_at);
        assert.equal(consolidated[0].source_events.length, 2);
        assert.equal(consolidated[0].previous_value, 'aceito pagamento no boleto com prazo de 30 dias');
      }
    },
    {
      name: 'ignora conhecimento sem texto util e preserva tenant isolation',
      run: async () => {
        reset();
        await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: '', accountId: 'acc-1' });
        await seedLearningKnowledge({ sourceEventId: 'source-2', normalizedText: 'quero falar sobre pagamento', accountId: 'acc-2', phone: '5599999999999', remoteJid: '5599999999999@s.whatsapp.net' });
        const result = await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        assert.equal(result.processed, 0);
        assert.equal(__dumpMemoryCustomerKnowledgeForTests().length, 0);
      }
    },
    {
      name: 'marca conhecimento original como consolidado com metadata',
      run: async () => {
        reset();
        await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: 'condicao de pagamento no boleto com prazo de 30 dias', metadata: { instance_type: 'operational' } });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        const original = __dumpMemoryWhatsappLearningKnowledgeForTests()[0];
        assert.equal(original.status, 'consolidated');
        assert.equal(original.metadata.knowledge_key, 'condicao_comercial');
        assert.equal(original.metadata.source_instance_type, 'operational');
        assert.ok(original.metadata.consolidated_at);
      }
    },
    {
      name: 'replace em endereco_localizacao e atualiza versionamento',
      run: async () => {
        reset();
        await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: 'Rua A, 123 - Centro' });
        await seedLearningKnowledge({ sourceEventId: 'source-2', normalizedText: 'Rua B, 456 - Vila Nova' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        const consolidated = __dumpMemoryCustomerKnowledgeForTests()[0];
        assert.equal(consolidated.knowledge_key, 'endereco_localizacao');
        assert.equal(consolidated.version, 2);
        assert.equal(consolidated.change_count, 1);
        assert.equal(consolidated.previous_value, 'Rua A, 123 - Centro');
        assert.equal(consolidated.updated_reason, 'replace:endereco_localizacao');
        assert.equal(consolidated.last_source_event_id, 'source-2');
      }
    },
    {
      name: 'union em interesse_produto e objecao_comercial',
      run: async () => {
        reset();
        await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: 'quero tapete e cortina' });
        await seedLearningKnowledge({ sourceEventId: 'source-2', normalizedText: 'tenho interesse em tapete e manta' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        const consolidated = __dumpMemoryCustomerKnowledgeForTests()[0];
        assert.equal(consolidated.knowledge_key, 'interesse_produto');
        assert.equal(consolidated.version, 2);
        assert.equal(consolidated.updated_reason, 'union:interesse_produto');
        assert.equal(consolidated.occurrences, 2);
      }
    },
    {
      name: 'append em reclamacao e preserva previous_value',
      run: async () => {
        reset();
        await seedLearningKnowledge({ sourceEventId: 'source-1', normalizedText: 'reclamação: produto veio avariado' });
        await seedLearningKnowledge({ sourceEventId: 'source-2', normalizedText: 'reclamação: atendimento muito ruim' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        await consolidateWhatsappLearningKnowledge({ accountId: 'acc-1' });
        const consolidated = __dumpMemoryCustomerKnowledgeForTests()[0];
        assert.equal(consolidated.knowledge_key, 'reclamacao');
        assert.equal(consolidated.version, 2);
        assert.equal(consolidated.updated_reason, 'append:reclamacao');
        assert.equal(consolidated.previous_value, 'reclamação: produto veio avariado');
      }
    }
  ];
}
