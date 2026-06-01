import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const snapshotsDir = path.join(__dirname, 'snapshots');

const BLOCKED_TOKENS = [
  ['account', 'id'].join('_'),
  'account' + 'Id',
  ['tenant', 'id'].join('_'),
  'tenant' + 'Id',
  ['owner', 'user', 'id'].join('_'),
  'owner' + 'UserId',
  'Authorization',
  'Bearer',
  'token'
];

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key]);
  return out;
}

function findDiff(expected, received, pathKey = '') {
  if (expected === received) return null;
  if (typeof expected !== typeof received) return { field: pathKey, expected, received };
  if (Array.isArray(expected) && Array.isArray(received)) {
    if (expected.length !== received.length) return { field: `${pathKey}.length`, expected: expected.length, received: received.length };
    for (let i = 0; i < expected.length; i += 1) {
      const diff = findDiff(expected[i], received[i], `${pathKey}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }
  if (expected && typeof expected === 'object' && received && typeof received === 'object') {
    const keys = new Set([...Object.keys(expected), ...Object.keys(received)]);
    for (const key of [...keys].sort()) {
      const next = pathKey ? `${pathKey}.${key}` : key;
      if (!(key in expected)) return { field: next, expected: undefined, received: received[key] };
      if (!(key in received)) return { field: next, expected: expected[key], received: undefined };
      const diff = findDiff(expected[key], received[key], next);
      if (diff) return diff;
    }
    return null;
  }
  return { field: pathKey, expected, received };
}

function assertNoSensitiveSnapshotContent(name, value) {
  const text = JSON.stringify(value);
  const hits = BLOCKED_TOKENS.filter((token) => token !== 'x-test-account-id' && text.includes(token));
  assert.equal(hits.length, 0, `Snapshot ${name} contem dados sensiveis: ${hits.join(', ')}`);
}

export function normalizeTransportSnapshot(calls = []) {
  return calls.map((call) => sortDeep({
    method: call.method,
    path: call.path,
    query: call.query || {},
    headers: call.headers || {},
    body: call.body === undefined ? null : call.body
  }));
}

export function loadTransportSnapshot(name) {
  const file = path.join(snapshotsDir, `${name}.transport.snapshot.json`);
  const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertNoSensitiveSnapshotContent(name, snapshot);
  return snapshot;
}

export function writeTransportSnapshot(name, calls) {
  const file = path.join(snapshotsDir, `${name}.transport.snapshot.json`);
  fs.mkdirSync(snapshotsDir, { recursive: true });
  const normalized = normalizeTransportSnapshot(calls);
  assertNoSensitiveSnapshotContent(name, normalized);
  fs.writeFileSync(file, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
}

export function assertTransportSnapshot(name, calls) {
  const received = normalizeTransportSnapshot(calls);
  assertNoSensitiveSnapshotContent(`${name} (received)`, received);
  if (process.env.UPDATE_TRANSPORT_SNAPSHOTS === '1') {
    writeTransportSnapshot(name, calls);
    return;
  }
  const expected = loadTransportSnapshot(name);
  if (expected.length !== received.length) {
    assert.fail(`Snapshot ${name} divergiu: quantidade esperada=${expected.length}, recebida=${received.length}`);
  }
  for (let i = 0; i < expected.length; i += 1) {
    const diff = findDiff(expected[i], received[i]);
    if (diff) {
      const fieldRoot = String(diff.field || '').split(/[.[]/)[0] || 'unknown';
      assert.fail(
        `Snapshot ${name} divergiu na chamada #${i} (campo ${fieldRoot}; caminho ${diff.field || 'root'}). ` +
        `Esperado=${JSON.stringify(diff.expected)} Recebido=${JSON.stringify(diff.received)}`
      );
    }
  }
}
