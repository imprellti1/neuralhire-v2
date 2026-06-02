# Action-Aware Draft Engine

O Draft Engine agora consome a ação comercial antes de montar a sugestão de mensagem.

## Fluxo

1. Buscar a conversa.
2. Buscar a customer memory.
3. Buscar a ação comercial existente para a conversa.
4. Se não existir ação, executar análise automática no Commercial Agent.
5. Gerar o draft usando a ação como principal sinal.
6. Persistir draft, ação e contexto.

## Tipos de ação

- `reactivation`
- `replenishment`
- `upsell`
- `cross_sell`
- `relationship`
- `risk_recovery`

## Regras

- A ação comercial tem prioridade sobre heurísticas antigas.
- O draft continua determinístico.
- Não há envio automático.
- Não há uso de LLM ou IA externa.
- O workflow de aprovação continua obrigatório para envio.

## Contexto persistido

O draft passa a guardar:

- `customerMemory`
- `action`
- `opportunities`
- `alerts`

## Scoring

A confiança final considera:

- score da ação comercial
- qualidade da memória do cliente
- quantidade de contexto disponível

## Limitações atuais

- O motor ainda depende de regras determinísticas.
- A análise comercial continua sendo a fonte da ação quando ela não existe.
- O envio só ocorre após aprovação humana.
