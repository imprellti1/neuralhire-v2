function cleanString(value) {
  return String(value ?? '').trim();
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return cleanString(value).toLowerCase() === 'true';
}

function resolveProviderName(input = {}) {
  const provider = cleanString(input.provider || process.env.TRANSCRIPTION_PROVIDER || 'disabled').toLowerCase();
  return provider || 'disabled';
}

export async function transcribeAudio(input = {}) {
  const provider = resolveProviderName(input);
  const enabled = normalizeBoolean(input.enabled ?? process.env.TRANSCRIPTION_ENABLED);
  if (!enabled || provider === 'disabled') {
    return {
      status: 'disabled',
      text: '',
      provider: null,
      error: null,
      processedAt: null,
      metadata: {}
    };
  }

  return {
    status: 'unsupported',
    text: '',
    provider,
    error: null,
    processedAt: null,
    metadata: {}
  };
}

