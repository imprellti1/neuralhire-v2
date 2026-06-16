export function createPedidosItensImportState() {
  return {
    file: null,
    fileName: '',
    pedidoErp: '',
    preview: null,
    result: null,
    loadingPreview: false,
    loadingImport: false,
    error: ''
  };
}
