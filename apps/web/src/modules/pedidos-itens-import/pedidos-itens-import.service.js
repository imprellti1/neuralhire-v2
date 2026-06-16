async function asImportPayload(file) {
  if (!file) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  const fileName = String(file?.name || '').trim();
  if (!fileName.toLowerCase().endsWith('.xlsx')) {
    throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  }
  let binary = '';
  if (typeof file.arrayBuffer === 'function') {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  } else if (typeof file.text === 'function') {
    binary = await file.text();
  } else {
    binary = String(file?.buffer || file?.contents || file || '');
  }
  return {
    file: {
      fileName,
      base64: btoa(binary)
    }
  };
}

export function extractPedidoErpFromFileName(fileName = '') {
  const match = String(fileName || '').trim().match(/(\d{3,})/);
  return match ? match[1] : '';
}

export async function buildPreviewPayload(file) {
  return asImportPayload(file);
}

export async function previewPedidosItensImport(apiClient, body) {
  return apiClient.post('/pedidos/itens/importacao/preview', body);
}

export async function executePedidosItensImport(apiClient, body) {
  return apiClient.post('/pedidos/itens/importacao', body);
}
