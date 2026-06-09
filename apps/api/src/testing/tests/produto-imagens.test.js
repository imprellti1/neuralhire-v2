import assert from 'node:assert/strict';
import { createTestRequest } from '../create-test-request.js';
import { parseJsonBody } from '../../core/body-parser.js';

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
    push(`Content-Disposition: form-data; name="${file.fieldName || 'upload'}"; filename="${file.fileName}"\r\n`);
    push(`Content-Type: ${file.mimeType || 'application/octet-stream'}\r\n\r\n`);
    chunks.push(Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content || '')));
    push(`\r\n`);
  }
  push(`--${boundary}--\r\n`);
  return { body: Buffer.concat(chunks), boundary };
}

export function getProdutoImagensTests() {
  return [
    {
      name: 'multipart de imagem expõe upload e campos no body parser',
      run: async () => {
        const multipart = createMultipartBody({
          fields: { principal: 'true', tipo: 'image' },
          file: {
            fileName: 'foto.png',
            mimeType: 'image/png',
            content: Buffer.from('fake-image')
          }
        });
        const req = createTestRequest({
          method: 'POST',
          url: '/produtos/p1/imagens',
          headers: {
            'content-type': `multipart/form-data; boundary=${multipart.boundary}`
          },
          body: multipart.body
        });
        const parsed = await parseJsonBody(req);
        assert.equal(parsed.principal, 'true');
        assert.equal(parsed.tipo, 'image');
        assert.ok(parsed.upload);
        assert.equal(parsed.upload.fileName, 'foto.png');
        assert.equal(parsed.upload.mimeType, 'image/png');
        assert.equal(typeof parsed.upload.base64, 'string');
      }
    },
    {
      name: 'multipart acima de 25MB retorna PAYLOAD_TOO_LARGE',
      run: async () => {
        const multipart = createMultipartBody({
          file: {
            fileName: 'gigante.png',
            mimeType: 'image/png',
            content: Buffer.alloc((25 * 1024 * 1024) + 1, 1)
          }
        });
        const req = createTestRequest({
          method: 'POST',
          url: '/produtos/p1/imagens',
          headers: {
            'content-type': `multipart/form-data; boundary=${multipart.boundary}`
          },
          body: multipart.body
        });
        await assert.rejects(() => parseJsonBody(req), (error) => error?.code === 'PAYLOAD_TOO_LARGE');
      }
    }
  ];
}
