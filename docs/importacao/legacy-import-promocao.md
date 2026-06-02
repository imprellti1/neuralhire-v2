# Promoção Legacy Import para v2

## Objetivo

Promover lotes aprovados do staging para as tabelas oficiais da v2 com rastreabilidade, idempotência e isolamento por tenant.

## Pré-requisitos

- `batch.status === approved`
- `accountId` presente no contexto
- usuário com papel `manager`, `admin` ou `super_admin`
- sem issues de severity `error`

## Ordem de promoção

1. vendedores
2. fabricantes
3. clientes
4. produtos
5. pedidos
6. pedidoItens

## Regras

- não usar `account_id` do payload normalizado
- sempre usar `accountId` do contexto
- não promover registros `invalid`, `rejected` ou `skipped`
- pedidos órfãos devem falhar
- itens órfãos devem falhar

## Idempotência

- registros já importados e com `target_entity_id` não são duplicados
- lotes já importados retornam `BATCH_ALREADY_IMPORTED`

## Auditoria

- records recebem `imported`, `skipped` ou `failed`
- issues de erro são persistidas em `legacy_import_issues`
- o resumo do batch é atualizado ao final

## Limites atuais

- o promoter ainda depende do desenho atual dos repositórios oficiais
- o mapeamento de vendedores e fabricantes pode ser refinado nas próximas etapas

## Próximos passos

- expandir a resolução de vínculos legados
- reforçar a detecção de atualizações em todos os repositórios oficiais
