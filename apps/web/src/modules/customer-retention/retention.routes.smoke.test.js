import { bootstrapWebApp } from '../../app.js';
import { assert } from '../../testing/frontend-test-helpers.js';

export async function run(){
  const originalHash=window.location.hash;
  document.body.innerHTML='';
  window.location.hash='#/customer-retention';
  bootstrapWebApp();
  assert(document.body.textContent.includes('Renovacoes & Expansao'));
  window.location.hash=originalHash;
}
