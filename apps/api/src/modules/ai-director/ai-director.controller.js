import { archiveAiDirectorEvent, createAiDirectorEvent, getAiDirectorOverview, listAiDirectorAgents, listAiDirectorEvents, listAiDirectorRecommendations, markAiDirectorEventRead } from './ai-director.repository.js';

export async function getAiDirectorOverviewHandler() {
  return { ok: true, ...getAiDirectorOverview() };
}

export async function getAiDirectorAgentsHandler() {
  return { ok: true, items: listAiDirectorAgents(), gerentes: listAiDirectorAgents() };
}

export async function getAiDirectorEventsHandler() {
  return { ok: true, items: listAiDirectorEvents() };
}

export async function createAiDirectorEventHandler(context = {}) {
  return { ok: true, item: createAiDirectorEvent(context.body || {}) };
}

export async function markAiDirectorEventReadHandler(context = {}) {
  const item = markAiDirectorEventRead(context.params?.id);
  return { ok: true, item };
}

export async function archiveAiDirectorEventHandler(context = {}) {
  const item = archiveAiDirectorEvent(context.params?.id);
  return { ok: true, item };
}

export async function getAiDirectorRecommendationsHandler() {
  return { ok: true, items: listAiDirectorRecommendations() };
}
