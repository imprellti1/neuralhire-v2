# WhatsApp Conversation Store

## Objetivo
Base estrutural para conversas WhatsApp multi-tenant, auditavel e segura.

## Tabelas
- `whatsapp_conversations`
- `whatsapp_messages`
- `whatsapp_conversation_events`

## Endpoints
- `GET /whatsapp/conversations`
- `GET /whatsapp/conversations/:conversationId`
- `POST /whatsapp/conversations`
- `POST /whatsapp/conversations/:conversationId/messages`
- `PATCH /whatsapp/conversations/:conversationId/status`
- `POST /whatsapp/conversations/:conversationId/events`

## Limites da etapa
- Sem envio externo
- Sem Evolution API
- Sem OpenAI
- Sem secrets novos
- Sem acesso direto do frontend ao Supabase

## Futuro
- Integra Evolution API depois
- Integra Customer Memory depois
- Permite agente com aprovacao humana depois
