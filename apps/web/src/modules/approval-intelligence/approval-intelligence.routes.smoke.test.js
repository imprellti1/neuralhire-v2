import { bootstrapWebApp } from '../../app.js';
import assert from 'node:assert/strict';

export async function run() {
  const previous = window.location.hash;
  document.body.innerHTML = '';
  window.location.hash = '#/approval-intelligence';
  bootstrapWebApp();
  assert(document.body.textContent.includes('Approval Intelligence'));
  window.location.hash = previous;
}
