# Produtos catalogo (v2)

## Estrutura do dominio

Modulo `produtos-catalogo` expoe:
- `GET /produtos`
- `GET /produtos/search`
- `GET /produtos/:id`
- `POST /produtos`

Todos com autenticacao, permissao e tenant obrigatorios.

## Tabela `public.produtos`

Campos principais:
- identificacao: `id`, `account_id`, `codigo`, `sku`
- catalogo: `nome`, `descricao`, `categoria`, `marca`, `ean`, `ncm`
- comercial: `preco`, `custo`, `estoque`, `unidade`, `ativo`
- apoio: `tags`, `metadata`, `created_at`, `updated_at`

## Multi-tenant + RLS

A tabela usa RLS por `account_id = current_account_id()` para `authenticated`.
`service_role` mantem acesso total para rotinas internas.

## Paginacao e filtros

`listProdutos` retorna:
- `items`, `total`, `page`, `limit`, `totalPages`

Defaults:
- `page = 1`
- `limit = 20`
- `max limit = 100`

Filtros:
- `search`
- `categoria`
- `marca`
- `ativo`

## Busca (`/produtos/search`)

Busca por:
- `nome`
- `sku`
- `codigo`
- `descricao`
- `categoria`
- `marca`

No fallback memory existe scoring simples com pesos para relevancia.
No Supabase usa `ilike` multi-campo.

## Busca HTTP

Suporte de query string:
- `/produtos/search?q=termo`
- `/produtos/search?search=termo`

No pipeline HTTP, os params sao disponibilizados em `context.query`.
O match de rota usa apenas `pathname`, entao query string nao interfere no roteamento.

## Proximos passos

1. Integrar com dominio de pedidos para validacao de SKU e preco em tempo real.
2. Alimentar catalogo inteligente para recomendacao comercial/IA.
3. Integrar WhatsApp IA e follow-up com busca contextual de produtos.
4. Criar trilha de sincronizacao B2B (ERP/fornecedores).