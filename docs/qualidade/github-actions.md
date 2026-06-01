# GitHub Actions — Quality

## O que o workflow valida

O workflow `Quality` executa o pipeline de qualidade do monorepo com `npm run quality`, cobrindo as validações já existentes de backend, frontend, mocks, snapshots, contratos de payload e campos sensíveis.

## Quando ele roda

- `pull_request`
- `push` para branches principais:
  - `main`
  - `master`

## Diferença entre local e CI

- Local (Windows): `npm.cmd run quality`
- CI (Linux/GitHub Actions): `npm run quality`

No CI o ambiente é Ubuntu com Node.js 20 e cache de dependências npm.

## Instalação de dependências no workflow

O workflow tenta `npm ci` quando existe `package-lock.json` e faz fallback para `npm install` se necessário, mantendo compatibilidade com a estrutura atual do monorepo.

## Como investigar falhas no GitHub Actions

1. Abra a aba **Actions** no repositório GitHub.
2. Entre na execução do workflow **Quality** com falha.
3. Expanda o job `quality` e identifique a etapa que quebrou (instalação, check ou testes).
4. Leia o log completo da etapa para localizar o teste/arquivo afetado.
5. Reproduza localmente com `npm.cmd run quality` (ou comandos individuais) para corrigir antes de novo push.

## Referências cruzadas

- Política de proteção de branch: [branch-protection.md](./branch-protection.md)
- Fluxo operacional PR/CI/Merge/Deploy: [fluxo-pr-deploy.md](./fluxo-pr-deploy.md)
- Pipeline local: [pipeline-local.md](./pipeline-local.md)

- Deploy manual (runbook): [../deploy/preparacao-deploy-real.md](../deploy/preparacao-deploy-real.md)
- Variáveis para ambientes: [../deploy/variaveis-ambiente.md](../deploy/variaveis-ambiente.md)

