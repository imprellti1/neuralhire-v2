import { processEvolutionWebhook } from './evolution.service.js';

export async function evolutionWebhookHandler(context = {}) {
  return processEvolutionWebhook(context.body || {}, context);
}
