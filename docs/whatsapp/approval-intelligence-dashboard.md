# Approval Intelligence Dashboard

Este painel transforma aprovações e rejeições de drafts em inteligência operacional para a jornada comercial.

## Métricas

- `totalDrafts`: total de rascunhos considerados no período.
- `approved`: quantidade de drafts aprovados.
- `rejected`: quantidade de drafts rejeitados.
- `approvalRate`: `approved / totalDrafts * 100`.
- `rejectionRate`: `rejected / totalDrafts * 100`.
- `avgApprovalTime`: média do tempo entre criação do draft e decisão de aprovação.
- `avgSendTime`: média do tempo entre criação do draft e log de envio.

## Fontes de dados

- `message_drafts`
- `message_draft_approvals`
- `whatsapp_delivery_logs`
- `commercial_agent_actions`

## Regras de agrupamento

Os drafts são agrupados por estratégia comercial:

- `reactivation`
- `replenishment`
- `upsell`
- `cross_sell`
- `relationship`
- `risk_recovery`

Quando o tipo vier ausente ou fora da lista, o sistema normaliza para `relationship`.

## Motivos de rejeição

Os motivos são consolidados a partir de campos como:

- `reason`
- `comment`
- `rejection_reason`

O painel exibe os motivos mais frequentes para ajudar a identificar padrões de objeção, qualidade de contexto ou problemas de timing.

## Tendências

As tendências são exibidas em série temporal por:

- dia
- semana
- mês

O período pode ser filtrado via query string no backend.

## Interpretação

- Taxa de aprovação acima de `80%`: sinal verde.
- Entre `50%` e `80%`: atenção para ajustes finos.
- Abaixo de `50%`: revisão operacional recomendada.

## Tenant isolation

Todas as consultas são filtradas por `account_id`. Nenhum resultado deve cruzar contas diferentes.

