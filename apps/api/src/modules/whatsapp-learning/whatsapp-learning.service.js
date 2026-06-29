import { logger } from '../../core/logger.js';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildWhatsappLearningNormalizedPayload, listPendingLearningEvents, normalizeLearningEvent } from './whatsapp-learning.repository.js';

const MAX_EXTRACTED_TEXT_CHARS = 50000;

function safeErrorMessage(error) {
  const message = String(error?.message || error || 'Erro de extração');
  return message.replace(/\s+/g, ' ').trim().slice(0, 180) || 'Erro de extração';
}

function normalizeFileReference(metadata = {}) {
  return metadata.url || metadata.file_url || metadata.fileUrl || metadata.storage_key || metadata.storageKey || null;
}

function looksLikeDocx(metadata = {}) {
  const mimeType = String(metadata.mime_type || metadata.mimeType || '').toLowerCase();
  const fileName = String(metadata.file_name || metadata.fileName || '').toLowerCase();
  return mimeType.includes('wordprocessingml') || fileName.endsWith('.docx');
}

function buildExtractionState(status, extras = {}) {
  return {
    status,
    method: extras.method || null,
    text_length: extras.text_length ?? 0,
    extracted_at: extras.extracted_at || null,
    error: extras.error ?? null,
    truncated: Boolean(extras.truncated),
    max_chars: extras.max_chars ?? null
  };
}

async function loadFileBuffer(fileReference) {
  if (!fileReference) return null;
  if (String(fileReference).startsWith('file://')) {
    const path = fileURLToPath(fileReference);
    await access(path);
    return readFile(path);
  }
  await access(fileReference);
  return readFile(fileReference);
}

async function extractPdfText(buffer) {
  try {
    const { default: pdfParse } = await import('pdf-parse');
    const result = await pdfParse(buffer);
    const text = String(result?.text || '');
    if (text.trim()) return text;
  } catch {
    // fall through to deterministic buffer scan
  }
  const raw = Buffer.isBuffer(buffer) ? buffer.toString('latin1') : String(buffer || '');
  const matches = [...raw.matchAll(/\(([^()]{1,500})\)\s*T[Jj]/g)].map((entry) => entry[1]);
  return matches.join('\n');
}

async function extractDocxText(buffer) {
  try {
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = String(result?.value || '');
    if (text.trim()) return text;
  } catch {
    // fall through to deterministic zip fallback
  }
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  return String(xml || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectDocumentMethod(messageType, metadata = {}) {
  const mimeType = String(metadata.mime_type || metadata.mimeType || '').toLowerCase();
  const fileName = String(metadata.file_name || metadata.fileName || '').toLowerCase();
  if (messageType === 'pdf' || mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf_text_extraction';
  if (messageType === 'document' && looksLikeDocx(metadata)) return 'docx_text_extraction';
  return null;
}

async function extractNormalizedText(message = {}, normalizedPayload = {}) {
  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata : {};
  const contentType = normalizedPayload.content_type || 'unknown';
  if (!['pdf', 'document'].includes(contentType)) {
    return {
      normalizedPayload: {
        ...normalizedPayload,
        extraction: buildExtractionState('not_applicable')
      },
      normalizedText: normalizedPayload.text || ''
    };
  }

  const fileReference = normalizeFileReference(metadata);
  if (!fileReference) {
    return {
      normalizedPayload: {
        ...normalizedPayload,
        extraction: buildExtractionState('pending')
      },
      normalizedText: normalizedPayload.text || ''
    };
  }

  const method = detectDocumentMethod(contentType, metadata);
  if (!method) {
    return {
      normalizedPayload: {
        ...normalizedPayload,
        extraction: buildExtractionState('unsupported')
      },
      normalizedText: normalizedPayload.text || ''
    };
  }

  try {
    const buffer = await loadFileBuffer(fileReference);
    if (!buffer || buffer.length === 0) {
      return {
        normalizedPayload: {
          ...normalizedPayload,
          extraction: buildExtractionState('empty', { method, extracted_at: new Date().toISOString() })
        },
        normalizedText: ''
      };
    }

    const rawText = method === 'pdf_text_extraction' ? await extractPdfText(buffer) : await extractDocxText(buffer);
    const trimmedText = String(rawText || '').trim();
    if (!trimmedText) {
      return {
        normalizedPayload: {
          ...normalizedPayload,
          text: '',
          extraction: buildExtractionState('empty', { method, extracted_at: new Date().toISOString() })
        },
        normalizedText: ''
      };
    }

    const truncated = trimmedText.length > MAX_EXTRACTED_TEXT_CHARS;
    const extractedText = truncated ? trimmedText.slice(0, MAX_EXTRACTED_TEXT_CHARS) : trimmedText;
    return {
      normalizedPayload: {
        ...normalizedPayload,
        text: extractedText,
        extraction: buildExtractionState('extracted', {
          method,
          text_length: extractedText.length,
          extracted_at: new Date().toISOString(),
          truncated,
          max_chars: truncated ? MAX_EXTRACTED_TEXT_CHARS : null
        })
      },
      normalizedText: extractedText
    };
  } catch (error) {
    return {
      normalizedPayload: {
        ...normalizedPayload,
        extraction: buildExtractionState('failed', {
          method,
          error: safeErrorMessage(error),
          extracted_at: new Date().toISOString()
        })
      },
      normalizedText: normalizedPayload.text || ''
    };
  }
}

export async function normalizeWhatsappLearningMessage(message = {}) {
  if (String(message.body || '') === '__force_error__') {
    throw new Error('forced_learning_analysis_failure');
  }
  const builtPayload = buildWhatsappLearningNormalizedPayload(message);
  const { normalizedPayload, normalizedText } = await extractNormalizedText(message, builtPayload);
  return {
    normalized_payload: normalizedPayload,
    normalized_text: normalizedText,
    normalized_at: new Date().toISOString(),
    processing_error: null,
    status: 'normalized'
  };
}

export async function runWhatsappLearningWorker(context = {}) {
  const accountId = context.accountId || null;
  const limit = Math.max(1, Number(context.limit) || 5);
  const events = await listPendingLearningEvents({ accountId, limit });
  let processed = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const normalization = await normalizeWhatsappLearningMessage(event, context);
      await normalizeLearningEvent(event.id, {
        ...normalization
      }, { accountId });
      processed += 1;
    } catch (error) {
      logger.error({ message: 'whatsapp_learning_worker_failed', error: error?.message || String(error), account_id: accountId, event_id: event.id });
      await normalizeLearningEvent(event.id, { status: 'failed', processing_error: error?.message || String(error), error: error?.message || String(error) }, { accountId });
      failed += 1;
    }
  }

  return { ok: true, processed, failed, scanned: events.length };
}
