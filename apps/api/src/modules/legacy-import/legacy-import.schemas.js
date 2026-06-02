export const supportedEntities = ['clientes', 'produtos', 'pedidos', 'pedidoItens', 'fabricantes', 'vendedores'];

export const legacyImportPayloadSchema = {
  source: { required: false, type: 'string', maxLength: 80 },
  dryRun: { required: false, type: 'boolean' },
  data: { required: false, type: 'object' }
};
