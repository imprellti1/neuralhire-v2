# Variáveis de Ambiente — NeuralHire v2

## Diretrizes gerais

- Nunca versionar secrets reais no repositório.
- Armazenar segredos apenas em cofre/secret manager ou variáveis protegidas da plataforma.
- Usar placeholders em documentação e exemplos.
- Em GitHub Actions com `environment`, secrets do ambiente só ficam disponíveis para jobs que referenciam esse `environment`.

## Matriz de variáveis

| Variável | Escopo | Obrigatória? | Descrição | Exemplo seguro/placeholder | Observações |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | backend/API | Sim | Define modo de execução da API | `production` | Em local pode ser `development`. |
| `PORT` | backend/API | Sim | Porta HTTP da API | `3000` | Ajustar conforme provedor. |
| `JWT_SECRET` | backend/API | Sim | Segredo para assinatura/validação de tokens | `<JWT_SECRET>` | Não expor em logs nem no código. |
| `SUPABASE_URL` | backend/API, Supabase | Sim | URL do projeto Supabase | `<SUPABASE_URL>` | Deve apontar ao ambiente correto. |
| `SUPABASE_ANON_KEY` | frontend/web, Supabase | Sim | Chave pública para consumo seguro no frontend | `<SUPABASE_ANON_KEY>` | Ainda sensível operacionalmente; evitar exposição desnecessária. |
| `SUPABASE_SERVICE_ROLE_KEY` | backend/API, Supabase | Sim (backend) | Chave privilegiada para operações server-side | `<SUPABASE_SERVICE_ROLE_KEY>` | Nunca enviar ao frontend. |
| `API_BASE_URL` | frontend/web | Sim | URL base da API consumida pelo frontend | `<API_BASE_URL>` | Em produção, usar domínio HTTPS oficial. |
| `CORS_ALLOWED_ORIGINS` | backend/API | Recomendado | Lista de origens permitidas no CORS | `https://app.exemplo.com` | Restringir ao mínimo necessário. |
| `QUALITY_REQUIRED` | CI/GitHub Actions | Opcional | Flag documental para políticas internas de qualidade | `true` | Política operacional, não substitui branch protection. |
| `GITHUB_TOKEN` | CI/GitHub Actions | Automático | Token padrão para ações do repositório | `<AUTO_BY_GITHUB>` | Fornecido pelo GitHub Actions em runtime. |
| `DEPLOY_TARGET` | deploy/hospedagem | Opcional (futuro) | Identificador do ambiente de deploy manual | `production` | Útil para runbook e scripts futuros. |
| `DEPLOY_APPROVER` | deploy/hospedagem | Opcional (futuro) | Responsável por aprovação manual de deploy | `<NOME_OU_ID>` | Controle processual/auditoria. |

## Boas práticas

- Separar variáveis por ambiente (`local`, `staging`, `production`).
- Rotacionar segredos periodicamente.
- Revisar permissões mínimas no Supabase e no provedor.
- Validar placeholders e documentação em PR antes de qualquer publicação real.

## Referências cruzadas

- Configuração de produção: [configuracao-producao.md](./configuracao-producao.md)
- Inventário final de produção: [inventario-variaveis-producao.md](./inventario-variaveis-producao.md)
- Checklist Supabase production: [supabase-production-checklist.md](./supabase-production-checklist.md)
- Preparação de deploy: [preparacao-deploy-real.md](./preparacao-deploy-real.md)
- Checklist pré-deploy: [checklist-pre-deploy.md](./checklist-pre-deploy.md)
- Checklist pós-deploy: [checklist-pos-deploy.md](./checklist-pos-deploy.md)
