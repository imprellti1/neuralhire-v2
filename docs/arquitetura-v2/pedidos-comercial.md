# Pedidos comercial (v2)

## Arquitetura do dominio

Dominio `pedidos-comercial` com rotas:
- `GET /pedidos`
- `GET /pedidos/:id`
- `POST /pedidos`

Todos exigem autenticacao, permissao e tenant.

## Tabelas

- `public.pedidos`
- `public.pedido_itens`

Relacionamentos:
- pedido -> cliente (`cliente_id`)
- pedido_itens -> pedido (`pedido_id`)
- pedido_itens -> produto (`produto_id`)

## Calculo server-side

Totais sao sempre recalculados no servidor:
- `subtotal_item = quantidade * preco_unitario`
- `total_item = subtotal_item - desconto_item`
- `subtotal_pedido = soma subtotais itens`
- `total_pedido = soma totais itens - desconto_pedido`

Nao confiamos em totais enviados pelo cliente.

## Multi-tenant e RLS

Tabelas possuem `account_id` e RLS por `current_account_id()`.
`authenticated` acessa apenas seu tenant.
`service_role` tem acesso total para rotinas internas.

## Status e origem

Defaults:
- `status = rascunho`
- `origem = manual`

## Paginacao e filtros

`GET /pedidos` retorna `pagination`:
- `page` default 1
- `limit` default 20
- `limit` max 100

Filtros:
- `status`
- `cliente_id`

## Proximos passos

1. Integrar recomendacao IA por historico de pedidos.
2. Conectar fluxo de pedidos via WhatsApp.
3. Criar analytics comercial e pipeline operacional.
4. Automatizar follow-up pos-pedido.