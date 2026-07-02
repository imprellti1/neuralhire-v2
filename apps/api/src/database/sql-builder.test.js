import { assert, assertEqual, assertIncludes } from '../testing/assert.js';
import { buildLimitOffset, buildOrderBy, buildWhere, createSqlBuilder } from './sql-builder.js';
import { DatabaseError } from './database.errors.js';

export function getSqlBuilderTests() {
  return [
    {
      name: 'build where incremental com placeholders',
      run: async () => {
        const result = buildWhere((builder) => {
          builder.appendEquals('account_id', 'acc_1');
          builder.appendLike('name', '%ana%');
          builder.appendIn('status', ['active', 'pending']);
        });
        assertIncludes(result.sql, 'WHERE account_id = $1', 'deve criar primeira condicao');
        assertIncludes(result.sql, 'name ILIKE $2', 'deve criar like');
        assertIncludes(result.sql, 'status IN ($3, $4)', 'deve criar in');
        assertEqual(result.params.length, 4, 'deve manter params');
      }
    },
    {
      name: 'append pagination usa placeholders',
      run: async () => {
        const builder = createSqlBuilder();
        builder.appendPagination(10, 20);
        const result = builder.toWhereClause();
        assertIncludes(result.sql, 'LIMIT $1', 'deve usar limit parametrizado');
        assertIncludes(result.sql, 'OFFSET $2', 'deve usar offset parametrizado');
      }
    },
    {
      name: 'order by normaliza direcao',
      run: async () => {
        const result = buildOrderBy('created_at', 'desc');
        assertEqual(result.sql, 'ORDER BY created_at DESC', 'deve normalizar order');
      }
    },
    {
      name: 'limit offset helper retorna params',
      run: async () => {
        const result = buildLimitOffset(15, 30);
        assertIncludes(result.sql, 'LIMIT $1', 'limit deve existir');
        assertIncludes(result.sql, 'OFFSET $2', 'offset deve existir');
        assertEqual(result.params[0], 15, 'limit deve ser param');
        assertEqual(result.params[1], 30, 'offset deve ser param');
      }
    },
    {
      name: 'protege contra sql injection basico em lista',
      run: async () => {
        const result = buildWhere((builder) => {
          builder.appendEquals('name', "x' OR 1=1 --");
        });
        assertIncludes(result.sql, 'name = $1', 'valor deve ficar em placeholder');
        assertEqual(result.params[0], "x' OR 1=1 --", 'valor nao deve ser concatenado');
      }
    },
    {
      name: 'is null e erros de validacao',
      run: async () => {
        const builder = createSqlBuilder();
        builder.appendIsNull('deleted_at');
        assertIncludes(builder.toWhereClause().sql, 'deleted_at IS NULL', 'deve montar is null');
        let caught = null;
        try {
          buildWhere((b) => b.appendIn('status', []));
        } catch (error) {
          caught = error;
        }
        assert(caught instanceof DatabaseError, 'deve lançar databaseerror');
      }
    }
  ];
}
