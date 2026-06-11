export async function getAiDirectorOverview(api) { return api.get('/ai-director/overview'); }
export async function getAiDirectorAgents(api) { return api.get('/ai-director/agents'); }
export async function getAiDirectorEvents(api) { return api.get('/ai-director/events'); }
export async function createAiDirectorEvent(api, payload) { return api.post('/ai-director/events', payload); }
export async function markAiDirectorEventRead(api, id) { return api.patch(`/ai-director/events/${encodeURIComponent(id)}/read`); }
export async function archiveAiDirectorEvent(api, id) { return api.patch(`/ai-director/events/${encodeURIComponent(id)}/archive`); }
export async function getAiDirectorRecommendations(api) { return api.get('/ai-director/recommendations'); }
