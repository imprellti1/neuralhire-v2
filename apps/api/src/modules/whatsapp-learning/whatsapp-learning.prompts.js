export function buildWhatsappLearningPrompt(message = {}) {
  return [
    'Analise a mensagem de WhatsApp e retorne um JSON estruturado.',
    `texto: ${String(message.body || '')}`,
    `tipo de conteudo: ${String(message.content_type || 'text')}`,
    'campos: intent, sentiment, importance, summary, entities, topics, needs_followup, next_action'
  ].join('\n');
}

