# Human Approval Workflow

This workflow keeps outbound WhatsApp drafts inside the platform until a human reviewer approves them.

## Fluxo

1. `message-drafts` gera um draft com status `generated`.
2. `message-approvals` cria ou lista a fila de revisão.
3. Um `manager`, `admin` ou `super_admin` aprova ou rejeita.
4. O draft muda para `approved` ou `rejected`.
5. O evento de auditoria é registrado em `whatsapp_conversation_events`.

## Papéis

- `sales`: somente visualização.
- `manager`: pode aprovar e rejeitar.
- `admin`: pode aprovar e rejeitar.
- `super_admin`: pode aprovar e rejeitar.

## Regras

- Tenant isolation é obrigatória.
- O draft precisa pertencer ao `accountId` atual.
- Rejeição exige comentário.
- Nenhuma integração externa é executada nesta etapa.

## Auditoria

- `draft_generated`
- `draft_approved`
- `draft_rejected`

## Evolução futura

Na próxima etapa, o envio manual aprovado poderá ser integrado à Evolution API sem quebrar a fila de governança.
