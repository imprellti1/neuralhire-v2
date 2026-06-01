# Middlewares e Validacao

## Body parser
- `parseJsonBody(req)` processa somente `POST`, `PUT`, `PATCH`.
- Limite de 1MB por padrao.
- Erros: `INVALID_JSON` e `PAYLOAD_TOO_LARGE`.

## Validator
- `validatePayload(payload, schema)` valida `required`, `type`, `minLength`, `maxLength`, `allowed`.
- Em erro, retorna `ValidationError` com `details[]` por campo.

## Middlewares globais
- `corsMiddleware()`
- `securityHeadersMiddleware()`
- `authContextMiddleware()`

## Auth placeholder
- Sem validacao de token ainda.
- Preenche `context.auth` com `tokenPresent` e campos nulos de identidade.

## CORS
- Origem padrao `*`.
- Metodos e headers padrao configurados.
- `OPTIONS` encerra com `204`.

## Security headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `X-Request-Id` por request.

## Fluxo de request
1. Cria `requestContext`.
2. Executa middlewares globais.
3. Resolve rota + middlewares de rota.
4. Faz parse/validacao de body quando aplicavel.
5. Handler responde sucesso/erro padronizado.
