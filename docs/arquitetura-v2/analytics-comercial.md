# Analytics Comercial v2

Camada inicial de BI operacional para NeuralHire v2 com foco comercial.

## Escopo
- Sumario comercial: pedidos, faturamento, ticket medio e distribuicao por status.
- Ranking de produtos por total vendido.
- Ranking de clientes por total comprado e ticket medio.
- Timeline diaria de vendas.

## Arquitetura
- Modulo: `apps/api/src/modules/analytics`.
- Controller fino: recebe filtros e account_id do contexto.
- Repository: executa agregacoes em memoria (fallback) e Supabase (select + agregacao JS).
- Rotas protegidas por RBAC e tenant obrigatorio.

## Multi-tenant e RLS
- Todas consultas usam `account_id` do contexto autenticado.
- Nenhuma metrica cruza dados entre tenants.
- Em Supabase, consultas sao sempre filtradas por `account_id`, mantendo compatibilidade com RLS.

## Agregacoes
- Summary:
  - `totalPedidos`
  - `totalFaturado`
  - `ticketMedio`
  - `pedidosPorStatus` (rascunho, enviado, aprovado, faturado, cancelado)
  - `totalClientesAtivos`
  - `totalProdutosAtivos`
- Products ranking:
  - `produto_id`, `produto_nome`, `quantidadeVendida`, `totalVendido`, `pedidos`
- Customers ranking:
  - `cliente_id`, `cliente_nome`, `pedidos`, `totalComprado`, `ticketMedio`
- Timeline:
  - agregacao diaria por `date`, `pedidos`, `total`

## Preparacao futura
- IA comercial para insight e recomendacao de follow-up.
- Previsao operacional e sazonalidade.
- Ranking de representantes/vendedores.
- Dashboards executivos e operacionais.
- Insights automaticos e automacoes orientadas por evento.
