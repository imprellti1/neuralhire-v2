# WhatsApp Customer Memory

## Contexto da conversa

O inbox de WhatsApp passa a carregar o contexto comercial do cliente ao abrir uma conversa. A tela combina:

- lista de conversas
- mensagens da conversa
- memória comercial do cliente vinculado

## Integração com a memória

O endpoint `GET /whatsapp/conversations/:conversationId/context` resolve:

- conversa
- cliente vinculado
- memória persistida, quando existir
- rebuild automático, quando não houver memória salva

Se a conversa não estiver vinculada a um cliente, o retorno vem vazio para a camada comercial.

## Rebuild

O botão `Recalcular Memória` chama `POST /customer-memory/:clienteId/rebuild` e atualiza o painel lateral.

## Limitações atuais

- Esta etapa não envia mensagens.
- Esta etapa não integra Evolution API.
- Esta etapa não usa OpenAI.
- A memória exibida é exclusivamente comercial.

## Preparação para o Message Draft Engine

Com a memória comercial disponível na inbox, a próxima etapa pode sugerir mensagens com base em:

- recorrência de compra
- risco comercial
- potencial do cliente
- produtos e fabricantes mais relevantes
