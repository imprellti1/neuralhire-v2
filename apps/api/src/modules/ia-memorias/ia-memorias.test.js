import assert from 'node:assert/strict';
import { createIaMemoria, deleteIaMemoria, getIaMemoriaById, listIaMemorias, searchIaMemorias, updateIaMemoria, __resetIaMemoriasForTests, __setIaMemoriasDatabaseForTests } from './ia-memorias.repository.js';

function createFakeDatabase() {
  const rows = [];
  const calls = [];

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const compact = (sql) => String(sql || '').trim().replace(/\s+/g, ' ');

  function matchWhere(row, sql, params) {
    sql = compact(sql);
    if (!sql.includes('FROM ia_memorias WHERE')) return true;
    if (row.account_id !== params[0]) return false;
    if (sql.includes('tipo = $2') && row.tipo !== params[1]) return false;
    if (sql.includes('modulo = $3') || sql.includes('modulo = $2')) {
      const moduloParam = sql.includes('tipo = $2') ? params[2] : params[1];
      if ((row.modulo || null) !== moduloParam) return false;
    }
    if (sql.includes('= ANY(tags)')) {
      const tagParam = params.find((value) => typeof value === 'string' && !String(value).includes('%') && value !== params[0] && value !== params[1]);
      if (!(row.tags || []).includes(tagParam)) return false;
    }
    if (sql.includes('status =')) {
      const statusParam = params.find((value) => value === 'ativa' || value === 'arquivada');
      if (row.status !== statusParam) return false;
    }
    if (sql.includes('ILIKE')) {
      const searchParam = params.find((value) => typeof value === 'string' && String(value).includes('%'));
      const q = String(searchParam || '').replace(/%/g, '').toLowerCase();
      const hay = [row.titulo, row.conteudo, row.modulo].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  const adapter = {
    async one(sql, params = []) {
      sql = compact(sql);
      calls.push(['one', sql, params]);
      if (sql.startsWith('SELECT COUNT(*)')) {
        const filtered = rows.filter((row) => matchWhere(row, sql, params));
        return { total: filtered.length };
      }
      if (sql.startsWith('SELECT * FROM ia_memorias')) {
        const filtered = rows.filter((row) => matchWhere(row, sql, params));
        if (!filtered.length) return null;
        if (filtered.length > 1 && sql.includes('LIMIT 1')) return filtered[0];
        return clone(filtered[0]);
      }
      if (sql.startsWith('INSERT INTO ia_memorias')) {
        const row = {
          id: params[0],
          account_id: params[1],
          tipo: params[2],
          titulo: params[3],
          conteudo: params[4],
          tags: params[5],
          prioridade: params[6],
          origem: params[7],
          modulo: params[8],
          status: params[9],
          metadata: params[10],
          created_at: params[11],
          updated_at: params[12]
        };
        rows.push(row);
        return clone(row);
      }
      if (sql.startsWith('UPDATE ia_memorias SET')) {
        const idx = rows.findIndex((row) => row.account_id === params[0] && row.id === params[1]);
        if (idx < 0) return null;
        const next = { ...rows[idx] };
        const setBits = sql.split(' SET ')[1].split(' WHERE ')[0].split(', ');
        setBits.forEach((bit, bitIndex) => {
          const column = bit.split(' = ')[0];
          next[column] = params[bitIndex + 2];
        });
        rows[idx] = next;
        return clone(next);
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
    async many(sql, params = []) {
      sql = compact(sql);
      calls.push(['many', sql, params]);
      const filtered = rows.filter((row) => matchWhere(row, sql, params));
      filtered.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      const limit = params[params.length - 2];
      const offset = params[params.length - 1];
      return clone(filtered.slice(offset, offset + limit));
    },
    async query(sql, params = []) {
      calls.push(['query', sql, params]);
      return [];
    },
    async execute(sql, params = []) {
      calls.push(['execute', sql, params]);
      return { rowCount: 0, rows: [] };
    },
    async transaction(callback) {
      calls.push(['transaction']);
      return callback(this);
    }
  };

  return { adapter, rows, calls };
}

export function getIaMemoriasTests() {
  return [
    {
      name: 'ia memorias database adapter basics',
      run: async () => {
        __resetIaMemoriasForTests();
        const fake = createFakeDatabase();
        __setIaMemoriasDatabaseForTests(fake.adapter);

        const a = await createIaMemoria({ tipo: 'regra_negocio', titulo: 'Regra', conteudo: 'x', account_id: 'evil', tags: ['a'] }, { accountId: 'acc-1' });
        assert.equal(a.account_id, 'acc-1');
        assert.equal(fake.rows.length, 1);

        const b = await createIaMemoria({ tipo: 'bug_corrigido', titulo: 'Bug', conteudo: 'conteudo', modulo: 'web', tags: ['tag-1'] }, { accountId: 'acc-2' });
        assert.equal(b.modulo, 'web');
        assert.equal(fake.rows.length, 2);

        const listed = await listIaMemorias({}, { accountId: 'acc-1' });
        assert.equal(listed.items.length, 1);
        assert.equal(listed.total, 1);

        const search = await searchIaMemorias({ search: 'regra' }, { accountId: 'acc-1' });
        assert.equal(search.items.length, 1);

        const found = await getIaMemoriaById(a.id, { accountId: 'acc-1' });
        assert.equal(found.id, a.id);

        const updated = await updateIaMemoria(b.id, { status: 'arquivada', titulo: 'Bug atualizado' }, { accountId: 'acc-2' });
        assert.equal(updated.status, 'arquivada');
        assert.equal(updated.titulo, 'Bug atualizado');

        await deleteIaMemoria(a.id, { accountId: 'acc-1' });
        const afterDelete = await listIaMemorias({}, { accountId: 'acc-1' });
        assert.equal(afterDelete.items.length, 0);

        const archived = await listIaMemorias({ status: 'arquivada' }, { accountId: 'acc-2' });
        assert.equal(archived.items.length, 1);
      }
    },
    {
      name: 'ia memorias respeita filtros e paginação',
      run: async () => {
        __resetIaMemoriasForTests();
        const fake = createFakeDatabase();
        __setIaMemoriasDatabaseForTests(fake.adapter);

        await createIaMemoria({ tipo: 'regra_negocio', titulo: 'Alpha', conteudo: 'um', modulo: 'crm', tags: ['x'] }, { accountId: 'acc-1' });
        await createIaMemoria({ tipo: 'observacao', titulo: 'Beta', conteudo: 'dois', modulo: 'erp', tags: ['y'] }, { accountId: 'acc-1' });
        await createIaMemoria({ tipo: 'observacao', titulo: 'Gamma', conteudo: 'tres', modulo: 'crm', tags: ['x'] }, { accountId: 'acc-1' });

        const byModulo = await listIaMemorias({ modulo: 'crm', tag: 'x' }, { accountId: 'acc-1' });
        assert.equal(byModulo.items.length, 2);

        const paged = await listIaMemorias({ limit: 1, page: 2 }, { accountId: 'acc-1' });
        assert.equal(paged.items.length, 1);
      }
    },
    {
      name: 'ia memorias propaga erro do banco',
      run: async () => {
        __resetIaMemoriasForTests();
        __setIaMemoriasDatabaseForTests({
          async one() {
            const error = new Error('db down');
            error.code = 'DATABASE_ERROR';
            throw error;
          },
          async many() { return []; }
        });

        let caught = null;
        try {
          await createIaMemoria({ tipo: 'regra_negocio', titulo: 'R', conteudo: 'C' }, { accountId: 'acc-1' });
        } catch (error) {
          caught = error;
        }
        assert(caught, 'deve lançar erro');
        assert.equal(caught.code, 'DATABASE_ERROR');
      }
    }
  ];
}
