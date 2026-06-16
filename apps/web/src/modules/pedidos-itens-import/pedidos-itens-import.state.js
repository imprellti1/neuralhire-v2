export function createPedidosItensImportState() {
  return {
    file: null,
    fileName: '',
    pedidoErp: '',
    preview: null,
    result: null,
    importToken: '',
    loadingPreview: false,
    loadingImport: false,
    error: ''
  };
}
