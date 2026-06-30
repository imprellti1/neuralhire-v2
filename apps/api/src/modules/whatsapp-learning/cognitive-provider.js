function cleanString(value) {
  return String(value ?? '').trim();
}

function isEnabled(value) {
  return ['true', '1', 'yes', 'on'].includes(cleanString(value).toLowerCase());
}

export async function analyzeLearningEvent(input = {}) {
  const provider = cleanString(process.env.COGNITIVE_PROVIDER || 'disabled').toLowerCase() || 'disabled';
  const enabled = isEnabled(process.env.COGNITIVE_WORKER_ENABLED);

  if (provider === 'throw') {
    throw new Error('forced_cognitive_provider_failure');
  }

  if (!enabled || provider === 'disabled') {
    return {
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
        event_id: input.event_id ?? null,
        account_id: input.account_id ?? null,
        normalized_text: input.normalized_text ?? null,
        normalized_payload: input.normalized_payload ?? null,
        has_normalized_text: typeof input.normalized_text === 'string',
        has_normalized_payload: Boolean(input.normalized_payload && typeof input.normalized_payload === 'object')
      }
    };
  }

  return {
    status: 'disabled',
    intent: 'unknown',
    sentiment: 'neutral',
    importance: 1,
    summary: null,
    entities: {},
    topics: [],
    needs_followup: false,
    next_action: null,
    provider,
    model: null,
    error: null,
    metadata: {
      input_received: Boolean(input && typeof input === 'object')
    }
  };
}
