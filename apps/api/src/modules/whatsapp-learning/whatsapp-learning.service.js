import { logger } from '../../core/logger.js';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildWhatsappLearningNormalizedPayload, listPendingLearningEvents, normalizeLearningEvent } from './whatsapp-learning.repository.js';

const MAX_EXTRACTED_TEXT_CHARS = 50000;
const MAX_ROWS = 1000;
const MAX_COLUMNS = 100;

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

function looksLikeSpreadsheet(metadata = {}, messageType = '') {
  const mimeType = String(metadata.mime_type || metadata.mimeType || '').toLowerCase();
  const fileName = String(metadata.file_name || metadata.fileName || '').toLowerCase();
  const normalizedType = String(messageType || '').toLowerCase();
  return normalizedType === 'spreadsheet' || mimeType.includes('spreadsheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
}

function looksLikeCsv(metadata = {}, messageType = '') {
  const mimeType = String(metadata.mime_type || metadata.mimeType || '').toLowerCase();
  const fileName = String(metadata.file_name || metadata.fileName || '').toLowerCase();
  const normalizedType = String(messageType || '').toLowerCase();
  return normalizedType === 'csv' || mimeType === 'text/csv' || fileName.endsWith('.csv');
}

function buildExtractionState(status, extras = {}) {
  const state = {
    status,
    method: extras.method || null,
    text_length: extras.text_length ?? 0,
    extracted_at: extras.extracted_at || null,
    error: extras.error ?? null,
    truncated: Boolean(extras.truncated),
    max_chars: extras.max_chars ?? null
  };
  if (extras.rows_count !== undefined) state.rows_count = extras.rows_count;
  if (extras.columns_count !== undefined) state.columns_count = extras.columns_count;
  if (extras.sheets_count !== undefined) state.sheets_count = extras.sheets_count;
  if (extras.rows_processed !== undefined) state.rows_processed = extras.rows_processed;
  if (extras.rows_total !== undefined) state.rows_total = extras.rows_total;
  return state;
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

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (inQuotes) throw new Error('CSV malformed input');
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function csvRowsToText(rows, { maxRows = MAX_ROWS, maxColumns = MAX_COLUMNS } = {}) {
  if (!rows.length) return { text: '', rowsCount: 0, columnsCount: 0, truncated: false, rowsProcessed: 0, rowsTotal: 0 };
  const header = rows[0].slice(0, maxColumns).map((cell, index) => String(cell || `Coluna ${index + 1}`).trim() || `Coluna ${index + 1}`);
  const dataRows = rows.slice(1);
  const rowsTotal = dataRows.length;
  const rowsProcessed = Math.min(rowsTotal, maxRows);
  const columnsCount = header.length;
  const chunks = [];
  for (let rowIndex = 0; rowIndex < rowsProcessed; rowIndex += 1) {
    const row = dataRows[rowIndex].slice(0, maxColumns);
    const lines = header.map((columnName, columnIndex) => `${columnName}=${String(row[columnIndex] ?? '').trim()}`);
    chunks.push(`Linha ${rowIndex + 1}:\n${lines.join(' | ')}`);
  }
  return {
    text: chunks.join('\n\n'),
    rowsCount: rowsTotal,
    columnsCount,
    truncated: rowsTotal > maxRows || rows.some((row) => row.length > maxColumns),
    rowsProcessed,
    rowsTotal
  };
}

async function extractCsvText(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer.toString('utf8') : String(buffer || '');
  const normalized = raw.replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r\n|\n|\r/).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
  if (!lines.length) return { text: '', rowsCount: 0, columnsCount: 0, truncated: false, rowsProcessed: 0, rowsTotal: 0 };
  const rows = lines.map(parseCsvLine);
  return csvRowsToText(rows);
}

function sheetRowsToText(sheetRows, sheetName, { maxRows = MAX_ROWS, maxColumns = MAX_COLUMNS } = {}) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  if (!rows.length || rows.length <= 1) {
    return { text: '', rowsCount: 0, columnsCount: 0, truncated: false, rowsProcessed: 0 };
  }
  const header = rows[0].slice(0, maxColumns).map((cell, index) => String(cell || `Coluna ${index + 1}`).trim() || `Coluna ${index + 1}`);
  const dataRows = rows.slice(1);
  const rowsProcessed = Math.min(dataRows.length, maxRows);
  const chunks = [`Planilha: ${sheetName}`];
  for (let rowIndex = 0; rowIndex < rowsProcessed; rowIndex += 1) {
    const row = dataRows[rowIndex].slice(0, maxColumns);
    const lines = header.map((columnName, columnIndex) => `${columnName}=${String(row[columnIndex] ?? '').trim()}`);
    chunks.push(`Linha ${rowIndex + 1}:\n${lines.join(' | ')}`);
  }
  return {
    text: chunks.join('\n\n'),
    rowsCount: dataRows.length,
    columnsCount: header.length,
    truncated: dataRows.length > maxRows || rows.some((row) => row.length > maxColumns),
    rowsProcessed
  };
}

async function extractSpreadsheetText(buffer) {
  const signature = Buffer.isBuffer(buffer) ? buffer.subarray(0, 2).toString('utf8') : String(buffer || '').slice(0, 2);
  if (signature !== 'PK') {
    throw new Error('XLSX malformed input');
  }
  const { default: XLSX } = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer', cellText: false, cellFormula: false, cellDates: false });
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) return { text: '', rowsCount: 0, columnsCount: 0, sheetsCount: 0, truncated: false, rowsProcessed: 0 };
  const segments = [];
  let rowsCount = 0;
  let columnsCount = 0;
  let rowsProcessed = 0;
  let truncated = false;
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets?.[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet || {}, { header: 1, raw: true, blankrows: false });
    const extracted = sheetRowsToText(rows, sheetName);
    segments.push(extracted.text);
    rowsCount += extracted.rowsCount;
    columnsCount = Math.max(columnsCount, extracted.columnsCount);
    rowsProcessed += extracted.rowsProcessed;
    truncated = truncated || extracted.truncated;
  }
  return {
    text: segments.filter(Boolean).join('\n\n'),
    rowsCount,
    columnsCount,
    sheetsCount: sheetNames.length,
    truncated,
    rowsProcessed
  };
}

function detectDocumentMethod(messageType, metadata = {}) {
  const mimeType = String(metadata.mime_type || metadata.mimeType || '').toLowerCase();
  const fileName = String(metadata.file_name || metadata.fileName || '').toLowerCase();
  if (messageType === 'pdf' || mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf_text_extraction';
  if (messageType === 'document' && looksLikeDocx(metadata)) return 'docx_text_extraction';
  if (looksLikeSpreadsheet(metadata, messageType)) return 'spreadsheet_text_extraction';
  if (looksLikeCsv(metadata, messageType)) return 'spreadsheet_text_extraction';
  return null;
}

async function extractNormalizedText(message = {}, normalizedPayload = {}) {
  const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata) ? message.metadata : {};
  const contentType = normalizedPayload.content_type || 'unknown';
  if (!['pdf', 'document', 'spreadsheet', 'csv'].includes(contentType)) {
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
          extraction: buildExtractionState('empty', {
            method,
            extracted_at: new Date().toISOString(),
            rows_count: 0,
            columns_count: 0,
            sheets_count: contentType === 'csv' ? 1 : 0,
            rows_processed: 0,
            rows_total: 0
          })
        },
        normalizedText: ''
      };
    }

    let extracted;
    if (method === 'pdf_text_extraction') extracted = { text: await extractPdfText(buffer) };
    else if (method === 'docx_text_extraction') extracted = { text: await extractDocxText(buffer) };
    else if (method === 'spreadsheet_text_extraction' && contentType === 'csv') extracted = await extractCsvText(buffer);
    else if (method === 'spreadsheet_text_extraction') extracted = await extractSpreadsheetText(buffer);
    else extracted = { text: '' };
    const rawText = extracted.text || '';
    const trimmedText = String(rawText || '').trim();
    if (!trimmedText) {
      return {
        normalizedPayload: {
          ...normalizedPayload,
          text: '',
          extraction: buildExtractionState('empty', {
            method,
            extracted_at: new Date().toISOString(),
            rows_count: extracted.rowsCount ?? 0,
            columns_count: extracted.columnsCount ?? 0,
            sheets_count: extracted.sheetsCount ?? (contentType === 'csv' ? 1 : 0),
            rows_processed: extracted.rowsProcessed ?? 0,
            rows_total: extracted.rowsTotal ?? 0,
            truncated: Boolean(extracted.truncated)
          })
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
          truncated: truncated || Boolean(extracted.truncated),
          max_chars: truncated ? MAX_EXTRACTED_TEXT_CHARS : null,
          rows_count: extracted.rowsCount ?? 0,
          columns_count: extracted.columnsCount ?? 0,
          sheets_count: extracted.sheetsCount ?? (contentType === 'csv' ? 1 : 0),
          rows_processed: extracted.rowsProcessed ?? 0,
          rows_total: extracted.rowsTotal ?? 0
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
