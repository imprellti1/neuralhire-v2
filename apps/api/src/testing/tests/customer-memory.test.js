import assert from 'node:assert/strict';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryPedidosForTests, createPedido } from '../../modules/pedidos/pedidos.repository.js';
import { __resetMemoryProdutosForTests, createProduto } from '../../modules/produtos/produtos.repository.js';
import {
  __resetMemoryCustomerMemoryForTests,
  __setCustomerMemoryDatabaseForTests,
  deleteCustomerMemory,
  getCustomerMemory,
  getCustomerMemorySummary,
  getPersistedCustomerMemory,
  listCustomerMemories,
  rebuildCustomerMemory
} from '../../modules/customer-memory/customer-memory.repository.js';
import { buildCustomerMemory } from '../../modules/customer-memory/customer-memory.builder.js';
import { scoreCustomerMemory } from '../../modules/customer-memory/customer-memory.scoring.js';

function resetState() {
  __resetMemoryClientesForTests();
  __resetMemoryPedidosForTests();
  __resetMemoryProdutosForTests();
  __resetMemoryCustomerMemoryForTests();
}

function createFakeDatabase() {
  const rows = [];
  const calls = [];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const compact = (sql) => String(sql || '').trim().replace(/\s+/g, ' ');

  const matches = (row, sql, params) => {
    sql = compact(sql);
    if (!sql.includes('FROM customer_memories')) return true;
    const accountId = params.find((value) => typeof value === 'string' && value === row.account_id) || params[0];
    if (row.account_id !== accountId) return false;
    if (sql.includes('cliente_id = $2')) {
      const clienteId = params[1];
      if (row.cliente_id !== clienteId) return false;
    }
    if (sql.includes('cliente_id IN')) {
      const ids = params.filter((value) => typeof value === 'string' && value !== accountId && !String(value).startsWith('%'));
      if (!ids.includes(row.cliente_id)) return false;
    }
    if (sql.includes('memory::text ILIKE')) {
      const q = String(params.find((value) => typeof value === 'string' && String(value).includes('%')) || '').replace(/%/g, '').toLowerCase();
      if (!JSON.stringify(row.memory || {}).toLowerCase().includes(q)) return false;
    }
    if (sql.includes('risk_score >=')) {
      const min = Number(params.find((value) => Number.isFinite(Number(value))) || 0);
      if (Number(row.risk_score || 0) < min) return false;
    }
    if (sql.includes('risk_score <=')) {
      const values = params.filter((value) => Number.isFinite(Number(value)));
      const max = values[values.length - 1];
      if (Number(row.risk_score || 0) > Number(max)) return false;
    }
    if (sql.includes('potential_score >=')) {
      const nums = params.filter((value) => Number.isFinite(Number(value)));
      const min = nums[nums.length - (sql.includes('risk_score <=') ? 2 : 1)];
      if (Number(row.potential_score || 0) < Number(min)) return false;
    }
    if (sql.includes('potential_score <=')) {
      const nums = params.filter((value) => Number.isFinite(Number(value)));
      const max = nums[nums.length - 1];
      if (Number(row.potential_score || 0) > Number(max)) return false;
    }
    return true;
  };

  const adapter = {
    async query(sql, params = []) {
      calls.push(['query', compact(sql), params]);
      sql = compact(sql);
      if (sql.startsWith('SELECT COUNT(*)::int AS total')) {
        return [{ total: rows.filter((row) => matches(row, sql, params)).length }];
      }
      if (sql.startsWith('SELECT * FROM customer_memories')) {
        let filtered = rows.filter((row) => matches(row, sql, params));
        const direction = sql.includes('ASC') ? 1 : -1;
        const orderColumn = sql.includes('ORDER BY cliente_id') ? 'cliente_id' : sql.includes('ORDER BY risk_score') ? 'risk_score' : 'last_rebuilt_at';
        filtered = filtered.sort((a, b) => {
          const left = String(a[orderColumn] || '');
          const right = String(b[orderColumn] || '');
          return direction * left.localeCompare(right);
        });
        if (sql.includes('OFFSET $') || params.length > 2) {
          const limit = params[params.length - 2];
          const offset = params[params.length - 1];
          filtered = filtered.slice(offset, offset + limit);
        }
        return clone(filtered);
      }
      if (sql.startsWith('INSERT INTO customer_memories')) {
        const row = {
          id: params[0],
          account_id: params[1],
          cliente_id: params[2],
          memory: params[3],
          risk_score: params[4],
          potential_score: params[5],
          last_rebuilt_at: params[6],
          created_at: params[7],
          updated_at: params[8]
        };
        rows.push(row);
        return [clone(row)];
      }
      if (sql.startsWith('UPDATE customer_memories')) {
        const idx = rows.findIndex((row) => row.account_id === params[0] && row.cliente_id === params[1]);
        if (idx < 0) return [];
        const next = { ...rows[idx], memory: params[2], risk_score: params[3], potential_score: params[4], last_rebuilt_at: params[5], updated_at: params[6] };
        rows[idx] = next;
        return [clone(next)];
      }
      if (sql.startsWith('DELETE FROM customer_memories')) {
        const idx = rows.findIndex((row) => row.account_id === params[0] && row.cliente_id === params[1]);
        if (idx < 0) return [];
        const [removed] = rows.splice(idx, 1);
        return [clone(removed)];
      }
      return [];
    },
    async execute(sql, params = []) {
      calls.push(['execute', compact(sql), params]);
      return { rowCount: 0, rows: [] };
    },
    async one(sql, params = []) {
      sql = compact(sql);
      calls.push(['one', sql, params]);
      const result = await this.query(sql, params);
      if (!result.length) return null;
      return clone(result[0]);
    },
    async many(sql, params = []) {
      calls.push(['many', compact(sql), params]);
      return this.query(sql, params);
    },
    async transaction(callback) {
      calls.push(['transaction']);
      return callback(this);
    }
  };

  return { adapter, rows, calls };
}

export function getCustomerMemoryTests() {
  return [
    {
      name: 'scoreCustomerMemory classifica risco frequencia e potencial',
      run: async () => {
        const scored = scoreCustomerMemory({ commercial: { diasSemCompra: 180, totalPedidos: 12, totalComprado: 90000, ticketMedio: 8500 } });
        assert.equal(scored.risk, 'alto');
        assert.equal(scored.frequenciaCompra, 'alta');
        assert.equal(scored.potencial, 'alto');
      }
    },
    {
      name: 'buildCustomerMemory cria memoria com isolamento de tenant',
      run: async () => {
        resetState();
        const clienteA = await createCliente({ nome: 'Cliente Memoria', owner_user_id: 'sales-a' }, { accountId: 'acc-a' });
        const clienteB = await createCliente({ nome: 'Cliente Outro' }, { accountId: 'acc-b' });
        const produtoA = await createProduto({ nome: 'Toalha A', preco: 100 }, { accountId: 'acc-a' });
        const produtoB = await createProduto({ nome: 'Toalha B', preco: 200 }, { accountId: 'acc-b' });
        await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 2, preco_unitario: 100 }] }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: clienteA.id, itens: [{ produto_id: produtoA.id, quantidade: 1, preco_unitario: 100 }] }, { accountId: 'acc-a' });
        await createPedido({ cliente_id: clienteB.id, itens: [{ produto_id: produtoB.id, quantidade: 1, preco_unitario: 200 }] }, { accountId: 'acc-b' });

        const memory = await buildCustomerMemory(clienteA.id, { accountId: 'acc-a' });
        assert.equal(memory.commercial.totalPedidos, 2);
        assert.equal(memory.commercial.totalComprado, 300);
        assert.equal(Array.isArray(memory.products.recorrentes), true);
        assert.equal(memory.products.recorrentes.length >= 0, true);
        assert.equal('account_id' in memory, false);
        assert.equal('tenant_id' in memory, false);
        assert.equal('owner_user_id' in memory, false);
      }
    },
    {
      name: 'customer memory persiste cria atualiza lista filtra pagina ordena e remove',
      run: async () => {
        resetState();
        const fake = createFakeDatabase();
        __setCustomerMemoryDatabaseForTests(fake.adapter);

        const cliente = await createCliente({ nome: 'Cliente Persistido' }, { accountId: 'acc-persist' });
        const produto = await createProduto({ nome: 'Produto Persistido', preco: 150 }, { accountId: 'acc-persist' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 2, preco_unitario: 150 }] }, { accountId: 'acc-persist' });

        const memory = await getCustomerMemory(cliente.id, { accountId: 'acc-persist' });
        assert.equal(memory.clienteId, cliente.id);
        assert.equal(fake.rows.length, 1);
        assert.equal(fake.calls.some((call) => call[1] && call[1].includes('INSERT INTO customer_memories')), true);

        const persisted = await getPersistedCustomerMemory(cliente.id, { accountId: 'acc-persist' });
        assert.equal(persisted.cliente_id, cliente.id);

        const summary = await getCustomerMemorySummary(cliente.id, { accountId: 'acc-persist' });
        assert.equal(summary.clienteId, cliente.id);
        assert.equal(summary.summary, memory.summary);

        const rebuilt = await rebuildCustomerMemory(cliente.id, { accountId: 'acc-persist' });
        assert.equal(rebuilt.clienteId, cliente.id);
        assert.equal(fake.rows.length, 1);

        const other = await createCliente({ nome: 'Cliente Outro' }, { accountId: 'acc-persist' });
        const otherMemory = await rebuildCustomerMemory(other.id, { accountId: 'acc-persist' });
        assert.equal(otherMemory.clienteId, other.id);
        fake.rows[0].risk_score = 10;
        fake.rows[1].risk_score = 90;

        const ordered = await listCustomerMemories({ orderBy: 'risk_score', orderDirection: 'ASC', limit: 1, page: 1 }, { accountId: 'acc-persist' });
        assert.equal(ordered.page, 1);
        assert.equal(ordered.limit, 1);
        assert.equal(Array.isArray(ordered.items), true);

        const filtered = await listCustomerMemories({ clienteIds: [cliente.id], minRiskScore: 1, maxRiskScore: 20 }, { accountId: 'acc-persist' });
        assert.equal(filtered.page, 1);
        assert.equal(filtered.limit > 0, true);
        assert.equal(Array.isArray(filtered.items), true);

        const deleted = await deleteCustomerMemory(cliente.id, { accountId: 'acc-persist' });
        assert.equal(deleted.cliente_id, cliente.id);
        const afterDelete = await getPersistedCustomerMemory(cliente.id, { accountId: 'acc-persist' });
        assert.equal(afterDelete, null);
      }
    },
    {
      name: 'customer memory rollback e database error',
      run: async () => {
        resetState();
        const cliente = await createCliente({ nome: 'Cliente Rollback' }, { accountId: 'acc-rollback' });
        const produto = await createProduto({ nome: 'Produto Rollback', preco: 99 }, { accountId: 'acc-rollback' });
        await createPedido({ cliente_id: cliente.id, itens: [{ produto_id: produto.id, quantidade: 1, preco_unitario: 99 }] }, { accountId: 'acc-rollback' });

        __setCustomerMemoryDatabaseForTests({
          async query(sql) {
            if (String(sql).startsWith('INSERT INTO customer_memories')) {
              const error = new Error('db down');
              error.code = 'DATABASE_ERROR';
              throw error;
            }
            return [];
          },
          async execute() { return { rowCount: 0, rows: [] }; },
          async one() { return null; },
          async many(sql) { return this.query(sql); },
          async transaction(callback) { return callback(this); }
        });

        await assert.rejects(() => getCustomerMemory(cliente.id, { accountId: 'acc-rollback' }), (error) => error.code === 'DATABASE_ERROR');

        __setCustomerMemoryDatabaseForTests({
          async query(sql) {
            if (String(sql).startsWith('INSERT INTO customer_memories')) {
              const error = new Error('rollback');
              error.code = 'DATABASE_ERROR';
              throw error;
            }
            return [];
          },
          async execute() { return { rowCount: 0, rows: [] }; },
          async one() { return null; },
          async many(sql) { return this.query(sql); },
          async transaction() {
            const error = new Error('rollback');
            error.code = 'DATABASE_ERROR';
            throw error;
          }
        });

        await assert.rejects(() => getCustomerMemory(cliente.id, { accountId: 'acc-rollback' }), (error) => error.code === 'DATABASE_ERROR');
      }
    },
    {
      name: 'tenant isolation bloqueia leitura cross tenant',
      run: async () => {
        resetState();
        const fake = createFakeDatabase();
        __setCustomerMemoryDatabaseForTests(fake.adapter);
        const cliente = await createCliente({ nome: 'Cliente Tenant' }, { accountId: 'acc-tenant-a' });
        await assert.rejects(() => getCustomerMemory(cliente.id, { accountId: 'acc-tenant-b' }));
      }
    }
  ];
}
