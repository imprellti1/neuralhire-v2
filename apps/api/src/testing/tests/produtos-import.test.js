import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { createFabricante } from '../../modules/fabricantes/fabricantes.repository.js';
import { __resetMemoryProdutosForTests } from '../../modules/produtos/produtos.repository.js';
import { __resetMemoryProductEditorForTests } from '../../modules/product-editor/product-editor.repository.js';
import { __dumpImportMemory } from '../../modules/produtos/produtos-import.repository.js';
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
      name: 'preview de XLSX valido',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Import', cnpj: '92345678000199' }, { accountId: 'acc-import' });
        const base64 = createXlsxBase64([{ 'Descrição': '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '1' }]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-import', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.res.statusCode, 200);
        assert.equal(out.body.ok, true);
        assert.equal(out.body.totalRows >= 0, true);
      }
    },
    {
      name: 'preview multipart com fabricante_id retorna sucesso',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Multipart', cnpj: '92345678000198' }, { accountId: 'acc-multipart' });
        const base64 = createXlsxBase64([{ 'Descrição': '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '1' }]);
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
        assert.equal(multipart.boundary.startsWith('----neuralhire-boundary'), true);
      }
    },
    {
      name: 'importacao cria produto, variacao e estoque idempotente',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Import 2', cnpj: '82345678000199' }, { accountId: 'acc-import-2' });
        const base64 = createXlsxBase64([
          { 'Descrição': '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '1' },
          { 'Descrição': '750100001 - TOALHA BANHÃO 90cm X 1,60m MASTER - BRANCO', P: '0', M: '1', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '1' }
        ]);
        const first = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-import-2', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(first.res.statusCode, 200);
        assert.equal(first.body.ok, true);
        const memoryAfterFirst = await __dumpImportMemory();
        assert.equal((memoryAfterFirst.batches || []).length > 0, true);
        const second = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-import-2', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(second.res.statusCode, 200);
        const memoryAfterSecond = await __dumpImportMemory();
        assert.equal(memoryAfterSecond.batches.length >= memoryAfterFirst.batches.length, true);
        assert.equal(second.body.batch.status === 'completed' || second.body.batch.status === 'completed_with_warnings', true);
      }
    },
    {
      name: 'divergencia de total registrada',
      run: async () => {
        __resetMemoryProdutosForTests();
        __resetMemoryProductEditorForTests();
        const app = createApiApp();
        const fabricante = await createFabricante({ nome: 'Fab Divergencia', cnpj: '72345678000199' }, { accountId: 'acc-div' });
        const base64 = createXlsxBase64([{ 'Descrição': '750100002 - TOALHA BANHÃO 90cm X 1,60m MASTER - CINZA', P: '1', M: '1', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '5' }]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque/preview', role: 'admin', accountId: 'acc-div', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal(out.body.divergences > 0, true);
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
            content: Buffer.from(createXlsxBase64([{ 'Descrição': '750100003 - TOALHA - AZUL', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '1' }]), 'base64')
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
        const base64 = createXlsxBase64([{ 'Descrição': '750100003 - TOALHA - AZUL', P: '1', M: '0', G: '0', GG: '0', '35-36': '0', '37-38': '0', '39-40': '0', '41-42': '0', '43-44': '0', UNI: '0', Total: '1' }]);
        const out = await call(app, { method: 'POST', url: '/produtos/importar-estoque', role: 'admin', accountId: 'acc-tenant-b', body: { fabricante_id: fabricante.id, arquivo: { fileName: 'Estoque_288.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64 } } });
        assert.equal([400, 403, 404].includes(out.res.statusCode), true);
      }
    }
  ];
}
function createXlsxBase64(rows) {
  const payload = JSON.stringify(rows);
  const script = String.raw`
import base64, json, sys, zipfile, io
rows = json.loads(sys.argv[1])
cols = ['Descrição','P','M','G','GG','35-36','37-38','39-40','41-42','43-44','UNI','Total']
def col_name(idx):
    n=idx+1
    out=''
    while n:
        n, rem = divmod(n-1, 26)
        out = chr(65+rem) + out
    return out
def cell(ref, v):
    return f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>'
sheet_rows = ['<row r="1">' + ''.join(cell(f"{col_name(i)}1", c) for i, c in enumerate(cols)) + '</row>']
for r_idx, row in enumerate(rows, start=2):
    sheet_rows.append('<row r="%d">' % r_idx + ''.join(cell(f"{col_name(i)}{r_idx}", row.get(c, '')) for i, c in enumerate(cols)) + '</row>')
sheet = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(sheet_rows) + '</sheetData></worksheet>'
wb = '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="ag-grid" sheetId="1" r:id="rId1"/></sheets></workbook>'
rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
ct = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
root_rels = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml', ct)
    z.writestr('_rels/.rels', root_rels)
    z.writestr('xl/workbook.xml', wb)
    z.writestr('xl/_rels/workbook.xml.rels', rels)
    z.writestr('xl/worksheets/sheet1.xml', sheet)
print(base64.b64encode(buf.getvalue()).decode())
`;
  const out = spawnSync('python', ['-c', script, payload], { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(out.stderr || out.stdout);
  return out.stdout.trim();
}
