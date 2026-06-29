import { createHash } from 'node:crypto';

const SUPPORTED_MEDIA_TYPES = new Set(['image', 'audio', 'video', 'sticker']);

function cleanString(value) {
  return String(value ?? '').trim();
}

function cleanMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function serializeHashInput(parts = {}) {
  return stableStringify({
    type: cleanString(parts.type).toLowerCase(),
    mime_type: cleanString(parts.mime_type || parts.mimeType).toLowerCase(),
    file_name: cleanString(parts.file_name || parts.fileName),
    file_size: Number.isFinite(Number(parts.file_size ?? parts.fileSize)) ? Number(parts.file_size ?? parts.fileSize) : null,
    url: cleanString(parts.url || parts.file_url || parts.fileUrl),
    storage_key: cleanString(parts.storage_key || parts.storageKey),
    width: Number.isFinite(Number(parts.width)) ? Number(parts.width) : null,
    height: Number.isFinite(Number(parts.height)) ? Number(parts.height) : null,
    duration_seconds: Number.isFinite(Number(parts.duration_seconds ?? parts.durationSeconds)) ? Number(parts.duration_seconds ?? parts.durationSeconds) : null,
    metadata: cleanMetadata(parts.metadata)
  });
}

export function generateMediaSha256(parts = {}) {
  return createHash('sha256').update(serializeHashInput(parts)).digest('hex');
}

export function buildMediaAttachment(type, metadata = {}, extra = {}) {
  const normalizedType = cleanString(type).toLowerCase();
  const attachmentMetadata = cleanMetadata(metadata.metadata);
  const width = extra.width ?? metadata.width ?? null;
  const height = extra.height ?? metadata.height ?? null;
  const durationSeconds = extra.duration_seconds ?? extra.durationSeconds ?? metadata.duration_seconds ?? metadata.durationSeconds ?? null;
  const fileSize = extra.file_size ?? extra.fileSize ?? metadata.file_size ?? metadata.fileSize ?? null;
  const mimeType = extra.mime_type ?? extra.mimeType ?? metadata.mime_type ?? metadata.mimeType ?? null;
  const fileName = extra.file_name ?? extra.fileName ?? metadata.file_name ?? metadata.fileName ?? null;
  const url = extra.url ?? metadata.url ?? metadata.file_url ?? metadata.fileUrl ?? null;
  const storageKey = extra.storage_key ?? metadata.storage_key ?? metadata.storageKey ?? null;
  const sha256 = extra.sha256 || generateMediaSha256({
    type: normalizedType,
    mime_type: mimeType,
    file_name: fileName,
    file_size: fileSize,
    url,
    storage_key: storageKey,
    width,
    height,
    duration_seconds: durationSeconds,
    metadata: attachmentMetadata
  });

  return {
    id: extra.id || null,
    type: normalizedType,
    mime_type: mimeType,
    file_name: fileName,
    file_size: fileSize,
    sha256,
    storage_provider: extra.storage_provider ?? metadata.storage_provider ?? null,
    storage_bucket: extra.storage_bucket ?? metadata.storage_bucket ?? null,
    storage_key: storageKey,
    url,
    width,
    height,
    duration_seconds: durationSeconds,
    media_status: extra.media_status || 'pending',
    ocr_status: normalizedType === 'image' ? (extra.ocr_status || 'pending') : extra.ocr_status ?? null,
    transcription_status: normalizedType === 'audio' ? (extra.transcription_status || 'pending') : extra.transcription_status ?? null,
    thumbnail_status: normalizedType === 'video' ? (extra.thumbnail_status || 'pending') : extra.thumbnail_status ?? null,
    metadata: {
      ...attachmentMetadata,
      ...(extra.metadata && typeof extra.metadata === 'object' && !Array.isArray(extra.metadata) ? extra.metadata : {})
    }
  };
}

export function isSupportedMediaType(type) {
  return SUPPORTED_MEDIA_TYPES.has(cleanString(type).toLowerCase());
}

