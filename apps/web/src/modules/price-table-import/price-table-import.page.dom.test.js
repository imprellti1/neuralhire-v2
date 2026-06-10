import assert from 'node:assert/strict';
import test from 'node:test';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { renderPriceTableImportPage } from './price-table-import.page.js';

function makeTestXlsxBlob() {
  const blob = new Blob(['conteudo-xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  Object.defineProperty(blob, 'name', { value: 'Tabela_Preco.xlsx', configurable: true });
  return blob;
}

test('price table import page renders preview and apply flow', async () => {
  const dom = setupFrontendDom('#/produtos/importacao-tabela-preco');
  const calls = [];
  const apiClient = {
    post: async (path, body) => {
      calls.push({ path, body });
      if (path === '/produtos/importacao-tabela-preco/preview') {
        return {
          ok: true,
          importToken: 'token-1',
          fileName: 'Tabela_Preco.xlsx',
          summary: { totalRows: 3, matchedRows: 2, changedRows: 1, unchangedRows: 1, unmatchedRows: 1, invalidRows: 0 },
          items: [
            { ref: '001', currentPrice: 10, newPrice: 12, status: 'matched_changed', message: 'Preço será atualizado.' },
            { ref: '002', currentPrice: 15, newPrice: 15, status: 'matched_unchanged', message: 'Preço já está atualizado.' },
            { ref: '999', currentPrice: null, newPrice: 20, status: 'unmatched', message: 'Produto não encontrado.' }
          ]
        };
      }
      return { ok: true, summary: { updatedRows: 1, skippedRows: 2 } };
    }
  };
  await renderPriceTableImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importação de Tabela de Preço/);
  const fileInput = document.querySelector('#pti-file');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [fileBlob] });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  document.querySelector('#pti-preview').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Encontrados/);
  assert.match(document.body.textContent, /Atualizar/);
  assert.match(document.body.textContent, /Não encontrado/);
  assert.equal(document.querySelector('[aria-label="Ver produto"]'), null);
  document.querySelector('#pti-run').click();
  await flush();
  await flush();
  const previewCall = calls.find((call) => call.path === '/produtos/importacao-tabela-preco/preview');
  assert.ok(previewCall?.body instanceof FormData);
  const applyCall = calls.find((call) => call.path === '/produtos/importacao-tabela-preco');
  assert.equal(applyCall.body.importToken, 'token-1');
  teardownFrontendDom(dom);
});
