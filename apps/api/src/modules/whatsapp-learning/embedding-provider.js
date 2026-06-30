function cleanString(value) {
  return String(value ?? '').trim();
}

function normalizeProviderName(value) {
  return cleanString(value).toLowerCase() || 'disabled';
}

function buildSafeMetadata(input = {}) {
  return {
    account_id: input.accountId ?? input.account_id ?? null,
    customer_knowledge_id: input.customerKnowledgeId ?? input.customer_knowledge_id ?? null,
    source_event_id: input.sourceEventId ?? input.source_event_id ?? null
  };
}

export function resolveEmbeddingProviderName(input = {}) {
  return normalizeProviderName(input.provider || process.env.EMBEDDING_PROVIDER || 'disabled');
}

export async function embedKnowledge(input = {}) {
  const provider = resolveEmbeddingProviderName(input);
  const enabled = String(input.enabled ?? process.env.EMBEDDING_WORKER_ENABLED ?? 'false').toLowerCase() === 'true';
  const metadata = buildSafeMetadata(input);

  if (!enabled || provider === 'disabled') {
    return {
      status: 'disabled',
      provider: null,
      vector: null,
      dimensions: 0,
      error: null,
      metadata
    };
  }

  return {
    status: 'unsupported',
    provider,
    vector: null,
    dimensions: 0,
    error: null,
    metadata
  };
}

export async function searchKnowledge(input = {}) {
  const provider = resolveEmbeddingProviderName(input);
  const enabled = String(input.enabled ?? process.env.EMBEDDING_WORKER_ENABLED ?? 'false').toLowerCase() === 'true';
  const metadata = buildSafeMetadata(input);

  if (!enabled || provider === 'disabled') {
    return {
      status: 'disabled',
      provider: null,
      results: [],
      metadata
    };
  }

  return {
    status: 'unsupported',
    provider,
    results: [],
    metadata
  };
}

export async function healthCheckEmbeddingProvider(input = {}) {
  const provider = resolveEmbeddingProviderName(input);
  const enabled = String(input.enabled ?? process.env.EMBEDDING_WORKER_ENABLED ?? 'false').toLowerCase() === 'true';
  const disabled = !enabled || provider === 'disabled';

  return {
    ok: true,
    status: disabled ? 'disabled' : 'unsupported',
    provider: disabled ? null : provider,
    enabled: !disabled,
    vector_store: 'not_configured',
    metadata: buildSafeMetadata(input)
  };
}
