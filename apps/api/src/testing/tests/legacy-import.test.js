import assert from 'node:assert/strict';
import { getLegacyImportBatchHandler, getLegacyImportBatchIssuesHandler, getLegacyImportBatchRecordsHandler, getLegacyImportStatusHandler, listLegacyImportBatchesHandler, previewLegacyImportHandler, validateLegacyImportHandler, executeLegacyImportHandler } from '../../modules/legacy-import/legacy-import.controller.js';
import { validateAndNormalizeLegacyPayload } from '../../modules/legacy-import/legacy-import.validator.js';
import { __resetLegacyImportStagingMemoryForTests } from '../../modules/legacy-import/legacy-import-staging.repository.js';

function createContext(overrides = {}) {
  return {
    auth: { authenticated: true, role: 'admin', accountId: 'acc-test-1', ...(overrides.auth || {}) },
    body: {},
    params: {},
    query: {},
    ...overrides
  };
}

const samplePayload = {
  source: 'legacy-admin',
  dryRun: true,
  data: {
    clientes: [{ nome: 'Cliente A', cnpj: '12.345.678/0001-90', uf: 'sp' }, { nome: 'Cliente A', cnpj: '12.345.678/0001-90' }],
    produtos: [{ nome: 'Produto A', sku: 'SKU-1', preco: '10' }],
    pedidos: [{ numero: 'PED-1', valor_total: '20', data_emissao: '2026-06-01' }],
    pedidoItens: [{ pedido_id: '1', sku: 'SKU-1', quantidade: 2, preco_unitario: 10 }],
    fabricantes: [{ nome: 'Fab A' }],
    vendedores: [{ nome: 'Vend A', email: 'v@a.com' }]
  }
};

export function getLegacyImportTests() {
  return [
    {
      name: 'status returns supported entities',
      run: async () => {
        const result = await getLegacyImportStatusHandler(createContext());
        assert.deepEqual(result.supportedEntities, ['clientes', 'produtos', 'pedidos', 'pedidoItens', 'fabricantes', 'vendedores']);
        assert.equal(result.stagingEnabled, true);
      }
    },
    {
      name: 'validate cria batch',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const result = await validateLegacyImportHandler(createContext({ body: samplePayload }));
        assert.ok(result.batchId);
        assert.equal(result.ok, false);
      }
    },
    {
      name: 'preview cria batch',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const result = await previewLegacyImportHandler(createContext({ body: samplePayload }));
        assert.ok(result.batchId);
        assert.equal(result.dryRun, true);
      }
    },
    {
      name: 'execute cria batch',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const result = await executeLegacyImportHandler(createContext({ body: { ...samplePayload, dryRun: false } }));
        assert.ok(result.batchId);
        assert.equal(result.dryRun, false);
      }
    },
    {
      name: 'validate returns issues by entity and normalizes values',
      run: async () => {
        const result = await validateLegacyImportHandler(createContext({ body: samplePayload }));
        assert.equal(result.ok, false);
        assert.equal(result.normalized.clientes[0].cnpj, '12345678000190');
        assert.equal(result.normalized.produtos[0].preco, 10);
        assert.equal(result.normalized.pedidos[0].numero, 'PED-1');
        assert.equal(result.normalized.pedidoItens[0].quantidade, 2);
        assert.ok(result.issues.some((issue) => issue.entity === 'clientes'));
      }
    },
    {
      name: 'validate helper detects duplicates',
      run: () => {
        const result = validateAndNormalizeLegacyPayload(samplePayload);
        assert.ok(result.issues.some((issue) => issue.code === 'DUPLICATE' && issue.entity === 'clientes'));
      }
    },
    {
      name: 'execute blocks dryRun true',
      run: async () => {
        const result = await executeLegacyImportHandler(createContext({ body: samplePayload }));
        assert.equal(result.dryRun, true);
        assert.ok(result.issues.some((issue) => issue.code === 'DRY_RUN'));
      }
    },
    {
      name: 'execute blocks production',
      run: async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
          await assert.rejects(() => executeLegacyImportHandler(createContext({ body: { ...samplePayload, dryRun: false } })));
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      }
    },
    {
      name: 'records persistidos e account isolation',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        const first = await executeLegacyImportHandler(createContext({ body: { ...samplePayload, dryRun: false, account_id: 'evil' } }));
        const second = await listLegacyImportBatchesHandler(createContext());
        assert.ok(second.batches.some((batch) => batch.id === first.batchId));
        const batch = await getLegacyImportBatchHandler(createContext({ params: { batchId: first.batchId } }));
        const records = await getLegacyImportBatchRecordsHandler(createContext({ params: { batchId: first.batchId } }));
        const issues = await getLegacyImportBatchIssuesHandler(createContext({ params: { batchId: first.batchId } }));
        assert.equal(batch.batch.status, 'approved');
        assert.ok(records.records.length > 0);
        assert.ok(Array.isArray(issues.issues));
      }
    },
    {
      name: 'preview and execute preserve account isolation',
      run: async () => {
        __resetLegacyImportStagingMemoryForTests();
        await validateLegacyImportHandler(createContext({ body: samplePayload }));
        await assert.rejects(() => getLegacyImportBatchHandler(createContext({ auth: { authenticated: true, role: 'admin', accountId: 'acc-other' }, params: { batchId: 'missing' } })));
      }
    },
    {
      name: 'does not break with partial payload',
      run: () => {
        const result = validateAndNormalizeLegacyPayload({});
        assert.ok(result.normalized.clientes);
      }
    }
  ];
}
