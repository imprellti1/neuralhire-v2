# Branch Protection — NeuralHire v2

## Objetivo

Proteger a branch `main` para garantir que apenas mudanças revisadas e validadas pelo CI sejam promovidas para merge e, depois, para deploy.

## Configuração recomendada no GitHub

1. Acesse `Settings` -> `Branches` -> `Branch protection rules`.
2. Clique em `Add rule`.
3. Defina `Branch name pattern`: `main`.
4. Habilite `Require a pull request before merging`.
5. Habilite `Require status checks to pass before merging`.
6. Em checks obrigatórios, selecione o check do workflow de qualidade:
   - `quality` (job/check atual do workflow `Quality`).
7. Habilite `Require branches to be up to date before merging`.
8. Se aplicável ao time, habilite `Restrict who can push to matching branches`.
9. Mantenha `Do not allow force pushes` habilitado.
10. Mantenha `Do not allow deletions` habilitado.

## Observação importante

Se o check não aparecer na lista de `Required status checks`, abra um PR ou faça um `push` para executar o workflow `Quality` pelo menos uma vez com sucesso no repositório.

## Referências cruzadas

- Fluxo operacional: [fluxo-pr-deploy.md](./fluxo-pr-deploy.md)
- Workflow de CI: [github-actions.md](./github-actions.md)
- Pipeline local: [pipeline-local.md](./pipeline-local.md)
