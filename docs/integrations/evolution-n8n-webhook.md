# Evolution API + NeuralHire via n8n

## Objetivo

Este fluxo recebe eventos da Evolution API no n8n e encaminha o payload bruto para o NeuralHire, que faz a persistência idempotente, o vínculo com cliente ou lead e a atualização da timeline.

O n8n fica como camada de entrada e observabilidade. O NeuralHire fica responsável pela regra de negócio.

## Eventos aceitos

Inicialmente, o fluxo deve considerar estes eventos da Evolution:

- `messages.upsert`
- `send.message`
- `messages.update`

O backend do NeuralHire, na Fase 11A-11C, processa de forma efetiva o evento `messages.upsert` e ignora os demais eventos sem quebrar o fluxo.

## Webhook do n8n

- Method: `POST`
- Path: `evolution-neuralhire`
- Response mode: `Immediately`

Quando publicado, a URL pública do webhook do n8n será algo como:

`https://<N8N_HOST>/webhook/evolution-neuralhire`

Se o ambiente usar a rota de teste do n8n, a URL pode variar para:

`https://<N8N_HOST>/webhook-test/evolution-neuralhire`

## Destino NeuralHire

`https://api.neuralhire.com.br/integrations/evolution/webhook`

## Headers necessários

Enviar sempre:

- `Content-Type: application/json`
- `x-account-id: <ACCOUNT_ID>` enquanto estivermos em homologação ou desenvolvimento

Se houver um segredo de webhook configurado no backend no futuro, ele deve ser documentado e aplicado aqui também. Nesta fase, o endpoint usa o `x-account-id` como identificação de tenant quando o ambiente permite fallback por header.

## Payload

O n8n deve reenviar o payload original recebido da Evolution sem transformação pesada.

Boas práticas:

- não normalizar campos de negócio no n8n
- não reestruturar o JSON além do necessário
- não remover campos úteis de depuração

Exemplo de encaminhamento:

```json
{
  "event": "messages.upsert",
  "data": {
    "message": {
      "key": {
        "id": "msg-001",
        "fromMe": false,
        "remoteJid": "5511999999999@s.whatsapp.net"
      },
      "message": {
        "conversation": "Olá"
      }
    }
  }
}
```

## Como testar mensagem inbound

1. Configure o webhook da Evolution ou um disparo manual no n8n para enviar um payload com `event = messages.upsert`.
2. Garanta que `fromMe = false`.
3. Verifique se o NeuralHire respondeu `200 OK`.
4. Confirme no backend que a mensagem foi persistida e vinculada ao cliente ou lead correto.

## Como testar mensagem outbound

1. Envie um payload com `event = messages.upsert`.
2. Garanta que `fromMe = true`.
3. Confirme se o NeuralHire classificou a mensagem como outbound e manteve a persistência idempotente.

## Troubleshooting

- `401` ou `403`: verifique se a instância do n8n está repassando os headers corretos e se o tenant está disponível.
- `400`: confirme se o payload continua JSON válido e se contém o `event` esperado.
- `account_id ausente`: em homologação/desenvolvimento o backend aceita `x-account-id`, mas em produção o tenant deve vir do contexto autenticado ou de outra origem validada.
- Evento ignorado: `send.message` e `messages.update` podem passar pelo n8n, mas o backend atual só processa `messages.upsert`.
- Duplicidade: o NeuralHire já aplica idempotência por `provider + message_id`, então reenvios controlados não devem gerar duplicação.
- Falha pontual no NeuralHire: o n8n deve registrar o erro e permitir retry manual/controlado, sem loop infinito.

