import assert from 'node:assert/strict';
import test from 'node:test';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';
import { renderClientesImportPage } from './clientes-import.page.js';

function makeTestXlsxBlob() {
  const blob = new Blob(['conteudo-xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  Object.defineProperty(blob, 'name', { value: 'Clientes_288.xlsx', configurable: true });
  return blob;
}

test('clientes import page renders preview and confirm flow', async () => {
  const dom = setupFrontendDom('#/importacoes');
  const calls = [];
  const apiClient = {
    post: async (path, body) => {
      calls.push({ path, body });
      if (path === '/clientes/importacao/preview') {
        return { ok: true, importToken: 'token-1', fileName: 'Clientes_288.xlsx', summary: { novos: 1, existentes: 1, invalidos: 1, possiveis_duplicados: 1 }, rows: [{ rowNumber: 2, razaoSocial: 'Cliente A', cnpj: '123', codigo: '001', status: 'novo', errors: [] }, { rowNumber: 3, razaoSocial: '', cnpj: '', codigo: '', status: 'invalido', errors: ['Razão Social obrigatória.'] }] };
      }
      return { ok: true, summary: { inserted: 1, ignoredExisting: 1, invalidRows: 1, possibleDuplicates: 1 } };
    }
  };
  await renderClientesImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importação de Clientes/);
  const fileInput = document.querySelector('#nci-file');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [fileBlob] });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();
  document.querySelector('#nci-preview').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Novos/);
  assert.match(document.body.textContent, /Inválidos/);
  assert.match(document.body.textContent, /Razão Social obrigatória/);
  const previewCall = calls.find((call) => call.path === '/clientes/importacao/preview');
  assert.ok(previewCall?.body instanceof FormData);
  document.querySelector('#nci-run').click();
  await flush();
  await flush();
  const runCall = calls.find((call) => call.path === '/clientes/importacao');
  assert.equal(runCall.body.importToken, 'token-1');
  assert.match(document.body.textContent, /Resultado final/);
  teardownFrontendDom(dom);
});
