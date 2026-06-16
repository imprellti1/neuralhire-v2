import assert from 'node:assert/strict';
import test from 'node:test';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { renderPedidosItensImportPage } from './pedidos-itens-import.page.js';

function makeTestXlsxBlob(name = '11008.xlsx') {
  const blob = new Blob(['conteudo-xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  Object.defineProperty(blob, 'name', { value: name, configurable: true });
  return blob;
}

test('pedidos itens import page renders upload, preview, summary and import', async () => {
  const dom = setupFrontendDom('#/importacao-itens-pedido');
  const calls = [];
  const apiClient = {
    post: async (path, body) => {
      calls.push({ path, body });
      if (path === '/pedidos/itens/importacao/preview') {
        return {
          ok: true,
          importToken: 'token-itens',
          fileName: '11008.xlsx',
          pedidoErp: '11008',
          resumo: { total_linhas: 4, validas: 3, vinculadas: 2, nao_encontradas: 1, ambiguas: 1, erros: 1 },
          itens: [
            { codigo_erp: '1001', produto: 'Camisa', cor: 'Azul', tamanho: 'M', quantidade: 2, valor_unitario: 49.9, valor_total: 99.8, sku_esperado: 'SKU-1', status_vinculo: 'vinculado', motivo: 'OK' },
            { codigo_erp: '1002', produto: 'Calça', cor: 'Preto', tamanho: 'G', quantidade: 1, valor_unitario: 79.9, valor_total: 79.9, sku_esperado: 'SKU-2', status_vinculo: 'nao_encontrado', motivo: 'SKU não localizado' },
            { codigo_erp: '1003', produto: 'Tênis', cor: 'Branco', tamanho: '42', quantidade: 1, valor_unitario: 199.9, valor_total: 199.9, sku_esperado: 'SKU-3', status_vinculo: 'ambiguo', motivo: 'Mais de um SKU compatível' }
          ]
        };
      }
      return { ok: true, resumo: { importados: 2, vinculados: 2, nao_encontrados: 1, ambiguas: 1 } };
    }
  };

  await renderPedidosItensImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importação de Itens de Pedido/);
  assert.match(document.body.textContent, /Nenhum arquivo selecionado/);

  const fileInput = document.querySelector('[data-testid="file-input"]');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [fileBlob] });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /11008\.xlsx/);
  assert.match(document.body.textContent, /Pedido ERP: 11008/);

  document.querySelector('[data-testid="preview-button"]').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Total de linhas/);
  assert.match(document.body.textContent, /Vinculados/);
  assert.match(document.body.textContent, /Não encontrados/);
  assert.match(document.body.textContent, /Ambíguos/);
  assert.match(document.body.textContent, /SKU não localizado/);
  assert.match(document.body.textContent, /Mais de um SKU compatível/);
  assert.match(document.body.textContent, /Vinculado/);
  assert.match(document.body.textContent, /Não encontrado/);
  assert.match(document.body.textContent, /Ambíguo/);
  assert.equal(document.querySelector('[data-testid="import-button"]').disabled, false);

  const previewCall = calls.find((call) => call.path === '/pedidos/itens/importacao/preview');
  assert.equal(previewCall.body.file.fileName, '11008.xlsx');
  assert.ok(String(previewCall.body.file.base64 || '').length > 0);

  document.querySelector('[data-testid="import-button"]').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Importados/);
  assert.match(document.body.textContent, /Vinculados/);
  assert.match(document.body.textContent, /Não encontrados/);
  assert.match(document.body.textContent, /Ambíguos/);
  const importCall = calls.find((call) => call.path === '/pedidos/itens/importacao');
  assert.equal(importCall.body.importToken, 'token-itens');

  teardownFrontendDom(dom);
});

test('pedidos itens import page bloqueia importacao antes do preview', async () => {
  const dom = setupFrontendDom('#/importacao-itens-pedido');
  const apiClient = { post: async () => ({ ok: true }) };
  await renderPedidosItensImportPage(document.body, { apiClient });
  await flush();
  const fileInput = document.querySelector('[data-testid="file-input"]');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [fileBlob] });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  assert.equal(document.querySelector('[data-testid="import-button"]').disabled, true);
  teardownFrontendDom(dom);
});

test('pedidos itens import page shows loading overlay during preview', async () => {
  const dom = setupFrontendDom('#/importacao-itens-pedido');
  let resolvePreview;
  const apiClient = {
    post: async (path) => {
      if (path === '/pedidos/itens/importacao/preview') {
        return await new Promise((resolve) => { resolvePreview = resolve; });
      }
      return { ok: true };
    }
  };
  await renderPedidosItensImportPage(document.body, { apiClient });
  await flush();
  const fileInput = document.querySelector('[data-testid="file-input"]');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [fileBlob] });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  document.querySelector('[data-testid="preview-button"]').click();
  await flush();
  const overlay = document.querySelector('.nh-global-processing');
  assert.ok(overlay);
  assert.match(overlay.textContent, /Lendo planilha/);
  resolvePreview({ ok: true, importToken: 'token', summary: {}, rows: [] });
  await flush();
  await flush();
  teardownFrontendDom(dom);
});
