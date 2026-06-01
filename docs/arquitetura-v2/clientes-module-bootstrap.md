# Bootstrap clientes-crm

## Estrutura
- `clientes.schemas.js`
- `clientes.repository.js`
- `clientes.controller.js`
- `clientes.routes.js`
- `clientes.module.js`

## Fluxo
- `GET /clientes`: lista itens em memoria.
- `POST /clientes`: valida payload e cria item com `id` + `createdAt`.

## Permissoes
- `GET /clientes`: `clientes:read`
- `POST /clientes`: `clientes:write`

## Proximos passos
- Migrar repository em memoria para Supabase real.
- Adicionar filtros/paginacao no GET.
- Adicionar validacao semantica de documento/email.
