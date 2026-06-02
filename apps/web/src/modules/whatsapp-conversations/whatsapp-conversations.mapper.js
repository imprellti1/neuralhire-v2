export function mapWhatsappConversationResponse(payload = {}) {
  return {
    conversation: payload.conversation || null,
    customer: payload.customer || null,
    memory: payload.memory || null,
    messages: payload.messages || [],
    events: payload.events || []
  };
}
