import { normalizeWhatsappLearningImportance, normalizeWhatsappLearningIntent, normalizeWhatsappLearningSentiment } from './whatsapp-learning.schemas.js';

export function truncateWhatsappLearningSummary(value, max = 300) {
  const text = String(value || '').trim();
  return text.length > max ? text.slice(0, max) : text;
}

export function mapWhatsappLearningAnalysis(input = {}) {
  return {
    intent: normalizeWhatsappLearningIntent(input.intent),
    sentiment: normalizeWhatsappLearningSentiment(input.sentiment),
    importance: normalizeWhatsappLearningImportance(input.importance),
    summary: truncateWhatsappLearningSummary(input.summary || ''),
    entities: Array.isArray(input.entities) ? input.entities : [],
    topics: Array.isArray(input.topics) ? input.topics : [],
    needs_followup: Boolean(input.needs_followup),
    next_action: String(input.next_action || '').trim() || null,
    metadata: input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata) ? input.metadata : {}
  };
}

