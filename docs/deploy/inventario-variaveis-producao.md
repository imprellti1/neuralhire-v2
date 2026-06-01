# Inventário de Variáveis Finais — Produção (NeuralHire v2)

## Regras

- Usar apenas placeholders seguros nesta documentação.
- Não registrar valores reais de secrets no repositório.

## Backend/API (`apps/api`)

| Variável | Placeholder | Observação |
| --- | --- | --- |
| `NODE_ENV` | `<NODE_ENV>` | Esperado: `production` no ambiente real. |
| `PORT` | `<PORT>` | Porta de execução da API no provedor. |
| `JWT_SECRET` | `<JWT_SECRET>` | Secret crítico, uso exclusivo server-side. |
| `SUPABASE_URL` | `<SUPABASE_URL>` | URL do projeto Supabase de produção. |
| `SUPABASE_SERVICE_ROLE_KEY` | `<SUPABASE_SERVICE_ROLE_KEY>` | Nunca expor ao frontend. |
| `FRONTEND_URL` | `<FRONTEND_URL>` | Base para CORS/callbacks quando aplicável. |

## Frontend/Web (`apps/web`)

| Variável | Placeholder | Observação |
| --- | --- | --- |
| `API_BASE_URL` | `<API_BASE_URL>` | Endpoint público da API em produção. |
| `SUPABASE_URL` | `<SUPABASE_URL>` | URL do projeto Supabase de produção. |
| `SUPABASE_ANON_KEY` | `<SUPABASE_ANON_KEY>` | Chave pública para cliente web. |
| `FRONTEND_URL` | `<FRONTEND_URL>` | URL pública final do frontend. |

## Supabase

| Variável | Placeholder | Observação |
| --- | --- | --- |
| `SUPABASE_URL` | `<SUPABASE_URL>` | Projeto alvo de produção. |
| `SUPABASE_ANON_KEY` | `<SUPABASE_ANON_KEY>` | Uso no frontend. |
| `SUPABASE_SERVICE_ROLE_KEY` | `<SUPABASE_SERVICE_ROLE_KEY>` | Uso em backend/processos administrativos. |

## GitHub Actions

| Variável | Placeholder | Observação |
| --- | --- | --- |
| `NODE_ENV` | `<NODE_ENV>` | Pode ser usada para jobs de release/deploy futuros. |
| `API_BASE_URL` | `<API_BASE_URL>` | Necessária apenas se jobs de validação externa exigirem. |
| `FRONTEND_URL` | `<FRONTEND_URL>` | Necessária apenas se houver smoke test web externo. |
| `SUPABASE_URL` | `<SUPABASE_URL>` | Usar somente quando estritamente necessário em job autorizado. |

## Hospedagem (futura/manual)

| Variável | Placeholder | Observação |
| --- | --- | --- |
| `NODE_ENV` | `<NODE_ENV>` | Valor esperado em produção: `production`. |
| `PORT` | `<PORT>` | Porta disponibilizada pelo provedor. |
| `API_BASE_URL` | `<API_BASE_URL>` | URL pública final da API. |
| `FRONTEND_URL` | `<FRONTEND_URL>` | URL pública final do frontend. |

## Referências cruzadas

- Configuração de produção: [configuracao-producao.md](./configuracao-producao.md)
- Variáveis de ambiente (geral): [variaveis-ambiente.md](./variaveis-ambiente.md)
- Checklist pré-deploy: [checklist-pre-deploy.md](./checklist-pre-deploy.md)
- Checklist Supabase production: [supabase-production-checklist.md](./supabase-production-checklist.md)
