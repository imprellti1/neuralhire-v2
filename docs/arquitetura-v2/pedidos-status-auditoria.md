# Pedidos: Status e Auditoria

## Status oficiais
- rascunho
- enviado
- aprovado
- faturado
- cancelado

## Fluxo permitido
- rascunho -> enviado/cancelado
- enviado -> aprovado/cancelado
- aprovado -> faturado/cancelado
- faturado e cancelado: finais

## Endpoints
- PATCH `/pedidos/:id/status`
- GET `/pedidos/:id/history`

Todos exigem autenticação, tenant e permissão adequada.

## Histórico
Toda alteração de status gera registro em `pedido_status_history` com `status_anterior`, `status_novo`, `motivo` e `alterado_por`.

## Auditoria
A API gera evento de auditoria com:
- actor (`userId`, `role`, `accountId`)
- `requestId`
- ação e transição

## Segurança
- Multi-tenant por `account_id`
- Fallback memory mantém isolamento
- Supabase usa RLS + policies por tenant

## Preparação para IA e operação
A trilha de status e auditoria prepara base para pipeline comercial, follow-up IA, analytics, WhatsApp e CRM operacional.

## Próximos passos
- Persistir auditoria em stream/event store dedicado
- Regras de SLA por status
- Gatilhos de automação por mudança de status
