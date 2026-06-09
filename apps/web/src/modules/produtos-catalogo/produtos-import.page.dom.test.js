import assert from 'node:assert/strict';
import test from 'node:test';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { renderProdutosImportPage } from './produtos-import.page.js';

function makeTestXlsxBlob() {
  const blob = new Blob(['conteudo-xlsx'], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  Object.defineProperty(blob, 'name', {
    value: 'Estoque_288.xlsx',
    configurable: true
  });

  return blob;
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
      if (path === '/produtos/importar-estoque/preview') return { ok: true, batchId: 'batch-1', totalRows: 1, divergences: 1, items: [{ sku: '750100001', nome_produto: 'TOALHA', cor: 'BRANCO', grade: 'UNI', estoque: 2025 }], sampleRows: [{ codigo_erp: '750100001', nome_produto: 'TOALHA', variacao_nome: 'BRANCO', variationsCount: 2 }], headers: ['Descrição'] };
      return { ok: true, batch: { status: 'completed', produtos_criados: 1, variacoes_criadas: 2, estoques_atualizados: 2, divergencias: 1 } };
    }
  };
  await renderProdutosImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importação de Produtos/);
  assert.match(document.body.textContent, /Selecione um arquivo XLSX antes de continuar\./);
  const fab = document.querySelector('#npi-fab');
  assert.equal(fab.value, '550e8400-e29b-41d4-a716-446655440001');
  const fileInput = document.querySelector('#npi-file');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [fileBlob]
  });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  assert.match(document.body.textContent, /Arquivo selecionado: Estoque_288\.xlsx/);
  document.querySelector('#npi-preview').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Divergências/);
  assert.match(document.body.textContent, /750100001/);
  assert.match(document.body.textContent, /2025/);
  const previewCall = calls.find((call) => call.path === '/produtos/importar-estoque/preview');
  assert.ok(previewCall?.body instanceof FormData);
  assert.equal(previewCall.body.get('fabricante_id'), '550e8400-e29b-41d4-a716-446655440001');
  const previewFile = previewCall.body.get('file');
  assert.ok(previewFile);
  assert.equal(typeof previewFile.size, 'number');
  assert.equal(previewFile.name, 'Estoque_288.xlsx');
  assert.equal(previewFile.size > 0, true);
  assert.doesNotThrow(() => {
    const fd = new FormData();
    fd.append('fabricante_id', '550e8400-e29b-41d4-a716-446655440001');
    fd.append('file', fileBlob, fileBlob.name);
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
  const fileInput = document.querySelector('#npi-file');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [fileBlob]
  });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
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
  const fileInput = document.querySelector('#npi-file');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', {
    configurable: true,
    value: [fileBlob]
  });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  const previewBtn = document.querySelector('#npi-preview');
  assert.equal(previewBtn.disabled, false);
  teardownFrontendDom(dom);
});
