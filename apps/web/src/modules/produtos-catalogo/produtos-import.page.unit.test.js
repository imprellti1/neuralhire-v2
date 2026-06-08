import assert from 'node:assert/strict';
import test from 'node:test';
import { fileToFormData } from './produtos-import.page.js';

test('fileToFormData normaliza arquivo para blob antes do formdata', async () => {
  const originalBlob = new Blob(['conteudo'], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  Object.defineProperty(originalBlob, 'name', {
    configurable: true,
    value: 'Estoque_288.xlsx'
  });

  const fd = await fileToFormData(originalBlob, '550e8400-e29b-41d4-a716-446655440001');

  assert.ok(fd instanceof FormData);
  assert.equal(fd.get('fabricante_id'), '550e8400-e29b-41d4-a716-446655440001');

  const file = fd.get('file');
  assert.ok(file);
  assert.equal(typeof file.size, 'number');
  assert.equal(file.name, 'Estoque_288.xlsx');
  assert.equal(file.size > 0, true);
});

