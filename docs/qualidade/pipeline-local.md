# Pipeline local de qualidade — NeuralHire v2

## Comandos disponíveis

- `npm.cmd run check`: validação estática/sintática dos workspaces que possuem script `check`.
- `npm.cmd run test:web`: executa os testes do frontend (mappers, DOM, integração, segurança e helpers de infraestrutura).
- `npm.cmd run test:api`: executa a suíte da API.
- `npm.cmd run test:all`: execução agregada de testes de API e Web.
- `npm.cmd run quality`: pipeline local completo em sequência (`check` -> `test:web` -> `test:api` -> `test:all`).

## Quando usar cada comando

- Use `check` durante desenvolvimento para feedback rápido de integridade de código.
- Use `test:web` ao alterar frontend, rotas de tela, mapeamentos, segurança de payload e comportamento de UI.
- Use `test:api` ao alterar comportamento de API, regras de negócio e fluxo de backend.
- Use `test:all` para uma verificação consolidada de regressão.
- Use `quality` antes de abrir PR ou realizar commit crítico.

## Ordem recomendada antes de commit

1. `npm.cmd run check`
2. `npm.cmd run test:web`
3. `npm.cmd run test:api`
4. `npm.cmd run test:all`

Como alternativa única, execute:

- `npm.cmd run quality`

## CI com GitHub Actions

Existe também o workflow [Quality](./github-actions.md) em `.github/workflows/quality.yml`, executado em `push`/`pull_request` para bloquear regressões antes de merge/deploy.

No CI (Linux) os comandos usam `npm run ...`; localmente (Windows) mantemos `npm.cmd run ...`.

## Cobertura validada no pipeline

O pipeline valida backend, frontend, mocks, snapshots e contratos por meio das suítes já existentes do projeto.

## Segurança de payload no frontend

Não deve haver envio de campos sensíveis no frontend, incluindo:

- `account_id`
- `accountId`
- `tenant_id`
- `tenantId`
- `owner_user_id`
- `ownerUserId`
- `Authorization`
- `Bearer`
- `token`

## Referências cruzadas

- Proteção de branch: [branch-protection.md](./branch-protection.md)
- Fluxo operacional PR/CI/Merge/Deploy: [fluxo-pr-deploy.md](./fluxo-pr-deploy.md)
- Workflow no GitHub: [github-actions.md](./github-actions.md)
