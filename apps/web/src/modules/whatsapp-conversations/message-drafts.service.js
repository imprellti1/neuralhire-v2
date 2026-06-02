export async function generateMessageDraft(api, conversationId) { return api.post('/message-drafts/generate', { conversationId }); }
export async function getConversationMessageDrafts(api, conversationId) { return api.get(`/message-drafts/conversation/${conversationId}`); }
