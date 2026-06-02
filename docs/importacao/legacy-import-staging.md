# Legacy Import Staging

Esta etapa cria a camada de staging para receber dados do legado antes da promocao para as tabelas finais da v2.

## Objetivo

- registrar lotes de importacao
- armazenar linhas brutas por entidade
- guardar issues de validacao e normalizacao
- permitir auditoria por conta sem misturar tenants

## Fluxo

1. criar um batch em `legacy_import_batches`
2. inserir records brutos em `legacy_import_records`
3. registrar issues em `legacy_import_issues`
4. atualizar status do batch conforme validacao, normalizacao e aprovacao
5. promover os dados apenas em etapa futura

## Batches

- `pending`: lote criado e aguardando processamento
- `validating`: regras sendo aplicadas
- `normalized`: payload convertido para o formato interno
- `approved`: pronto para promocao
- `imported`: promovido com sucesso
- `failed`: erro terminal

## Records

- cada linha do legado vira um record
- o payload bruto fica em `raw_payload`
- o payload transformado fica em `normalized_payload`
- `issues_count` registra quantos problemas foram encontrados
- `target_entity_id` guarda a referencia da entidade final quando houver promocao

## Issues

- `info`, `warning` e `error` registram severidade
- a linha pode apontar para um record ou apenas para o batch
- `field`, `code` e `message` servem para auditoria e suporte

## Auditoria

- todo registro carrega `account_id`
- as policies de RLS filtram por tenant
- os indices facilitam busca por batch, account, status e chave natural

## Promocao futura

- esta etapa nao escreve em `clientes`, `produtos`, `pedidos` ou `pedido_itens`
- a promocao deve consumir os registros normalizados e mover apenas os aprovados
- qualquer migracao para as tabelas finais precisa preservar o historico de issues
