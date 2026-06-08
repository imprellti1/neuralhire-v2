import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '..');
const blocked = [
  ['account', '_', 'id'].join(''),
  ['account', 'Id'].join(''),
  ['tenant', '_', 'id'].join(''),
  ['tenant', 'Id'].join(''),
  ['owner', '_', 'user', '_', 'id'].join(''),
  ['owner', 'User', 'Id'].join('')
];
const allowlist = new Set([
  path.resolve(__dirname, 'frontend-security.test.js').replace(/\\/g, '/'),
  path.resolve(srcRoot, 'modules/produtos-catalogo/produto-details.page.contract.test.js').replace(/\\/g, '/'),
  path.resolve(srcRoot, 'testing/mocks/api-client.mock.js').replace(/\\/g, '/')
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(abs, out);
      continue;
    }
    if (entry.name.endsWith('.js')) out.push(abs);
  }
  return out;
}

test('frontend não deve conter campos sensíveis de tenant/owner', () => {
  const files = walk(srcRoot);
  const hits = [];
  for (const file of files) {
    const norm = file.replace(/\\/g, '/');
    if (allowlist.has(norm)) continue;
    const txt = fs.readFileSync(file, 'utf8');
    for (const token of blocked) {
      if (txt.includes(token)) hits.push(`${token} -> ${norm}`);
    }
  }
  assert.equal(hits.length, 0, `Campos sensíveis encontrados:\n${hits.join('\n')}`);
});
