# Auditoria de Repositório/Git — NeuralHire v2 (ETAPA 52)

## Escopo da auditoria

- Diretório utilizado nas etapas: `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\NEURAL HIRE`
- Tipo de auditoria: somente leitura (sem alterações estruturais em Git)
- Data da auditoria: 2026-06-01

## Evidências coletadas

### 1) Resultado em `NEURAL HIRE`

Comando: `git rev-parse --show-toplevel`  
Resultado: `fatal: not a git repository (or any of the parent directories): .git`

Comando: `git status`  
Resultado: `fatal: not a git repository (or any of the parent directories): .git`

### 2) Busca de diretórios `.git` em `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO`

Comando:

```powershell
Get-ChildItem -Path "C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO" -Force -Directory -Recurse -Filter ".git" -ErrorAction SilentlyContinue
```

Resultados encontrados:

- `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\Projeto Representantes\.git`
- `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\Projeto Representantes\admin-app\.git`
- `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\Projeto Representantes\site-institucional\.git`

### 3) Verificação pontual de `.git`

- `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\NEURAL HIRE\.git` -> **MISSING**
- `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\.git` -> **MISSING**

## Raiz Git detectada

- Para o diretório `NEURAL HIRE`, **nenhuma raiz Git foi detectada** no estado local atual.
- Portanto, não foi possível executar com sucesso (nesse diretório) os comandos:
  - `git remote -v`
  - `git branch --show-current`
  - `git log --oneline -5`

## Localização real do monorepo (arquivos/pastas)

Foi confirmado que estes caminhos existem em disco dentro de `NEURAL HIRE`:

- `package.json` raiz
- `apps/web`
- `apps/api`
- `.github/workflows/quality.yml`
- `docs/qualidade`
- `docs/deploy`

## Workflow `quality.yml` e raiz Git

- O arquivo `.github/workflows/quality.yml` existe em:
  - `C:\Users\Meu Computador\Meu Drive\PROGRAMAÇÃO\NEURAL HIRE\.github\workflows\quality.yml`
- Porém, como **não há repositório Git detectado em `NEURAL HIRE`**, atualmente esse workflow está **fora de uma raiz Git versionada localmente**.

## Riscos identificados

- Sem raiz Git válida no projeto, alterações não entram em histórico versionado localmente.
- O GitHub Actions não terá como executar esse workflow a partir deste estado local até que o projeto esteja conectado a um repositório Git correto.
- Pode haver falsa sensação de cobertura CI local, sem rastreabilidade de branch/commit remoto.

## Comandos seguros de diagnóstico (somente leitura)

Executar no diretório candidato a raiz do projeto:

```bash
git status
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git log --oneline -5
```

## Comandos destrutivos que NÃO devem ser executados sem confirmação explícita

- `git reset --hard`
- `git clean -fd`
- `git push --force`
- remoção manual de `.git`

## Conclusão

No estado auditado em 2026-06-01, `NEURAL HIRE` possui estrutura de monorepo e workflow em disco, porém sem raiz Git detectável localmente. A priorização recomendada é identificar a origem correta do repositório versionado desse projeto antes de qualquer operação de deploy/versionamento.
