export async function analyzeCommercialAgent(api, conversationId) { return api.post('/commercial-agent/analyze', { conversationId }); }
export async function getCommercialAgentConversation(api, conversationId) { return api.get(`/commercial-agent/conversation/${conversationId}`); }
