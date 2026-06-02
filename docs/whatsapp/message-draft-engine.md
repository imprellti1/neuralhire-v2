# Message Draft Engine

O Message Draft Engine gera apenas rascunhos determinísticos para uso humano. Ele não envia mensagens, não usa IA e não depende da Evolution API.

## Entradas

- `Customer Memory`
- histórico da conversa
- status comercial
- produtos recorrentes
- dias sem compra
- oportunidades
- alertas

## Saída

- tipo do draft
- mensagem sugerida
- motivo da sugestão
- score de confiança
- contexto salvo

## Tipos de draft

- `reactivation`
- `replenishment`
- `followup`
- `relationship`
- `generic`

## Regras

- `diasSemCompra > 120` tende a gerar reativação.
- produto recorrente com frequência alta tende a gerar reposição.
- cliente ativo e sem alerta tende a gerar relacionamento.
- quando não há sinal suficiente, o motor cai para uma mensagem genérica.

## Scoring

O score vai de `0` a `100` e considera:

- risco
- oportunidade
- frequência
- histórico

## Contexto persistido

O draft salva:

```json
{
  "customerMemory": {},
  "opportunities": [],
  "alerts": [],
  "conversationSummary": {}
}
```

## Integração futura

Na próxima etapa, este motor pode ser adaptado para receber revisão humana antes de qualquer envio automático. Depois disso, a camada de IA pode substituir ou complementar os templates determinísticos.
