export async function sendWhatsappDelivery(api, payload) { return api.post('/whatsapp-delivery/send', payload); }
export async function sendWhatsappDeliveryWebhook(api, payload) { return api.post('/whatsapp-delivery/webhook', payload); }
