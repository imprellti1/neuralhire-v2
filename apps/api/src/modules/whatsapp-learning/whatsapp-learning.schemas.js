export const WHATSAPP_LEARNING_INTENTS = [
  'purchase',
  'quotation',
  'complaint',
  'support',
  'payment',
  'collection',
  'delivery',
  'exchange',
  'return',
  'greeting',
  'goodbye',
  'information',
  'unknown'
];

export const WHATSAPP_LEARNING_SENTIMENTS = ['positive', 'neutral', 'negative', 'urgent'];

export function normalizeWhatsappLearningIntent(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return WHATSAPP_LEARNING_INTENTS.includes(normalized) ? normalized : 'unknown';
}

export function normalizeWhatsappLearningSentiment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return WHATSAPP_LEARNING_SENTIMENTS.includes(normalized) ? normalized : 'neutral';
}

export function normalizeWhatsappLearningImportance(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 3;
  return Math.min(10, Math.max(1, Math.round(numeric)));
}

