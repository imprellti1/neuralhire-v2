# Auditoria de Importacao Legado

Esta etapa adiciona rastreabilidade ao fluxo de importacao sem promover nenhum dado para as tabelas finais.

## Tabelas de staging

- `legacy_import_batches`
- `legacy_import_records`
- `legacy_import_issues`

## Fluxo

1. `POST /legacy-import/validate` cria um batch com status `validating`.
1. `POST /legacy-import/preview` cria um batch com status `normalized`.
1. `POST /legacy-import/execute` cria um batch com status `approved`.
1. Cada chamada persiste records e issues no staging.
1. A auditoria consulta lotes, records e issues sem promover dados.

## Consultas

- `GET /legacy-import/batches`
- `GET /legacy-import/batches/:batchId`
- `GET /legacy-import/batches/:batchId/records`
- `GET /legacy-import/batches/:batchId/issues`

## Regras

- accountId e isolamento por tenant continuam obrigatorios
- account_id do payload continua ignorado
- nenhum delete ou overwrite estrutural e nenhuma promocao para as tabelas finais
- a aprovacao futura deve partir dos batches auditaveis
