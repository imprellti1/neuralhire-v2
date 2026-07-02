# BaseRepository

Esta etapa cria a infraestrutura base para migração incremental para PostgreSQL próprio, sem migrar módulos existentes.

## Como criar novos repositories

1. Receba o `database adapter` por composição.
2. Estenda `BaseRepository`.
3. Use sempre SQL parametrizado.
4. Prefira os helpers de `BaseRepository` e `SqlBuilder` para evitar montagem manual repetida.

Exemplo:

```js
import { BaseRepository } from '../../database/base.repository.js';

export class CustomersRepository extends BaseRepository {
  async listByAccount(accountId) {
    const where = this.appendWhere();
    where.appendEquals('account_id', accountId);
    const clause = where.toWhereClause();
    return this.many(`SELECT * FROM customers ${clause.sql}`, clause.params);
  }
}
```

## Como usar o SQL Builder

- `appendCondition(...)` adiciona condições na ordem em que forem chamadas.
- `appendEquals(...)` gera `column = $n`.
- `appendLike(...)` gera `column ILIKE $n`.
- `appendIn(...)` gera `column IN ($n, $n+1, ...)`.
- `appendIsNull(...)` gera `column IS NULL`.
- `appendPagination(...)` gera `LIMIT $n OFFSET $n`.
- `appendOrder(...)` gera `ORDER BY column ASC|DESC`.

## Padrões obrigatórios

- Nunca concatenar valores externos diretamente no SQL.
- Sempre usar placeholders `$1`, `$2`, `$3` e assim por diante.
- Validar parâmetros antes de executar queries.
- Padronizar erros como `DatabaseError`.
- Registrar logs sem expor parâmetros.

## Exemplo com paginação

```js
const where = this.appendWhere();
where.appendEquals('account_id', accountId);
where.appendLike('name', `%${search}%`);

const pagination = this.appendPagination(limit, offset);

const sql = `
  SELECT *
  FROM customers
  ${where.toWhereClause().sql}
  ORDER BY created_at DESC
  ${pagination.sql}
`;

return this.many(sql, [...where.toWhereClause().params, ...pagination.params]);
```

## Escopo da fase

- Nenhum módulo foi migrado.
- Nenhuma rota foi alterada.
- Nenhum comportamento foi alterado.
- Supabase continua ativo nesta fase.
