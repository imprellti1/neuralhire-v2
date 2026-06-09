import assert from 'node:assert/strict';
import xlsx from 'xlsx';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createFabricante } from '../../modules/fabricantes/fabricantes.repository.js';
import { __resetMemoryProdutosForTests } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryProductEditorForTests } from '../../modules/product-editor/product-editor.repository.js';
import { __dumpImportMemory } from '../../modules/produtos/produtos-import.repository.js';
import { __getProdutoVariacoesSelectFieldsForTests } from '../../modules/produtos/produtos-import.repository.js';
import { __buildVariationIdentityForTests } from '../../modules/produtos/produtos-import.repository.js';
import { __buildVariationsFromRowForTests } from '../../modules/produtos/produtos-import.repository.js';
import { parseJsonBody } from '../../core/body-parser.js';

function parseBody(res) {
  try { return JSON.parse(res.body || '{}'); } catch { return {}; }
}

function call(app, { method, url, role, accountId, body }) {
  const headers = {};
  if (role) headers['x-test-role'] = role;
  if (accountId) headers['x-test-account-id'] = accountId;
  let payload = null;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const req = createTestRequest({ method, url, headers, body: payload });
  const res = createTestResponse();
  return app(req, res).then(() => ({ res, body: parseBody(res) }));
}

function createMultipartBody({ fields = {}, file = null, boundary = '----neuralhire-boundary' } = {}) {
  const chunks = [];
  const push = (value) => chunks.push(Buffer.from(String(value)));
  for (const [key, value] of Object.entries(fields)) {
    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${key}"\r\n\r\n`);
    push(`${value}\r\n`);
  }
  if (file) {
    push(`--${boundary}\r\n`);
    push(`Content-Disposition: form-data; name="${file.fieldName || 'file'}"; filename="${file.fileName}"\r\n`);
    push(`Content-Type: ${file.mimeType || 'application/octet-stream'}\r\n\r\n`);
    chunks.push(Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content || '')));
    push(`\r\n`);
  }
  push(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), boundary };
}

function createMultipartRequest({ accountId, role, fields = {}, file = null }) {
  const multipart = createMultipartBody({ fields, file });
  const req = createTestRequest({
    method: 'POST',
    url: '/produtos/importar-estoque/preview',
    headers: {
      ...(role ? { 'x-test-role': role } : {}),
      ...(accountId ? { 'x-test-account-id': accountId } : {}),
      'content-type': `multipart/form-data; boundary=${multipart.boundary}`
    },
    body: multipart.body
  });
  return { req, multipart };
}

export function getProdutosImportTests() {
  return [
    {
      name: 'identidade canonica da variacao usa nome e grade da constraint',
      run: async () => {
        const identity = __buildVariationIdentityForTests({
          account_id: 'acc-x',
          produto_id: 'prod-x',
          nome: 'BRANCO / P',
          grade: 'P'
        });
        assert.equal(identity.accountId, 'acc-x');
        assert.equal(identity.produtoId, 'prod-x');
        assert.equal(identity.nome, 'BRANCO / P');
        assert.equal(identity.grade, 'P');
      }
    },
    {
      name: 'upsertStockRecord usa somente colunas reais de produto_variacoes',
      run: async () => {
        const fields = __getProdutoVariacoesSelectFieldsForTests();
        assert.equal(fields.includes('tamanho'), false);
        assert.equal(fields.includes('grade'), true);
        assert.equal(fields.includes('estoque_atual'), true);
      }
    },
    {
      name: 'explode apenas grades com estoque positivo e ignora Total',
      run: async () => {
        const row = {
          Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO',
          P: '10',
          M: '',
          G: '',
          Total: '999'
        };
        const parsed = { codigo_erp: '750100001', nome_produto: 'TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', cor: 'BRANCO', variacao_nome: 'BRANCO' };
        const columns = { variationIndexes: new Map([['P', 1], ['M', 2], ['G', 3]]) };
        const { variations } = __buildVariationsFromRowForTests(row, ['Descricao', 'P', 'M', 'G', 'Total'], parsed, columns);
        assert.equal(variations.length, 1);
        assert.equal(variations[0].grade, 'P');
        assert.equal(variations[0].quantidade, 10);
      }
    },
    {
      name: 'preview de XLSX valido sem exigir ag-grid',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Import', cnpj: '92345678000199' }, { accountId: 'acc-import' });
        const base64 = createXlsxBase64([{ Produto: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Estoque: '1' }], 'Planilha Produtos');
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-import', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(out.body.totalRows, 1);
        assert.equal(out.body.totalValid, 1);
        assert.equal(out.body.sheetName, 'Planilha Produtos');
        assert.equal(out.body.sampleRows?.[0]?.variations?.some((variation) => variation.grade === 'P' && variation.quantidade === 1), true);
      }
    },
    {
      name: 'preview e import ignoram Total e processam UNI',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Total UNI', cnpj: '82345678000188' }, { accountId: 'acc-total-uni' });
        const base64 = createXlsxBase64([{ Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', UNI: '2025', Total: '2025' }]);
        const preview = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-total-uni', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(preview.res.statusCode, 200);
        assert.equal(preview.body.sampleRows?.[0]?.variationsCount, 1);
        assert.equal(preview.body.sampleRows?.[0]?.variations?.[0]?.grade, 'UNI');
        assert.equal(preview.body.sampleRows?.[0]?.variations?.[0]?.quantidade, 2025);
        assert.equal(preview.body.sampleRows?.[0]?.total, 2025);
        assert.equal(preview.body.sampleRows?.[0]?.variations?.some((variation) => variation.grade === 'Total'), false);

        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-total-uni', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        const memory = await __dumpImportMemory();
        assert.equal(memory.stocks.some((stock) => stock.quantidade === 2025), true);
        assert.equal(memory.stocks.some((stock) => String(stock.grade || '') === 'Total'), false);
      }
    },
    {
      name: 'preview reflete estoque real por grade positiva',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Preview Real', cnpj: '82345678000177' }, { accountId: 'acc-preview-real' });
        const base64 = createXlsxBase64([
          { Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', UNI: '2025', Total: '2025' },
          { Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - LINHO', UNI: '3', Total: '3' },
          { Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - ROSA CRISTAL', UNI: '0', Total: '0' }
        ]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-preview-real', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.sampleRows?.[0]?.variations?.[0]?.quantidade, 2025);
        assert.equal(out.body.sampleRows?.[0]?.total, 2025);
        assert.equal(out.body.sampleRows?.[1]?.variations?.[0]?.quantidade, 3);
        assert.equal(out.body.sampleRows?.[1]?.total, 3);
        assert.equal(out.body.sampleRows?.length, 2);
      }
    },
    {
      name: 'importacao cria somente grades com estoque positivo e ignora Total',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Grades', cnpj: '72345678000188' }, { accountId: 'acc-grades' });
        const base64 = createXlsxBase64([{ Descricao: '750100002 - TOALHA BANHÃO 90cm X 1,60m MASTER - AZUL', P: '2', M: '3', Total: '5' }]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-grades', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        const memory = await __dumpImportMemory();
        const grades = memory.stocks.map((stock) => ({ grade: stock.grade, quantidade: stock.quantidade }));
        assert.equal(grades.some((item) => item.grade === 'P' && item.quantidade === 2), true);
        assert.equal(grades.some((item) => item.grade === 'M' && item.quantidade === 3), true);
        assert.equal(grades.some((item) => item.grade === 'Total'), false);
      }
    },
    {
      name: 'preview multipart com fabricante_id retorna sucesso',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Multipart', cnpj: '92345678000198' }, { accountId: 'acc-multipart' });
        const base64 = createXlsxBase64([{ Nome: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Qtd: '1' }]);
        const xlsxBuffer = Buffer.from(base64, 'base64');
        const multipart = createMultipartBody({
          fields: { fabricante_id: fabricante.id },
          file: {
            fileName: 'Estoque_288.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            content: xlsxBuffer
          }
        });
        const req = createTestRequest({
          method: 'POST',
          url: '/produtos/importar-estoque/preview',
          headers: {
            'x-test-role': 'admin',
            'x-test-account-id': 'acc-multipart',
            'content-type': `multipart/form-data; boundary=${multipart.boundary}`
          },
          body: multipart.body
        });
        const res = createTestResponse();
        await app(req, res);
        const out = parseBody(res);
        assert.equal(res.statusCode, 200);
        assert.equal(out.ok, true);
        assert.ok(out.totalRows >= 0);
        assert.equal(typeof out.batchId, 'string');
      }
    },
    {
      name: 'body parser multipart expõe fabricante_id e file no context.body',
      run: async () => {
        const { req, multipart } = createMultipartRequest({
          accountId: 'acc-parser',
          role: 'admin',
          fields: { fabricante_id: 'fab-parser' },
          file: {
            fileName: 'Estoque_288.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            content: Buffer.from('fake-xlsx')
          }
        });
        const parsed = await parseJsonBody(req);
        assert.equal(parsed.fabricante_id, 'fab-parser');
        assert.ok(parsed.file);
        assert.equal(parsed.file.fileName, 'Estoque_288.xlsx');
        assert.ok(parsed.file.base64);
        assert.equal(typeof parsed.file.base64, 'string');
        const mimeType = parsed.file.mimeType || '';
        assert.equal(mimeType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || mimeType === 'application/octet-stream', true);
        assert.equal(multipart.boundary.startsWith('----neuralhire-boundary'), true);
      }
    },
    {
      name: 'importacao repetida atualiza estoque sem duplicar variacao',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Import 2', cnpj: '82345678000199' }, { accountId: 'acc-import-2' });
        const base64 = createXlsxBase64([
          { Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Estoque: '1' },
          { Descricao: '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '0', M: '1', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Estoque: '1' }
        ]);
        const first = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-import-2', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(first.res.statusCode, 200);
        assert.equal(first.body.ok, true);
        const memoryAfterFirst = await __dumpImportMemory();
        assert.equal((memoryAfterFirst.batches || []).length > 0, true);
        const firstUniqueKeys = new Set(memoryAfterFirst.stocks.map((stock) => `${stock.account_id}::${stock.produto_id}::${stock.nome}::${stock.grade}`));
        assert.equal(firstUniqueKeys.size, memoryAfterFirst.stocks.length);
        const second = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-import-2', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(second.res.statusCode, 200);
        const memoryAfterSecond = await __dumpImportMemory();
        assert.equal(memoryAfterSecond.batches.length >= memoryAfterFirst.batches.length, true);
        const secondUniqueKeys = new Set(memoryAfterSecond.stocks.map((stock) => `${stock.account_id}::${stock.produto_id}::${stock.nome}::${stock.grade}`));
        assert.equal(secondUniqueKeys.size, memoryAfterSecond.stocks.length);
        assert.equal(memoryAfterSecond.stocks.length, memoryAfterFirst.stocks.length);
        assert.equal(memoryAfterSecond.stocks.some((stock) => stock.nome === 'BRANCO / P' && stock.grade === 'P'), true);
        assert.equal(second.body.batch.status === 'completed' || second.body.batch.status === 'completed_with_warnings', true);
      }
    },
    {
      name: 'primeira importacao cria variacao nova e segunda atualiza sem PGRST116',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab PGRST116', cnpj: '92345678000197' }, { accountId: 'acc-pgrst116' });
        const base64 = createXlsxBase64([{ Descricao: '750100010 - TOALHA BANHÃO 90cm X 1,60m MASTER - PRETO', P: '1', Total: '1' }]);

        const first = await call(app, {
          method: 'POST',
          url: '/produtos/importar-estoque',
          role: 'admin',
          accountId: 'acc-pgrst116',
          body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } }
        });
        assert.equal(first.res.statusCode, 200);
        assert.equal(first.body.ok, true);
        const memoryAfterFirst = await __dumpImportMemory();
        assert.equal(memoryAfterFirst.stocks.length, 1);
        assert.equal(memoryAfterFirst.stocks[0].grade, 'P');
        assert.equal(memoryAfterFirst.stocks[0].quantidade, 1);

        const second = await call(app, {
          method: 'POST',
          url: '/produtos/importar-estoque',
          role: 'admin',
          accountId: 'acc-pgrst116',
          body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } }
        });
        assert.equal(second.res.statusCode, 200);
        assert.equal(second.body.ok, true);
        const memoryAfterSecond = await __dumpImportMemory();
        assert.equal(memoryAfterSecond.stocks.length, 1);
        assert.equal(memoryAfterSecond.stocks[0].grade, 'P');
        assert.equal(memoryAfterSecond.stocks[0].quantidade, 1);
      }
    },
    {
      name: 'preview ignora Total e mostra grades explodidas',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Preview Grades', cnpj: '72345678000199' }, { accountId: 'acc-div' });
        const base64 = createXlsxBase64([{ Descricao: '750100002 - TOALHA BANHÃO 90cm X 1,60m MASTER - CINZA', P: '1', M: '1', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '2' }]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-div', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.sampleRows?.[0]?.variations?.some((variation) => variation.grade === 'Total'), false);
        assert.equal(out.body.sampleRows?.[0]?.variations?.some((variation) => variation.grade === 'P' && variation.quantidade === 1), true);
        assert.equal(out.body.sampleRows?.[0]?.variations?.some((variation) => variation.grade === 'M'), false);
      }
    },
    {
      name: 'erro amigavel para planilha invalida',
      run: async () => {
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Invalido', cnpj: '52345678000199' }, { accountId: 'acc-invalid' });
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-invalid', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'broken.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: Buffer.from('nao-e-xlsx').toString('base64') } } });
        assert.equal(out.res.statusCode, 400);
        assert.match(out.body?.error?.message || '', /Nao foi possivel ler a planilha|Não foi possível ler a planilha|A planilha precisa conter ao menos uma coluna de produto\/nome\/descrição/);
      }
    },
    {
      name: 'bloqueio sem fabricante_id',
      run: async () => {
        const app = createApiApp();
        const multipart = createMultipartBody({
          file: {
            fileName: 'Estoque_288.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            content: Buffer.from(createXlsxBase64([{ Descricao: '750100003 - TOALHA - AZUL', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Estoque: '1' }]), 'base64')
          }
        });
        const req = createTestRequest({
          method: 'POST',
          url: '/produtos/importar-estoque/preview',
          headers: {
            'x-test-role': 'admin',
            'x-test-account-id': 'acc-bad',
            'content-type': `multipart/form-data; boundary=${multipart.boundary}`
          },
          body: multipart.body
        });
        const res = createTestResponse();
        await app(req, res);
        const out = parseBody(res);
        assert.equal(res.statusCode, 400);
        assert.match(out?.error?.message || '', /fabricante_id obrigatorio/);
      }
    },
    {
      name: 'cross tenant bloqueado',
      run: async () => {
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Tenant', cnpj: '62345678000199' }, { accountId: 'acc-tenant-a' });
        const base64 = createXlsxBase64([{ Descricao: '750100003 - TOALHA - AZUL', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Estoque: '1' }]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-tenant-b', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal([400, 403, 404].includes(out.res.statusCode), true);
      }
    }
  ];
}

function createXlsxBase64(rows, sheetName = 'Sheet1') {
  const ws = xlsx.utils.json_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, sheetName);
  return xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
}
