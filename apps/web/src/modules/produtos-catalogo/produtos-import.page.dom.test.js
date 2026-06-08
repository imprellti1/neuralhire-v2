import assert from 'node:assert/strict';
import test from 'node:test';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { renderProdutosImportPage } from './produtos-import.page.js';

test('produtos import page renders preview and execution states', async () => {
  const dom = setupFrontendDom('#/produtos/importacao');
  const calls = [];
  const apiClient = {
    get: async (path) => {
      if (path === '/fabricantes') return { items: [{ id: 'fab-1', nome: 'Fab 1' }] };
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
  document.querySelector('#npi-preview').click();
  await flush();
  assert.equal(calls.length, 0);
  const fab = document.querySelector('#npi-fab');
  fab.value = 'fab-1';
  fab.dispatchEvent(new Event('change', { bubbles: true }));
  const file = new window.File(['fake'], 'Estoque_288.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const input = document.querySelector('#npi-file');
  Object.defineProperty(input, 'files', { value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#npi-preview').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Divergências/);
  const previewCall = calls.find((call) => call.path === '/produtos/importar-estoque/preview');
  assert.ok(previewCall?.body instanceof FormData);
  assert.equal(previewCall.body.get('fabricante_id'), 'fab-1');
  assert.ok(previewCall.body.get('file') instanceof File);
  document.querySelector('#npi-run').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /completed/i);
  assert.ok(calls.some((call) => call.path === '/produtos/importar-estoque/preview'));
  assert.ok(calls.some((call) => call.path === '/produtos/importar-estoque'));
  teardownFrontendDom(dom);
});
