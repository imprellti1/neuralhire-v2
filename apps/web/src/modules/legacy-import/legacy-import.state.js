export function createLegacyImportState() {
  return {
    loading: false,
    error: null,
    status: null,
    batches: [],
    selectedBatchId: null,
    selectedBatch: null,
    batchRecords: [],
    batchIssues: [],
    batchAudit: null,
    batchReport: null,
    payloadText: '{\n  "source": "legacy-admin",\n  "dryRun": true,\n  "data": {\n    "clientes": [],\n    "produtos": [],\n    "pedidos": [],\n    "pedidoItens": [],\n    "fabricantes": [],\n    "vendedores": []\n  }\n}',
    result: null
  };
}
