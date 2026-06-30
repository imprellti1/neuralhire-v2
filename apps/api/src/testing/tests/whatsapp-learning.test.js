import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import JSZip from 'jszip';
import XLSX from 'xlsx';
import { __loadMemoryEvolutionForTests, __resetMemoryEvolutionForTests } from '../../modules/integrations/evolution/evolution.repository.js';
import { __dumpMemoryWhatsappLearningForTests, __dumpMemoryWhatsappLearningKnowledgeForTests, __resetMemoryWhatsappLearningForTests, __resetMemoryWhatsappLearningKnowledgeForTests, __setMemoryWhatsappLearningKnowledgeFailureForTests, createKnowledgeFromLearningEvent, createLearningEvent, updateLearningEvent } from '../../modules/whatsapp-learning/whatsapp-learning.repository.js';
import { runWhatsappLearningWorker } from '../../modules/whatsapp-learning/whatsapp-learning.service.js';
import { executeWhatsappLearningWorker } from '../../modules/whatsapp-learning/whatsapp-learning.executor.js';
import { runWhatsappLearningCognitiveWorker } from '../../modules/jobs/jobs.scheduler.js';
import { analyzeLearningEvent } from '../../modules/whatsapp-learning/cognitive-provider.js';
import { buildMediaAttachment, generateMediaSha256 } from '../../modules/media-manager/media-manager.js';
import { extractTextFromImage } from '../../modules/media-manager/ocr-provider.js';
import { transcribeAudio } from '../../modules/media-manager/transcription-provider.js';

function parse(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }

async function call(app, body, headers = {}) {
  const webhookHeaders = process.env.NEURALHIRE_WEBHOOK_TOKEN
    ? { 'x-neuralhire-webhook-token': process.env.NEURALHIRE_WEBHOOK_TOKEN }
    : {};
  const req = createTestRequest({ method: 'POST', url: '/integrations/evolution/webhook', headers: { 'content-type': 'application/json', ...webhookHeaders, ...headers }, body: JSON.stringify(body) });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parse(res) };
}

function reset() {
  __resetMemoryEvolutionForTests();
  __resetMemoryWhatsappLearningForTests();
  __resetMemoryWhatsappLearningKnowledgeForTests();
}

async function createTempFile(name, content) {
  const dir = path.join(os.tmpdir(), 'neuralhire-whatsapp-learning');
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await writeFile(filePath, content);
  return filePath;
}

async function createMinimalPdfBuffer(text) {
  const safeText = String(text || '').replace(/[\\()]/g, '\\$&');
  const content = `BT\n/F1 18 Tf\n72 720 Td\n(${safeText}) Tj\nET\n`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
    `5 0 obj << /Length ${Buffer.byteLength(content, 'utf8')} >> stream\n${content}endstream endobj\n`
  ];
  let offset = Buffer.byteLength('%PDF-1.4\n', 'utf8');
  const xrefEntries = ['0000000000 65535 f \n'];
  let body = '';
  for (const obj of objects) {
    xrefEntries.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
    body += obj;
    offset += Buffer.byteLength(obj, 'utf8');
  }
  const xrefStart = Buffer.byteLength('%PDF-1.4\n' + body, 'utf8');
  const trailer = `xref\n0 ${xrefEntries.length}\n${xrefEntries.join('')}trailer << /Size ${xrefEntries.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(`%PDF-1.4\n${body}${trailer}`, 'utf8');
}

async function createMinimalDocxBuffer(text) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder('_rels').file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>
  </w:body>
</w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function createMinimalCsvFile(name, csv) {
  return createTempFile(name, Buffer.from(csv, 'utf8'));
}

async function createMinimalXlsxBuffer(sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function createEmptyXlsxBuffer() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), 'Vazia');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function seedLearningEvent(messageId, metadata = {}, body = '', extra = {}) {
  await createLearningEvent({
    accountId: 'acc-1',
    whatsappMessageId: messageId,
    messageId: `m-${messageId}`,
    body,
    contentType: metadata.message_type || 'text',
    metadata: {
      provider: 'evolution',
      instance_name: 'main',
      instance_type: 'operational',
      direction: 'inbound',
      learning_source: 'whatsapp_persisted_message',
      ...metadata
    },
    ...extra
  }, { accountId: 'acc-1' });
}

process.env.NEURALHIRE_WEBHOOK_TOKEN = process.env.NEURALHIRE_WEBHOOK_TOKEN || 'secret-token';

export function getWhatsappLearningTests() {
  return [
    {
      name: 'provider OCR desligado retorna contrato disabled sem texto',
      run: async () => {
        const previousEnabled = process.env.OCR_ENABLED;
        const previousProvider = process.env.OCR_PROVIDER;
        process.env.OCR_ENABLED = 'false';
        process.env.OCR_PROVIDER = 'disabled';
        const result = await extractTextFromImage({ enabled: false, provider: 'disabled' });
        assert.deepEqual(result, {
          status: 'disabled',
          text: '',
          provider: null,
          error: null,
          processedAt: null,
          metadata: {}
        });
        process.env.OCR_ENABLED = previousEnabled;
        process.env.OCR_PROVIDER = previousProvider;
      }
    },
    {
      name: 'provider de transcricao desligado retorna contrato disabled sem texto',
      run: async () => {
        const previousEnabled = process.env.TRANSCRIPTION_ENABLED;
        const previousProvider = process.env.TRANSCRIPTION_PROVIDER;
        process.env.TRANSCRIPTION_ENABLED = 'false';
        process.env.TRANSCRIPTION_PROVIDER = 'disabled';
        const result = await transcribeAudio({ enabled: false, provider: 'disabled' });
        assert.deepEqual(result, {
          status: 'disabled',
          text: '',
          provider: null,
          error: null,
          processedAt: null,
          metadata: {}
        });
        process.env.TRANSCRIPTION_ENABLED = previousEnabled;
        process.env.TRANSCRIPTION_PROVIDER = previousProvider;
      }
    },
    {
      name: 'webhook cria evento pendente de aprendizagem',
      run: async () => {
        reset();
        __loadMemoryEvolutionForTests({ instances: [{ id: 'inst-1', account_id: 'acc-1', provider: 'evolution', instance_name: 'main', instance_type: 'operational', name: 'main', metadata: {} }] });
        const app = createApiApp();
        const out = await call(app, { provider: 'evolution', instance: 'main', event: 'messages.upsert', messageId: 'msg-1', remoteJid: '5511999999999@s.whatsapp.net', phone: '5511999999999', text: 'oi' }, { 'x-account-id': 'acc-1' });
        assert.equal(out.res.statusCode, 200);
        const events = __dumpMemoryWhatsappLearningForTests();
        assert.equal(events.length, 1);
        assert.equal(events[0].status, 'pending');
        assert.equal(events[0].intent, 'unknown');
        assert.equal(events[0].sentiment, 'neutral');
        assert.equal(events[0].importance, 1);
        assert.equal(events[0].summary, null);
        assert.deepEqual(events[0].entities, {});
        assert.deepEqual(events[0].topics, []);
        assert.equal(events[0].needs_followup, false);
        assert.equal(events[0].next_action, null);
        assert.equal(events[0].whatsapp_message_id, 'msg-1');
      }
    },
    {
      name: 'imagem recebe contrato OCR completo e worker permanece normalized com OCR desabilitado',
      run: async () => {
        reset();
        const previousEnabled = process.env.OCR_ENABLED;
        const previousProvider = process.env.OCR_PROVIDER;
        process.env.OCR_ENABLED = 'false';
        process.env.OCR_PROVIDER = 'disabled';
        await seedLearningEvent('msg-image', {
          message_type: 'image',
          mime_type: 'image/jpeg',
          file_name: 'foto.jpg',
          caption: 'Legenda da foto',
          url: 'https://example.com/foto.jpg',
          storage_key: 'bucket/path/foto.jpg'
        }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.failed, 0);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'processed');
        assert.equal(updated.normalized_payload.content_type, 'image');
        assert.equal(updated.normalized_payload.text, 'Legenda da foto');
        assert.equal(updated.normalized_text, 'Legenda da foto');
        assert.equal(updated.normalized_payload.attachments.length, 1);
        assert.equal(updated.normalized_payload.attachments[0].ocr_status, 'disabled');
        assert.equal(updated.normalized_payload.attachments[0].ocr_text, '');
        assert.equal(updated.normalized_payload.attachments[0].ocr_provider, null);
        assert.equal(updated.normalized_payload.attachments[0].ocr_error, null);
        assert.equal(updated.normalized_payload.attachments[0].ocr_processed_at, null);
        assert.equal(updated.normalized_payload.attachments[0].media_status, 'pending');
        process.env.OCR_ENABLED = previousEnabled;
        process.env.OCR_PROVIDER = previousProvider;
      }
    },
    {
      name: 'evento nao duplica para a mesma mensagem',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'oi' }, { accountId: 'acc-1' });
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'oi' }, { accountId: 'acc-1' });
        assert.equal(__dumpMemoryWhatsappLearningForTests().length, 1);
      }
    },
    {
      name: 'worker normaliza evento pendente e depois processa a cognição em defaults',
      run: async () => {
        reset();
        await seedLearningEvent('msg-1', { message_type: 'text' }, 'preciso de orçamento de tapete 40x60 cinza');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 1);
        assert.equal(result.cognitivelyProcessed, 1);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'processed');
        assert.equal(updated.intent, 'unknown');
        assert.equal(updated.sentiment, 'neutral');
        assert.equal(updated.summary, null);
        assert.equal(updated.normalized_text, 'preciso de orçamento de tapete 40x60 cinza');
        assert.ok(updated.normalized_at);
        assert.equal(updated.processing_error, null);
        assert.equal(updated.processed_at !== null, true);
        assert.deepEqual(updated.metadata.cognitive, {
          status: 'disabled',
          provider: null,
          model: null,
          processed_at: updated.metadata.cognitive.processed_at,
          error: null
        });
        assert.deepEqual(updated.normalized_payload, {
          version: 1,
          channel: 'whatsapp',
          content_type: 'text',
          language: 'pt-BR',
          text: 'preciso de orçamento de tapete 40x60 cinza',
          attachments: [],
          extraction: {
            status: 'not_applicable',
            method: null,
            text_length: 0,
            extracted_at: null,
            error: null,
            truncated: false,
            max_chars: null
          },
          cognitive: {
            status: 'disabled',
            provider: null,
            model: null,
            processed_at: updated.normalized_payload.cognitive.processed_at,
            error: null
          },
          metadata: {
            provider: 'evolution',
            instance_name: 'main',
            instance_type: 'operational',
            direction: 'inbound',
            learning_source: 'whatsapp_persisted_message',
            message_type: 'text'
          }
        });
      }
    },
    {
      name: 'provider cognitivo desligado retorna defaults sem dependencia externa',
      run: async () => {
        const result = await analyzeLearningEvent({
          event_id: 'event-1',
          account_id: 'acc-1',
          normalized_text: 'oi',
          normalized_payload: { text: 'oi' },
          metadata: { source: 'test' }
        });
        assert.deepEqual(result, {
          status: 'disabled',
          intent: 'unknown',
          sentiment: 'neutral',
          importance: 1,
          summary: null,
          entities: {},
          topics: [],
          needs_followup: false,
          next_action: null,
          provider: null,
          model: null,
          error: null,
          metadata: {
            event_id: 'event-1',
            account_id: 'acc-1',
            normalized_text: 'oi',
            normalized_payload: { text: 'oi' },
            has_normalized_text: true,
            has_normalized_payload: true
          }
        });
      }
    },
    {
      name: 'evento processed nao volta para a fila cognitiva',
      run: async () => {
        reset();
        await seedLearningEvent('msg-1', { message_type: 'text' }, 'oi');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const before = __dumpMemoryWhatsappLearningForTests()[0];
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.scanned, 0);
        assert.equal(__dumpMemoryWhatsappLearningForTests()[0].status, 'processed');
        assert.equal(before.status, 'processed');
      }
    },
    {
      name: 'executor cogitivo processa normalized e preserva metadata',
      run: async () => {
        reset();
        const created = await createLearningEvent({
          accountId: 'acc-1',
          whatsappMessageId: 'msg-1',
          messageId: 'm1',
          body: 'oi',
          metadata: { provider: 'evolution', instance_name: 'main', custom: 'keep-me' }
        }, { accountId: 'acc-1' });
        await updateLearningEvent(created.item.id, { status: 'normalized', normalized_text: 'oi', normalized_payload: { text: 'oi', metadata: { source: 'legacy' } } }, { accountId: 'acc-1' });
        const result = await executeWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 1);
        assert.equal(result.cognitivelyProcessed, 1);
        assert.equal(result.provider, 'disabled');
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'processed');
        assert.equal(updated.metadata.custom, 'keep-me');
        assert.equal(updated.metadata.cognitive.status, 'disabled');
        assert.equal(updated.normalized_payload.cognitive.status, 'disabled');
        assert.equal(updated.normalized_payload.cognitive.provider, null);
      }
    },
    {
      name: 'persistencia de conhecimento cria registro e deduplica por evento',
      run: async () => {
        reset();
        const created = await createLearningEvent({
          accountId: 'acc-1',
          whatsappMessageId: 'msg-knowledge',
          messageId: 'm-knowledge',
          body: 'quero falar sobre pagamento'
        }, { accountId: 'acc-1' });
        await updateLearningEvent(created.item.id, { status: 'normalized', normalized_text: 'quero falar sobre pagamento', normalized_payload: { text: 'quero falar sobre pagamento', metadata: { provider: 'evolution', instance_name: 'main', instance_type: 'learning', direction: 'inbound' } } }, { accountId: 'acc-1' });
        const first = await createKnowledgeFromLearningEvent({
          sourceEventId: created.item.id,
          sourceProvider: 'evolution',
          sourceInstance: 'main',
          sourceInstanceType: 'learning',
          direction: 'inbound',
          phone: '5511999999999',
          remoteJid: '5511999999999@s.whatsapp.net',
          normalizedText: 'quero falar sobre pagamento',
          knowledgeType: 'observation',
          confidence: 0,
          intent: 'payment',
          sentiment: 'neutral',
          entities: { payment: true },
          topics: ['payment'],
          summary: 'Cliente quer falar sobre pagamento',
          rawCognitivePayload: { status: 'disabled' },
          metadata: { provider: 'evolution' }
        }, { accountId: 'acc-1' });
        const second = await createKnowledgeFromLearningEvent({
          sourceEventId: created.item.id,
          sourceProvider: 'evolution',
          sourceInstance: 'main',
          sourceInstanceType: 'learning',
          direction: 'inbound',
          phone: '5511999999999',
          remoteJid: '5511999999999@s.whatsapp.net',
          normalizedText: 'quero falar sobre pagamento',
          knowledgeType: 'observation',
          confidence: 0,
          intent: 'payment',
          sentiment: 'neutral',
          entities: { payment: true },
          topics: ['payment'],
          summary: 'Cliente quer falar sobre pagamento',
          rawCognitivePayload: { status: 'disabled' },
          metadata: { provider: 'evolution' }
        }, { accountId: 'acc-1' });
        assert.equal(first.status, 'created');
        assert.equal(second.status, 'updated');
        const knowledge = __dumpMemoryWhatsappLearningKnowledgeForTests();
        assert.equal(knowledge.length, 1);
        assert.equal(knowledge[0].account_id, 'acc-1');
        assert.equal(knowledge[0].source_instance_type, 'learning');
        assert.equal(knowledge[0].confidence, 0);
        assert.equal(knowledge[0].status, 'learned');
      }
    },
    {
      name: 'executor cognitivo persiste defaults seguros com provider disabled',
      run: async () => {
        reset();
        const created = await createLearningEvent({
          accountId: 'acc-1',
          whatsappMessageId: 'msg-disabled',
          messageId: 'm-disabled',
          body: 'oi',
          metadata: { provider: 'evolution', instance_name: 'main', instance_type: 'learning', direction: 'inbound', phone: '5511999999999', remote_jid: '5511999999999@s.whatsapp.net' }
        }, { accountId: 'acc-1' });
        await updateLearningEvent(created.item.id, { status: 'normalized', normalized_text: 'oi', normalized_payload: { text: 'oi', metadata: { provider: 'evolution', instance_name: 'main', instance_type: 'learning', direction: 'inbound' } } }, { accountId: 'acc-1' });
        const result = await executeWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 1);
        const knowledge = __dumpMemoryWhatsappLearningKnowledgeForTests();
        assert.equal(knowledge.length, 1);
        assert.equal(knowledge[0].knowledge_type, 'observation');
        assert.equal(knowledge[0].confidence, 0);
        assert.equal(knowledge[0].source_instance_type, 'learning');
        assert.equal(knowledge[0].status, 'learned');
        assert.equal(knowledge[0].raw_cognitive_payload.status, 'disabled');
        assert.equal(knowledge[0].metadata.cognitive_provider, 'disabled');
      }
    },
    {
      name: 'job cognitivo respeita flag desligada e nao executa fan-out',
      run: async () => {
        reset();
        const previousEnabled = process.env.COGNITIVE_WORKER_ENABLED;
        const previousProvider = process.env.COGNITIVE_PROVIDER;
        process.env.COGNITIVE_WORKER_ENABLED = 'false';
        process.env.COGNITIVE_PROVIDER = 'disabled';
        try {
          const created = await createLearningEvent({
            accountId: 'acc-1',
            whatsappMessageId: 'msg-cognitive',
            messageId: 'm-cognitive',
            body: 'oi'
          }, { accountId: 'acc-1' });
          await updateLearningEvent(created.item.id, { status: 'normalized', normalized_text: 'oi', normalized_payload: { text: 'oi' } }, { accountId: 'acc-1' });
          const result = await runWhatsappLearningCognitiveWorker({ accountId: 'acc-1', limit: 10 });
          assert.equal(result.processed, 1);
          assert.equal(result.ignored, 0);
          assert.equal(result.provider, 'disabled');
          const updated = __dumpMemoryWhatsappLearningForTests()[0];
          assert.equal(updated.status, 'processed');
        } finally {
          process.env.COGNITIVE_WORKER_ENABLED = previousEnabled;
          process.env.COGNITIVE_PROVIDER = previousProvider;
        }
      }
    },
    {
      name: 'job cognitivo roda executor quando habilitado e mantém isolamento por tenant',
      run: async () => {
        reset();
        const previousEnabled = process.env.COGNITIVE_WORKER_ENABLED;
        const previousProvider = process.env.COGNITIVE_PROVIDER;
        process.env.COGNITIVE_WORKER_ENABLED = 'true';
        process.env.COGNITIVE_PROVIDER = 'disabled';
        try {
          await createLearningEvent({ accountId: 'acc-a', whatsappMessageId: 'msg-a', messageId: 'm-a', body: 'a' }, { accountId: 'acc-a' });
          await createLearningEvent({ accountId: 'acc-b', whatsappMessageId: 'msg-b', messageId: 'm-b', body: 'b' }, { accountId: 'acc-b' });
          await updateLearningEvent(__dumpMemoryWhatsappLearningForTests()[0].id, { status: 'normalized', normalized_text: 'a', normalized_payload: { text: 'a' } }, { accountId: 'acc-a' });
          await updateLearningEvent(__dumpMemoryWhatsappLearningForTests()[1].id, { status: 'normalized', normalized_text: 'b', normalized_payload: { text: 'b' } }, { accountId: 'acc-b' });
          const result = await runWhatsappLearningCognitiveWorker({ accountId: 'acc-a', limit: 10 });
          assert.equal(result.ok, true);
          assert.equal(result.processed, 1);
          assert.equal(result.ignored, 0);
          const items = __dumpMemoryWhatsappLearningForTests();
          assert.equal(items.find((item) => item.account_id === 'acc-a').status, 'processed');
          assert.equal(items.find((item) => item.account_id === 'acc-b').status, 'normalized');
        } finally {
          process.env.COGNITIVE_WORKER_ENABLED = previousEnabled;
          process.env.COGNITIVE_PROVIDER = previousProvider;
        }
      }
    },
    {
      name: 'executor pula item ja processado e respeita processing',
      run: async () => {
        reset();
        const processed = await createLearningEvent({
          accountId: 'acc-1',
          whatsappMessageId: 'msg-processed',
          messageId: 'm1',
          body: 'oi',
          metadata: { custom: 'keep' }
        }, { accountId: 'acc-1' });
        const locked = await createLearningEvent({
          accountId: 'acc-1',
          whatsappMessageId: 'msg-locked',
          messageId: 'm2',
          body: 'oi'
        }, { accountId: 'acc-1' });
        await updateLearningEvent(processed.item.id, { status: 'processed', processed_at: '2026-06-30T00:00:00.000Z' }, { accountId: 'acc-1' });
        await updateLearningEvent(locked.item.id, { status: 'processing', processing_error: null }, { accountId: 'acc-1' });
        const result = await executeWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.scanned, 0);
        assert.equal(result.processed, 0);
        assert.equal(__dumpMemoryWhatsappLearningForTests().find((item) => item.whatsapp_message_id === 'msg-processed').status, 'processed');
        assert.equal(__dumpMemoryWhatsappLearningForTests().find((item) => item.whatsapp_message_id === 'msg-locked').status, 'processing');
      }
    },
    {
      name: 'erro tecnico do provider marca failed sem quebrar o lote',
      run: async () => {
        reset();
        const previousEnabled = process.env.COGNITIVE_WORKER_ENABLED;
        const previousProvider = process.env.COGNITIVE_PROVIDER;
        process.env.COGNITIVE_WORKER_ENABLED = 'true';
        process.env.COGNITIVE_PROVIDER = 'throw';
        try {
          await seedLearningEvent('msg-1', { message_type: 'text' }, 'oi');
          await seedLearningEvent('msg-2', { message_type: 'text' }, 'tudo bem');
          const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
          assert.equal(result.failed, 2);
          const events = __dumpMemoryWhatsappLearningForTests();
          assert.equal(events.every((item) => item.status === 'failed'), true);
          assert.equal(String(events[0].processing_error || '').includes('forced_cognitive_provider_failure'), true);
          assert.equal(String(events[0].processing_error || '').includes('Error:'), false);
        } finally {
          process.env.COGNITIVE_WORKER_ENABLED = previousEnabled;
          process.env.COGNITIVE_PROVIDER = previousProvider;
        }
      }
    },
    {
      name: 'executor marca failed em erro controlado sem reprocessar item reservado',
      run: async () => {
        reset();
        const previousEnabled = process.env.COGNITIVE_WORKER_ENABLED;
        const previousProvider = process.env.COGNITIVE_PROVIDER;
        process.env.COGNITIVE_WORKER_ENABLED = 'true';
        process.env.COGNITIVE_PROVIDER = 'throw';
        try {
          const created = await createLearningEvent({
            accountId: 'acc-1',
            whatsappMessageId: 'msg-1',
            messageId: 'm1',
            body: 'oi'
          }, { accountId: 'acc-1' });
          await updateLearningEvent(created.item.id, { status: 'normalized', normalized_text: 'oi', normalized_payload: { text: 'oi' } }, { accountId: 'acc-1' });
          const result = await executeWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
          assert.equal(result.failed, 1);
          const updated = __dumpMemoryWhatsappLearningForTests()[0];
          assert.equal(updated.status, 'failed');
          assert.ok(String(updated.processing_error || '').includes('forced_cognitive_provider_failure'));
        } finally {
          process.env.COGNITIVE_WORKER_ENABLED = previousEnabled;
          process.env.COGNITIVE_PROVIDER = previousProvider;
        }
      }
    },
    {
      name: 'persistencia de conhecimento falha controla o evento como failed',
      run: async () => {
        reset();
        const created = await createLearningEvent({
          accountId: 'acc-1',
          whatsappMessageId: 'msg-knowledge-fail',
          messageId: 'm-knowledge-fail',
          body: 'oi'
        }, { accountId: 'acc-1' });
        await updateLearningEvent(created.item.id, { status: 'normalized', normalized_text: 'oi', normalized_payload: { text: 'oi', metadata: { provider: 'evolution', instance_name: 'main', instance_type: 'learning' } } }, { accountId: 'acc-1' });
        __setMemoryWhatsappLearningKnowledgeFailureForTests(new Error('forced_knowledge_persistence_failure'));
        const result = await executeWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.failed, 1);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'failed');
        assert.ok(String(updated.processing_error || '').includes('forced_knowledge_persistence_failure'));
        assert.equal(__dumpMemoryWhatsappLearningKnowledgeForTests().length, 0);
      }
    },
    {
      name: 'worker normaliza tipos multimodais por tipo',
      run: async () => {
        reset();
        await seedLearningEvent('msg-text', { message_type: 'text' }, 'texto original');
        await seedLearningEvent('msg-image', { message_type: 'image', caption: 'legenda da imagem', mime_type: 'image/jpeg' }, '');
        await seedLearningEvent('msg-audio', { message_type: 'audio', mime_type: 'audio/ogg', duration_seconds: 12 }, '');
        await seedLearningEvent('msg-video', { message_type: 'video', caption: 'legenda do video', mime_type: 'video/mp4', duration_seconds: 31 }, '');
        await seedLearningEvent('msg-pdf', { message_type: 'document', mime_type: 'application/pdf', file_name: 'arquivo.pdf' }, '');
        await seedLearningEvent('msg-spreadsheet', { message_type: 'document', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_name: 'planilha.xlsx' }, '');
        await seedLearningEvent('msg-csv', { message_type: 'document', mime_type: 'text/csv', file_name: 'dados.csv' }, '');
        await seedLearningEvent('msg-document', { message_type: 'document', mime_type: 'application/msword', file_name: 'documento.docx' }, '');
        await seedLearningEvent('msg-location', { message_type: 'location', location: { latitude: -23.55, longitude: -46.63, name: 'Centro', address: 'SP' } }, '');
        await seedLearningEvent('msg-contact', { message_type: 'contact', contact: { name: 'João', phone: '5511999999999', email: 'joao@exemplo.com' } }, '');
        await seedLearningEvent('msg-reaction', { message_type: 'reaction', reaction: { emoji: '👍', target_message_id: 'target-1' } }, '');
        await seedLearningEvent('msg-sticker', { message_type: 'sticker', mime_type: 'image/webp' }, '');
        await seedLearningEvent('msg-unknown', { message_type: 'system' }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 20 });
        assert.equal(result.processed, 13);
        const events = __dumpMemoryWhatsappLearningForTests();
        const byId = new Map(events.map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-text').normalized_payload.content_type, 'text');
        assert.equal(byId.get('msg-text').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-text').normalized_text, 'texto original');
        assert.equal(byId.get('msg-text').normalized_payload.attachments.length, 0);
        assert.equal(byId.get('msg-image').normalized_payload.content_type, 'image');
        assert.equal(byId.get('msg-image').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-image').normalized_payload.text, 'legenda da imagem');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].type, 'image');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].media_status, 'pending');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].ocr_status, 'disabled');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].ocr_text, '');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].ocr_provider, null);
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].ocr_error, null);
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].ocr_processed_at, null);
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].transcription_status, null);
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].thumbnail_status, null);
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].mime_type, 'image/jpeg');
        assert.ok(byId.get('msg-image').normalized_payload.attachments[0].sha256);
        assert.equal(byId.get('msg-audio').normalized_payload.content_type, 'audio');
        assert.equal(byId.get('msg-audio').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-audio').normalized_payload.text, '');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].duration_seconds, 12);
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].media_status, 'pending');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].ocr_status, null);
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_status, 'disabled');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_text, '');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_provider, null);
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_error, null);
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_processed_at, null);
        assert.equal(byId.get('msg-video').normalized_payload.content_type, 'video');
        assert.equal(byId.get('msg-video').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-video').normalized_payload.text, 'legenda do video');
        assert.equal(byId.get('msg-video').normalized_payload.attachments[0].media_status, 'pending');
        assert.equal(byId.get('msg-video').normalized_payload.attachments[0].thumbnail_status, 'pending');
        assert.equal(byId.get('msg-pdf').normalized_payload.content_type, 'pdf');
        assert.equal(byId.get('msg-pdf').normalized_payload.extraction.status, 'pending');
        assert.equal(byId.get('msg-spreadsheet').normalized_payload.content_type, 'spreadsheet');
        assert.equal(byId.get('msg-spreadsheet').normalized_payload.extraction.status, 'pending');
        assert.equal(byId.get('msg-csv').normalized_payload.content_type, 'csv');
        assert.equal(byId.get('msg-csv').normalized_payload.extraction.status, 'pending');
        assert.equal(byId.get('msg-document').normalized_payload.content_type, 'document');
        assert.equal(byId.get('msg-document').normalized_payload.extraction.status, 'pending');
        assert.equal(byId.get('msg-location').normalized_payload.content_type, 'location');
        assert.equal(byId.get('msg-location').normalized_payload.extraction.status, 'not_applicable');
        assert.deepEqual(byId.get('msg-location').normalized_payload.location.latitude, -23.55);
        assert.equal(byId.get('msg-contact').normalized_payload.content_type, 'contact');
        assert.equal(byId.get('msg-contact').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-contact').normalized_payload.contact.phone, '5511999999999');
        assert.equal(byId.get('msg-reaction').normalized_payload.content_type, 'reaction');
        assert.equal(byId.get('msg-reaction').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-reaction').normalized_payload.reaction.emoji, '👍');
        assert.equal(byId.get('msg-sticker').normalized_payload.content_type, 'sticker');
        assert.equal(byId.get('msg-sticker').normalized_payload.extraction.status, 'not_applicable');
        assert.equal(byId.get('msg-sticker').normalized_payload.attachments[0].type, 'sticker');
        assert.equal(byId.get('msg-sticker').normalized_payload.attachments[0].media_status, 'pending');
        assert.equal(byId.get('msg-unknown').normalized_payload.content_type, 'unknown');
        assert.equal(byId.get('msg-unknown').normalized_payload.extraction.status, 'not_applicable');
        assert.ok(events.every((item) => item.status === 'processed'));
        assert.ok(events.every((item) => item.normalized_at));
        assert.ok(events.every((item) => Array.isArray(item.normalized_payload.attachments)));
      }
    },
    {
      name: 'media manager gera hash e preserva metadados estruturais',
      run: async () => {
        const first = buildMediaAttachment('image', {
          mime_type: 'image/jpeg',
          file_name: 'foto.jpg',
          file_size: 123456,
          width: 1920,
          height: 1080,
          url: 'https://example.com/foto.jpg',
          storage_key: 'whatsapp/acc-1/foto.jpg',
          metadata: { source: 'evolution' }
        });
        const second = buildMediaAttachment('image', {
          mime_type: 'image/jpeg',
          file_name: 'foto.jpg',
          file_size: 123456,
          width: 1920,
          height: 1080,
          url: 'https://example.com/foto.jpg',
          storage_key: 'whatsapp/acc-1/foto.jpg',
          metadata: { source: 'evolution' }
        });
        assert.equal(first.type, 'image');
        assert.equal(first.mime_type, 'image/jpeg');
        assert.equal(first.file_name, 'foto.jpg');
        assert.equal(first.file_size, 123456);
        assert.equal(first.width, 1920);
        assert.equal(first.height, 1080);
        assert.equal(first.url, 'https://example.com/foto.jpg');
        assert.equal(first.storage_key, 'whatsapp/acc-1/foto.jpg');
        assert.equal(first.storage_provider, null);
        assert.equal(first.storage_bucket, null);
        assert.equal(first.media_status, 'pending');
        assert.equal(first.ocr_status, 'pending');
        assert.equal(first.ocr_text, '');
        assert.equal(first.ocr_provider, null);
        assert.equal(first.ocr_error, null);
        assert.equal(first.ocr_processed_at, null);
        assert.equal(first.transcription_status, null);
        assert.equal(first.transcription_text, null);
        assert.equal(first.transcription_provider, null);
        assert.equal(first.transcription_error, null);
        assert.equal(first.transcription_processed_at, null);
        assert.equal(first.thumbnail_status, null);
        assert.equal(first.metadata.source, 'evolution');
        assert.equal(first.sha256, second.sha256);
        assert.equal(first.sha256, generateMediaSha256({
          type: 'image',
          mime_type: 'image/jpeg',
          file_name: 'foto.jpg',
          file_size: 123456,
          width: 1920,
          height: 1080,
          url: 'https://example.com/foto.jpg',
          storage_key: 'whatsapp/acc-1/foto.jpg',
          metadata: { source: 'evolution' }
        }));
      }
    },
    {
      name: 'worker extrai texto de pdf e docx acessiveis',
      run: async () => {
        reset();
        const pdfPath = await createTempFile('sample.pdf', await createMinimalPdfBuffer('Texto do PDF'));
        const docxPath = await createTempFile('sample.docx', await createMinimalDocxBuffer('Texto do DOCX'));
        await seedLearningEvent('msg-pdf', { message_type: 'document', mime_type: 'application/pdf', file_name: 'sample.pdf', url: pathToFileURL(pdfPath).href }, '');
        await seedLearningEvent('msg-docx', { message_type: 'document', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_name: 'sample.docx', url: pathToFileURL(docxPath).href }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 2);
        const events = __dumpMemoryWhatsappLearningForTests();
        const byId = new Map(events.map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-pdf').normalized_payload.extraction.status, 'extracted');
        assert.equal(byId.get('msg-pdf').normalized_payload.extraction.method, 'pdf_text_extraction');
        assert.equal(byId.get('msg-pdf').normalized_text.includes('Texto do PDF'), true);
        assert.equal(byId.get('msg-pdf').normalized_payload.text.includes('Texto do PDF'), true);
        assert.equal(byId.get('msg-docx').normalized_payload.extraction.status, 'extracted');
        assert.equal(byId.get('msg-docx').normalized_payload.extraction.method, 'docx_text_extraction');
        assert.equal(byId.get('msg-docx').normalized_text.includes('Texto do DOCX'), true);
      }
    },
    {
      name: 'worker extrai texto tabular de csv',
      run: async () => {
        reset();
        const csvPath = await createMinimalCsvFile('sample.csv', 'Código,Produto,Quantidade\n1001,Toalha,12\n1002,Lençol,8');
        await seedLearningEvent('msg-csv', { message_type: 'csv', mime_type: 'text/csv', file_name: 'sample.csv', url: pathToFileURL(csvPath).href }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 1);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.normalized_payload.content_type, 'csv');
        assert.equal(updated.normalized_payload.extraction.status, 'extracted');
        assert.equal(updated.normalized_payload.extraction.method, 'spreadsheet_text_extraction');
        assert.equal(updated.normalized_payload.extraction.rows_count, 2);
        assert.equal(updated.normalized_payload.extraction.columns_count, 3);
        assert.equal(updated.normalized_payload.extraction.sheets_count, 1);
        assert.equal(updated.normalized_payload.text.includes('Linha 1:'), true);
        assert.equal(updated.normalized_payload.text.includes('Código=1001 | Produto=Toalha | Quantidade=12'), true);
        assert.equal(updated.normalized_text, updated.normalized_payload.text);
      }
    },
    {
      name: 'worker marca csv vazio como empty e preserva metadados',
      run: async () => {
        reset();
        const csvPath = await createMinimalCsvFile('empty.csv', '');
        await seedLearningEvent('msg-csv', { message_type: 'csv', mime_type: 'text/csv', file_name: 'empty.csv', url: pathToFileURL(csvPath).href, original_metadata: { source: 'legacy' } }, '');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.normalized_payload.extraction.status, 'empty');
        assert.equal(updated.normalized_payload.extraction.rows_count, 0);
        assert.equal(updated.normalized_payload.extraction.columns_count, 0);
        assert.equal(updated.metadata.original_metadata.source, 'legacy');
        assert.equal(updated.normalized_text, '');
      }
    },
    {
      name: 'worker marca csv invalido como failed',
      run: async () => {
        reset();
        const csvPath = await createMinimalCsvFile('broken.csv', 'Código,Produto\n1001,"Toalha');
        await seedLearningEvent('msg-csv', { message_type: 'csv', mime_type: 'text/csv', file_name: 'broken.csv', url: pathToFileURL(csvPath).href }, '');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.normalized_payload.extraction.status, 'failed');
        assert.ok(String(updated.normalized_payload.extraction.error || '').length > 0);
      }
    },
    {
      name: 'worker trunca csv muito grande sem quebrar o worker',
      run: async () => {
        reset();
        const rows = ['Código,Produto,Quantidade'];
        for (let i = 1; i <= 1100; i += 1) rows.push(`${1000 + i},Produto ${i},${i}`);
        const csvPath = await createMinimalCsvFile('large.csv', rows.join('\n'));
        await seedLearningEvent('msg-csv', { message_type: 'csv', mime_type: 'text/csv', file_name: 'large.csv', url: pathToFileURL(csvPath).href }, '');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.normalized_payload.extraction.status, 'extracted');
        assert.equal(updated.normalized_payload.extraction.truncated, true);
        assert.equal(updated.normalized_payload.extraction.rows_processed, 1000);
        assert.equal(updated.normalized_payload.extraction.rows_total, 1100);
      }
    },
    {
      name: 'worker extrai xlsx com uma aba e múltiplas abas',
      run: async () => {
        reset();
        const singleSheetPath = await createTempFile('single.xlsx', await createMinimalXlsxBuffer({
          Produtos: [
            ['Código', 'Produto', 'Quantidade'],
            [1001, 'Toalha', 12],
            [1002, 'Lençol', 8]
          ]
        }));
        const multiSheetPath = await createTempFile('multi.xlsx', await createMinimalXlsxBuffer({
          Produtos: [
            ['Código', 'Produto', 'Quantidade'],
            [1001, 'Toalha', 12]
          ],
          Estoque: [
            ['Local', 'Qtd'],
            ['CD1', 20]
          ]
        }));
        await seedLearningEvent('msg-single', { message_type: 'spreadsheet', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_name: 'single.xlsx', url: pathToFileURL(singleSheetPath).href }, '');
        await seedLearningEvent('msg-multi', { message_type: 'spreadsheet', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_name: 'multi.xlsx', url: pathToFileURL(multiSheetPath).href }, '');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const byId = new Map(__dumpMemoryWhatsappLearningForTests().map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-single').normalized_payload.extraction.status, 'extracted');
        assert.equal(byId.get('msg-single').normalized_payload.extraction.sheets_count, 1);
        assert.equal(byId.get('msg-single').normalized_payload.extraction.rows_count, 2);
        assert.equal(byId.get('msg-single').normalized_payload.extraction.columns_count, 3);
        assert.equal(byId.get('msg-single').normalized_text.includes('Planilha: Produtos'), true);
        assert.equal(byId.get('msg-single').normalized_text.includes('Código=1001 | Produto=Toalha | Quantidade=12'), true);
        assert.equal(byId.get('msg-multi').normalized_payload.extraction.status, 'extracted');
        assert.equal(byId.get('msg-multi').normalized_payload.extraction.sheets_count, 2);
        assert.equal(byId.get('msg-multi').normalized_payload.extraction.rows_count, 2);
        assert.equal(byId.get('msg-multi').normalized_payload.extraction.columns_count, 3);
        assert.equal(byId.get('msg-multi').normalized_text.includes('Planilha: Produtos'), true);
        assert.equal(byId.get('msg-multi').normalized_text.includes('Planilha: Estoque'), true);
      }
    },
    {
      name: 'worker marca xlsx vazio e invalido corretamente',
      run: async () => {
        reset();
        const emptyXlsxPath = await createTempFile('empty.xlsx', await createEmptyXlsxBuffer());
        const brokenXlsxPath = await createTempFile('broken.xlsx', Buffer.from('not-a-real-xlsx', 'utf8'));
        await seedLearningEvent('msg-empty', { message_type: 'spreadsheet', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_name: 'empty.xlsx', url: pathToFileURL(emptyXlsxPath).href }, '');
        await seedLearningEvent('msg-broken', { message_type: 'spreadsheet', mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_name: 'broken.xlsx', url: pathToFileURL(brokenXlsxPath).href }, '');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const events = __dumpMemoryWhatsappLearningForTests();
        const byId = new Map(events.map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-empty').normalized_payload.extraction.status, 'empty');
        assert.equal(byId.get('msg-empty').normalized_payload.extraction.sheets_count, 1);
        assert.equal(byId.get('msg-broken').normalized_payload.extraction.status, 'failed');
      }
    },
    {
      name: 'worker marca pdf e docx vazios como empty e preserva metadados',
      run: async () => {
        reset();
        const pdfPath = await createTempFile('empty.pdf', await createMinimalPdfBuffer(''));
        const docxPath = await createTempFile('empty.docx', await createMinimalDocxBuffer(''));
        await seedLearningEvent('msg-pdf', { message_type: 'document', mime_type: 'application/pdf', file_name: 'empty.pdf', url: pathToFileURL(pdfPath).href, original_metadata: { source: 'legacy' } }, '');
        await seedLearningEvent('msg-docx', { message_type: 'document', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_name: 'empty.docx', url: pathToFileURL(docxPath).href }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 2);
        const byId = new Map(__dumpMemoryWhatsappLearningForTests().map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-pdf').normalized_payload.extraction.status, 'empty');
        assert.equal(byId.get('msg-pdf').normalized_text, '');
        assert.equal(byId.get('msg-pdf').metadata.original_metadata.source, 'legacy');
        assert.equal(byId.get('msg-docx').normalized_payload.extraction.status, 'empty');
      }
    },
    {
      name: 'worker preserva url e storage_key nos attachments sem baixar mídia',
      run: async () => {
        reset();
        await seedLearningEvent('msg-image', {
          message_type: 'image',
          mime_type: 'image/png',
          file_name: 'image.png',
          url: 'https://example.com/image.png',
          storage_key: 'bucket/path/image.png',
          file_size: 321,
          width: 640,
          height: 480
        }, '');
        await seedLearningEvent('msg-audio', {
          message_type: 'audio',
          mime_type: 'audio/ogg',
          file_name: 'audio.ogg',
          url: 'https://example.com/audio.ogg',
          storage_key: 'bucket/path/audio.ogg',
          duration_seconds: 18
        }, '');
        await seedLearningEvent('msg-video', {
          message_type: 'video',
          mime_type: 'video/mp4',
          file_name: 'video.mp4',
          url: 'https://example.com/video.mp4',
          storage_key: 'bucket/path/video.mp4',
          duration_seconds: 44
        }, '');
        await seedLearningEvent('msg-sticker', {
          message_type: 'sticker',
          mime_type: 'image/webp',
          file_name: 'sticker.webp',
          url: 'https://example.com/sticker.webp',
          storage_key: 'bucket/path/sticker.webp'
        }, '');
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const byId = new Map(__dumpMemoryWhatsappLearningForTests().map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].url, 'https://example.com/image.png');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].storage_key, 'bucket/path/image.png');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].media_status, 'pending');
        assert.equal(byId.get('msg-image').normalized_payload.attachments[0].ocr_status, 'disabled');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].url, 'https://example.com/audio.ogg');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].storage_key, 'bucket/path/audio.ogg');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_status, 'disabled');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_text, '');
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_provider, null);
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_error, null);
        assert.equal(byId.get('msg-audio').normalized_payload.attachments[0].transcription_processed_at, null);
        assert.equal(byId.get('msg-video').normalized_payload.attachments[0].url, 'https://example.com/video.mp4');
        assert.equal(byId.get('msg-video').normalized_payload.attachments[0].storage_key, 'bucket/path/video.mp4');
        assert.equal(byId.get('msg-video').normalized_payload.attachments[0].thumbnail_status, 'pending');
        assert.equal(byId.get('msg-sticker').normalized_payload.attachments[0].url, 'https://example.com/sticker.webp');
        assert.equal(byId.get('msg-sticker').normalized_payload.attachments[0].storage_key, 'bucket/path/sticker.webp');
      }
    },
    {
      name: 'worker marca arquivo inacessivel como pending e tipo nao docx como unsupported',
      run: async () => {
        reset();
        const docPath = await createTempFile('sample.doc', Buffer.from('legacy-word-placeholder'));
        await seedLearningEvent('msg-pdf', { message_type: 'document', mime_type: 'application/pdf', file_name: 'sample.pdf' }, '');
        await seedLearningEvent('msg-doc', { message_type: 'document', mime_type: 'application/msword', file_name: 'sample.doc', url: pathToFileURL(docPath).href }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.processed, 2);
        const byId = new Map(__dumpMemoryWhatsappLearningForTests().map((item) => [item.whatsapp_message_id, item]));
        assert.equal(byId.get('msg-pdf').normalized_payload.extraction.status, 'pending');
        assert.equal(byId.get('msg-doc').normalized_payload.extraction.status, 'unsupported');
      }
    },
    {
      name: 'worker registra falha tecnica de extração sem quebrar processamento',
      run: async () => {
        reset();
        const filePath = await createTempFile('broken.docx', Buffer.from('not a real docx zip'));
        await seedLearningEvent('msg-broken', { message_type: 'document', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_name: 'broken.docx', url: pathToFileURL(filePath).href }, '');
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.failed, 0);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'processed');
        assert.equal(updated.normalized_payload.extraction.status, 'failed');
        assert.ok(updated.normalized_payload.extraction.error);
      }
    },
    {
      name: 'worker registra erro e muda status para failed quando ocorrer falha',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: '__force_error__' }, { accountId: 'acc-1' });
        const result = await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        assert.equal(result.failed, 1);
        const updated = __dumpMemoryWhatsappLearningForTests()[0];
        assert.equal(updated.status, 'failed');
        assert.ok(String(updated.error || '').includes('forced_learning_analysis_failure'));
      }
    },
    {
      name: 'classificacoes textuais básicas retornam intents esperados',
      run: async () => {
        reset();
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-1', messageId: 'm1', body: 'oi' }, { accountId: 'acc-1' });
        await createLearningEvent({ accountId: 'acc-1', whatsappMessageId: 'msg-2', messageId: 'm2', body: 'não gostei do atraso' }, { accountId: 'acc-1' });
        await runWhatsappLearningWorker({ accountId: 'acc-1', limit: 10 });
        const events = __dumpMemoryWhatsappLearningForTests();
        const greeting = events.find((item) => item.whatsapp_message_id === 'msg-1');
        const complaint = events.find((item) => item.whatsapp_message_id === 'msg-2');
        assert.equal(greeting.status, 'processed');
        assert.equal(complaint.status, 'processed');
        assert.equal(greeting.normalized_payload.content_type, 'text');
        assert.equal(complaint.normalized_payload.content_type, 'text');
      }
    }
  ];
}
