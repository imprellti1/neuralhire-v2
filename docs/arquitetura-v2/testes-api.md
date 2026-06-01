# Testes da API (Runner Nativo)

## Estrutura
- `src/testing/test-runner.js`: runner nativo com PASS/FAIL.
- `src/testing/assert.js`: asserts base.
- `src/testing/tests/*.test.js`: suites por responsabilidade.

## Como rodar
- `npm run test:api` (na raiz, via workspace script)

## Suites atuais
- Auth
- RBAC
- Validation
- Public Routes

## Cenarios cobertos
- Rotas protegidas sem token (401/AUTH_REQUIRED)
- Hierarquia de roles (403/FORBIDDEN_ROLE)
- Validacao de payload e JSON invalido
- Rotas publicas e not found

## Observacao
Sem Jest/Vitest nesta fase. Runner 100% Node nativo.
