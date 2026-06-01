# Fluxo PR -> CI -> Merge -> Deploy — NeuralHire v2

## Objetivo

Padronizar o fluxo operacional para que toda mudança passe por validação de qualidade antes de merge na `main` e liberação de deploy.

## Fluxo recomendado

1. Criar branch de feature a partir da `main`:
   - `feature/etapa-xx-descricao`
2. Executar validação local antes de subir mudanças:
   - `npm.cmd run quality`
3. Abrir PR com destino para `main`.
4. Aguardar o workflow `Quality` finalizar.
5. Realizar merge somente com CI verde e revisão concluída.
6. Após merge em `main`, liberar deploy conforme processo do time.

## Regra de decisão para merge/deploy

- Sem `Quality` verde, não fazer merge.
- Sem merge em `main`, não liberar deploy.

## Diagnóstico e rollback básico quando CI falhar

1. Abrir a execução com falha em `Actions` no GitHub.
2. Identificar a etapa quebrada no job `quality`.
3. Reproduzir localmente com `npm.cmd run quality`.
4. Corrigir na branch de feature e atualizar o PR.
5. Se falha ocorrer após merge excepcional, reverter o commit em `main` e bloquear deploy até novo verde.

## Referências cruzadas

- Proteção de branch: [branch-protection.md](./branch-protection.md)
- Workflow de CI: [github-actions.md](./github-actions.md)
- Pipeline local: [pipeline-local.md](./pipeline-local.md)
- Preparação de deploy real: [../deploy/preparacao-deploy-real.md](../deploy/preparacao-deploy-real.md)
- Configuração de produção: [../deploy/configuracao-producao.md](../deploy/configuracao-producao.md)
- Inventário de variáveis de produção: [../deploy/inventario-variaveis-producao.md](../deploy/inventario-variaveis-producao.md)
- Variáveis de ambiente de deploy: [../deploy/variaveis-ambiente.md](../deploy/variaveis-ambiente.md)
- Checklist Supabase production: [../deploy/supabase-production-checklist.md](../deploy/supabase-production-checklist.md)
- Checklist pré-deploy: [../deploy/checklist-pre-deploy.md](../deploy/checklist-pre-deploy.md)
- Checklist pós-deploy: [../deploy/checklist-pos-deploy.md](../deploy/checklist-pos-deploy.md)
