import { createAiDirectorEvent } from './ai-director.repository.js';

export function classifyAiDirectorEvent(payload = {}) {
  return createAiDirectorEvent(payload);
}
