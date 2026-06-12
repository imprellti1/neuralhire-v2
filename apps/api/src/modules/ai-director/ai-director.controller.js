import { getAiDirectorDashboard } from './ai-director.repository.js';

export async function getAiDirectorDashboardHandler() {
  return { ok: true, ...getAiDirectorDashboard() };
}
