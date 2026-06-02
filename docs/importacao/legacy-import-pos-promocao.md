# Legacy Import Pós-Promoção

Este documento resume a etapa de auditoria pós-promoção do fluxo de importação legada.

## Auditoria

- `GET /legacy-import/batches/:batchId/audit`
- `GET /legacy-import/batches/:batchId/report`

## Integridade

- pedidos órfãos
- itens órfãos
- clientes ausentes
- produtos ausentes
- vendedores ausentes
- fabricantes ausentes

## Merge Seguro

- nunca sobrescrever campo válido com `null`
- nunca sobrescrever campo válido com vazio
- nunca sobrescrever preço válido com `0` vindo do legado
- preservar booleanos explícitos
- manter datas mais recentes

## Reconciliação

- pedido -> cliente
- item -> pedido
- item -> produto
- vendedor -> cliente
- fabricante -> produto

## Promoção

- records importados recebem `target_entity_id`
- records recebem `promotion_status`
- records recebem `promotion_notes`
- batch recebe `promotion_summary`
- batch recebe `promotion_report`
- batch recebe `last_audit_at`

## Troubleshooting

- se houver erros, reexecutar a auditoria e conferir o relatório
- se um pedido falhar, verificar o cliente vinculado
- se um item falhar, verificar pedido e produto
