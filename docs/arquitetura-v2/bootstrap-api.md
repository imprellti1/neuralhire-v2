# Bootstrap API v2

## Objetivo da etapa
Fortalecer a base tecnica da API NeuralHire v2 com validacao de ambiente, roteamento modular, tratamento padrao de erros e observabilidade inicial.

## Arquivos criados/atualizados
- config/env.schema.js e config/env.js
- core/http-status.js, core/errors.js, core/response.js
- core/request-context.js, core/router.js, core/async-handler.js
- core/logger.js
- database/supabase.client.js
- modules/health e modules/system
- modules/index.js, app.js e main.js

## Padrao config/env
- Esquema declarativo em `env.schema.js`.
- Defaults aplicados automaticamente.
- Validacoes de tipo, required e allowed.
- `getEnvSummary()` sem exposicao de secrets.

## Padrao requestId
- Cada request recebe `requestId` com `crypto.randomUUID()`.
- requestId entra no contexto, logs e resposta de erro.

## Healthcheck
- `GET /health` retorna status do servico e dependencias.
- Inclui status de configuracao Supabase sem teste de conexao.

## Supabase client
- `createSupabaseClient()` cria client somente quando URL + service role estiverem configurados.
- Caso incompleto, retorna `null` e registra `warn` estruturado.

## System info
- `GET /system/info` retorna metadados de arquitetura, modulos ativos e resumo de ambiente sem segredos.

## Proximos passos
- Introduzir camada de validacao de payload por modulo.
- Adicionar middlewares de autenticacao/autorizacao por contexto.
- Evoluir observabilidade com metricas e trilhas de auditoria.
