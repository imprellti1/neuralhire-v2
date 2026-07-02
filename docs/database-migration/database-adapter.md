# Database Adapter

Esta fase adiciona uma camada nova de acesso ao PostgreSQL próprio, sem substituir nenhum repository existente.

## Objetivo

- Expor uma API pública mínima em `apps/api/src/database`.
- Usar `pg` com `DATABASE_URL`.
- Manter pool compartilhado e reutilizável.
- Normalizar erros do PostgreSQL em `DatabaseError`.
- Preparar a migração incremental dos repositories nas próximas fases.

## API pública

- `database.query(sql, params)`
- `database.one(sql, params)`
- `database.many(sql, params)`
- `database.execute(sql, params)`
- `database.transaction(async (tx) => {})`

## Comportamento

- O pool é singleton e criado de forma preguiçosa.
- As queries registram duração e quantidade de linhas.
- Parâmetros não são logados.
- A transação executa `BEGIN`, `COMMIT` e `ROLLBACK`.
- O objeto `tx` expõe `query` para executar comandos dentro da mesma conexão.

## Escopo desta fase

- Nenhuma rota foi alterada.
- Nenhum repository foi migrado.
- Supabase continua sendo o banco efetivamente usado pela aplicação nesta etapa.

