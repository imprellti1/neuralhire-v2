# Padroes API v2

## Resposta de sucesso
Formato padrao:

```json
{
  "ok": true,
  "...payload"
}
```

## Resposta de erro
Formato padrao:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Rota nao encontrada",
    "domain": "core-platform",
    "details": {},
    "requestId": "uuid"
  }
}
```

## Dominios de erro
- core-platform
- autenticacao-contas
- usuarios-permissoes
- integracoes

## Logs estruturados
- JSON por linha
- Campos base: `level`, `message`, `timestamp`
- Metadados de request: `requestId`, `method`, `url`, `statusCode`, `durationMs`

## Rotas modulares
- Rotas registradas por modulo em `modules/*/*.routes.js`
- Composicao central em `modules/index.js`

## Diretriz arquitetural
- Nao usar `server.js` monolitico.
- Cada modulo em pasta propria com controller e routes.
- HTTP nativo Node.js enquanto a base tecnica amadurece.
