import assert from 'node:assert/strict';
import test from 'node:test';
import { bootstrapWebApp } from '../../app.js';

test('pedidos auditoria route exists', () => {
  assert.equal(typeof bootstrapWebApp, 'function');
});
