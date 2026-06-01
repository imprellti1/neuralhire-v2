# Preparação de Deploy Real — NeuralHire v2

## Objetivo

Definir um processo operacional seguro para deploy real do NeuralHire v2, garantindo validação técnica antes e depois da publicação, sem automação de deploy nesta etapa.

## Ambientes previstos

- `local`: desenvolvimento e validação local.
- `staging` (futuro, se aplicável): homologação antes de produção.
- `production`: ambiente real de uso.

## Serviços envolvidos

- Frontend: `apps/web`
- Backend/API: `apps/api`
- Banco e autenticação: Supabase
- CI: GitHub Actions (`Quality`)
- Hospedagem: provedor futuro (a definir)

## Fluxo esperado

1. Branch de feature (`feature/etapa-xx-descricao`).
2. PR para `main`.
3. CI `Quality` verde.
4. Merge em `main`.
5. Deploy manual controlado.
6. Validação pós-deploy com checklist.

## Controle operacional recomendado

- Manter `branch protection` na `main` com checks obrigatórios.
- Liberar deploy apenas com commit já validado no CI.
- Registrar quem executou deploy, horário e commit.
- Preparar rollback manual antes de cada publicação.

## Nota sobre GitHub Environments (referência)

Futuramente, podem ser usados ambientes do GitHub Actions como `development`, `staging` e `production` com regras de proteção e `environment secrets`. Segredo de ambiente só fica disponível para jobs que referenciam explicitamente o `environment`.

## Referências cruzadas

- Configuração de produção: [configuracao-producao.md](./configuracao-producao.md)
- Inventário de variáveis de produção: [inventario-variaveis-producao.md](./inventario-variaveis-producao.md)
- Checklist Supabase production: [supabase-production-checklist.md](./supabase-production-checklist.md)
- Variáveis de ambiente: [variaveis-ambiente.md](./variaveis-ambiente.md)
- Checklist pré-deploy: [checklist-pre-deploy.md](./checklist-pre-deploy.md)
- Checklist pós-deploy: [checklist-pos-deploy.md](./checklist-pos-deploy.md)
- Fluxo PR/CI/Merge: [../qualidade/fluxo-pr-deploy.md](../qualidade/fluxo-pr-deploy.md)
