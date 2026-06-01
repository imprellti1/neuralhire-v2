# Configuração Real do Ambiente de Produção — NeuralHire v2

## Objetivo

Consolidar a configuração real do ambiente `production` para o NeuralHire v2 com controle operacional, validação obrigatória de qualidade e sem deploy automático nesta etapa.

## Ambiente alvo

- `production`

## Serviços envolvidos

- Backend/API: `apps/api`
- Frontend/Web: `apps/web`
- Banco de dados e autenticação: Supabase (produção)
- CI obrigatório: GitHub Actions (`Quality`)
- Hospedagem: futura/manual (provedor a definir)

## URLs finais (a definir antes do go-live)

- URL pública do frontend: `<FRONTEND_URL>`
- URL pública da API: `<API_BASE_URL>`
- URL do projeto Supabase: `<SUPABASE_URL>`
- URL de callback/auth (se aplicável): `<FRONTEND_URL>/auth/callback`

## Estratégia operacional

1. Deploy manual controlado.
2. CI obrigatório (`Quality`) antes de qualquer deploy.
3. Sem deploy automático nesta etapa.
4. Aprovação humana e registro operacional (responsável, horário, commit).

## Governança de produção

- Usar `environment` `production` no GitHub Actions para isolamento de secrets.
- Aplicar deployment protection rules (aprovação/review) quando o workflow de deploy existir.
- Liberar acesso a secrets apenas para jobs que referenciam explicitamente `production`.
- Manter `branch protection` na `main` com checks obrigatórios.

## Segurança de dados

- Supabase com RLS habilitado para tabelas multi-tenant.
- Policies baseadas em `account_id` e ownership por vendedor quando aplicável.
- `SUPABASE_SERVICE_ROLE_KEY` somente no backend/API.
- Frontend deve usar apenas `SUPABASE_ANON_KEY`.

## Fora do escopo desta etapa

- Não criar workflow de deploy automático.
- Não inserir secrets reais.
- Não alterar migrations, backend funcional, contratos de API ou ambiente Supabase real.

## Referências cruzadas

- Preparação de deploy: [preparacao-deploy-real.md](./preparacao-deploy-real.md)
- Inventário de variáveis de produção: [inventario-variaveis-producao.md](./inventario-variaveis-producao.md)
- Variáveis de ambiente (geral): [variaveis-ambiente.md](./variaveis-ambiente.md)
- Checklist pré-deploy: [checklist-pre-deploy.md](./checklist-pre-deploy.md)
- Checklist pós-deploy: [checklist-pos-deploy.md](./checklist-pos-deploy.md)
- Checklist Supabase production: [supabase-production-checklist.md](./supabase-production-checklist.md)
- Fluxo PR/CI/deploy: [../qualidade/fluxo-pr-deploy.md](../qualidade/fluxo-pr-deploy.md)
