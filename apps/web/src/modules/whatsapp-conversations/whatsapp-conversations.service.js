export async function listWhatsappConversations(api, filters = {}) { const query = new URLSearchParams(filters); return api.get(`/whatsapp/conversations?${query.toString()}`); }
export async function getWhatsappConversation(api, conversationId) { return api.get(`/whatsapp/conversations/${conversationId}`); }
export async function getWhatsappConversationContext(api, conversationId) { return api.get(`/whatsapp/conversations/${conversationId}/context`); }
export async function getWhatsappConversationDraftState(api, conversationId) { return api.get(`/whatsapp/conversations/${conversationId}/draft-state`); }
export async function createWhatsappConversation(api, payload) { return api.post('/whatsapp/conversations', payload); }
export async function addWhatsappConversationMessage(api, conversationId, payload) { return api.post(`/whatsapp/conversations/${conversationId}/messages`, payload); }
export async function updateWhatsappConversationStatus(api, conversationId, payload) { return api.patch(`/whatsapp/conversations/${conversationId}/status`, payload); }
export async function addWhatsappConversationEvent(api, conversationId, payload) { return api.post(`/whatsapp/conversations/${conversationId}/events`, payload); }
export async function rebuildWhatsappConversationMemory(api, clienteId) { return api.post(`/customer-memory/${clienteId}/rebuild`); }
