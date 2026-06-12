import assert from 'node:assert/strict';
import test from 'node:test';
import { flush, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { renderPedidosImportPage } from './pedidos-import.page.js';

function makeTestXlsxBlob() {
  const blob = new Blob(['conteudo-xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  Object.defineProperty(blob, 'name', { value: 'Pedidos.xlsx', configurable: true });
  return blob;
}

test('pedidos import page renders preview and execute flow', async () => {
  const dom = setupFrontendDom('#/importacao-pedidos');
  const calls = [];
  const apiClient = {
    post: async (path, body) => {
      calls.push({ path, body });
      if (path === '/pedidos/importacao/preview') {
        return {
          ok: true,
          importToken: 'token-pedidos',
          fileName: 'Pedidos.xlsx',
          sheetName: 'Plan1',
          summary: {
            pedidos_encontrados: 4,
            pedidos_validos: 2,
            pedidos_sem_cliente: 1,
            pedidos_duplicados: 1,
            inconsistencias: [
              { linha: 4, codigo: 'CLIENTE_NAO_ENCONTRADO', cliente: '999', motivo: 'Cliente inexistente' }
            ]
          },
          rows: [
            { rowNumber: 2, numero: '1001', clienteCodigo: '001', clienteEncontrado: true, status: 'ok', erros: [] },
            { rowNumber: 3, numero: '1002', clienteCodigo: '002', clienteEncontrado: true, status: 'duplicado', erros: ['Pedido já existente'] },
            { rowNumber: 4, numero: '1003', clienteCodigo: '999', clienteEncontrado: false, status: 'sem_cliente', erros: ['Cliente não encontrado'] }
          ]
        };
      }
      return {
        ok: true,
        summary: {
          pedidos_criados: 2,
          pedidos_ignorados: 0,
          pedidos_duplicados: 1,
          pedidos_com_erro: 0,
          pedidos_sem_cliente: 1,
          inconsistencias: [{ linha: 4, codigo: 'CLIENTE_NAO_ENCONTRADO', cliente: '999', motivo: 'Cliente inexistente' }]
        },
        inconsistencias: [{ linha: 4, codigo: 'CLIENTE_NAO_ENCONTRADO', cliente: '999', motivo: 'Cliente inexistente' }]
      };
    }
  };

  await renderPedidosImportPage(document.body, { apiClient });
  await flush();
  assert.match(document.body.textContent, /Importação de Pedidos/);
  assert.match(document.body.textContent, /Cliente/i);
  assert.match(document.body.textContent, /Razão Social/i);

  const fileInput = document.querySelector('#npi2-file');
  const fileBlob = makeTestXlsxBlob();
  Object.defineProperty(fileInput, 'files', { configurable: true, value: [fileBlob] });
  fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  await flush();

  document.querySelector('#npi2-preview').click();
  await flush();
  await flush();
  assert.match(document.body.textContent, /Pedidos encontrados/);
  assert.match(document.body.textContent, /Pedidos válidos/);
  assert.match(document.body.textContent, /Cliente inexistente/);
  assert.match(document.body.textContent, /Sem cliente/);

  const previewCall = calls.find((call) => call.path === '/pedidos/importacao/preview');
  assert.ok(previewCall?.body instanceof FormData);

  document.querySelector('#npi2-run').click();
  await flush();
  await flush();
  const runCall = calls.find((call) => call.path === '/pedidos/importacao');
  assert.equal(runCall.body.importToken, 'token-pedidos');
  assert.match(document.body.textContent, /Pedidos criados/);
  assert.match(document.body.textContent, /Pedidos sem cliente/);

  teardownFrontendDom(dom);
});
