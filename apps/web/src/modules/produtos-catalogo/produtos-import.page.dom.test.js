import assert from 'node:assert/strict';
import test from 'node:test';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { renderProdutosImportPage } from './produtos-import.page.js';

function appendXlsxField(formData, file) {
  formData.append('file', file, file.name);
}

function createXlsxBlobFile(fileName) {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  Object.defineProperty(blob, 'name', { value: fileName, configurable: true });
  return { blob, name: fileName };
}

test('produtos import page renders preview and execution states', async () => {
  const dom = setupFrontendDom('#/produtos/importacao');
  const calls = [];
  const apiClient = {
    get: async (path) => {
      if (path === '/fabricantes') return { items: [{ id: '550e8400-e29b-41d4-a716-446655440001', nome: 'Fab 1' }, { id: '550e8400-e29b-41d4-a716-446655440002', nome: 'Fab 2' }] };
      return { items: [] };
    },
    post: async (path, body) => {
      calls.push({ path, body });
      if (path === '/produtos/importar-estoque/preview') return { ok: true, batchId: 'batch-1', totalRows: 1, divergences: 1, sampleRows: [{ codigo_erp: '750100001', nome_produto: 'TOALHA', variacao_nome: 'BRANCO', variationsCount: 2 }], headers: ['Descrição'] };
      return { ok: true, batch: { status: 'completed', produtos_criados: 1, variacoes_criadas: 2, estoques_atualizados: 2, divergencias: 1 } };
    }
  };
  await renderProdutosImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importação de Produtos/);
  assert.match(document.body.textContent, /Selecione um arquivo XLSX antes de continuar\./);
  const fab = document.querySelector('#npi-fab');
  assert.equal(fab.value, '550e8400-e29b-41d4-a716-446655440001');
  const file = createXlsxBlobFile('Estoque_288.xlsx');
  const input = document.querySelector('#npi-file');
  Object.defineProperty(input, 'files', { value: [file.blob] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /Arquivo selecionado: Estoque_288\.xlsx/);
  document.querySelector('#npi-preview').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Divergências/);
  const previewCall = calls.find((call) => call.path === '/produtos/importar-estoque/preview');
  assert.ok(previewCall?.body instanceof FormData);
  assert.equal(previewCall.body.get('fabricante_id'), '550e8400-e29b-41d4-a716-446655440001');
  assert.ok(previewCall.body.get('file'));
  assert.equal(previewCall.body.get('file').name, 'Estoque_288.xlsx');
  assert.equal(previewCall.body.get('file').size > 0, true);
  assert.doesNotThrow(() => {
    const fd = new FormData();
    appendXlsxField(fd, file.blob);
    fd.append('fabricante_id', '550e8400-e29b-41d4-a716-446655440001');
  });
  document.querySelector('#npi-run').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /completed/i);
  assert.ok(calls.some((call) => call.path === '/produtos/importar-estoque/preview'));
  assert.ok(calls.some((call) => call.path === '/produtos/importar-estoque'));
  teardownFrontendDom(dom);
});

test('produtos import page does not call preview without fabricante selecionado', async () => {
  const dom = setupFrontendDom('#/produtos/importacao-empty');
  const calls = [];
  const apiClient = {
    get: async (path) => {
      if (path === '/fabricantes') return { items: [] };
      return { items: [] };
    },
    post: async (path, body) => {
      calls.push({ path, body });
      return { ok: true };
    }
  };
  renderProdutosImportPage(document.body, { apiClient });
  await flush();
  const file = createXlsxBlobFile('Estoque_289.xlsx');
  const input = document.querySelector('#npi-file');
  Object.defineProperty(input, 'files', { value: [file.blob] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  document.querySelector('#npi-preview').click();
  await flush();
  assert.equal(calls.length, 0);
  teardownFrontendDom(dom);
});

test('produtos import page keeps fabricanteId in sync with selected option', async () => {
  const dom = setupFrontendDom('#/produtos/importacao-sync');
  const apiClient = {
    get: async (path) => {
      if (path === '/fabricantes') return { items: [{ id: '550e8400-e29b-41d4-a716-446655440099', nome: 'Fab Sync' }] };
      return { items: [] };
    },
    post: async () => ({ ok: true })
  };
  await renderProdutosImportPage(document.body, { apiClient });
  await flush();
  const select = document.querySelector('#npi-fab');
  assert.equal(select.value, '550e8400-e29b-41d4-a716-446655440099');
  const file = createXlsxBlobFile('Estoque_290.xlsx');
  const input = document.querySelector('#npi-file');
  Object.defineProperty(input, 'files', { value: [file.blob] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  const previewBtn = document.querySelector('#npi-preview');
  assert.equal(previewBtn.disabled, false);
  teardownFrontendDom(dom);
});
