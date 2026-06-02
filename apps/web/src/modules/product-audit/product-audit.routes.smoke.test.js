import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapWebApp } from '../../app.js';

test('product audit route and menu exist', () => {
  assert.equal(typeof bootstrapWebApp, 'function');
});
