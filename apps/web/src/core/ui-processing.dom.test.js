import test from 'node:test';
import assert from 'node:assert/strict';
import { flush, setupFrontendDom, teardownFrontendDom } from '../testing/frontend-test-helpers.js';
import { hideProcessing, showProcessing, updateProcessing, withProcessing } from './ui-processing.js';

test('ui-processing: show, update e hide controlam overlay singleton', async () => {
  const dom = setupFrontendDom('#/');

  showProcessing({ title: 'Carregando', message: 'Aguarde...' });
  assert.ok(document.querySelector('.nh-global-processing'));
  assert.match(document.body.textContent, /Carregando/);
  assert.match(document.body.textContent, /Aguarde/);

  updateProcessing({ title: 'Quase lá', message: 'Finalizando', progress: 70, indeterminate: false });
  assert.match(document.body.textContent, /Quase lá/);
  assert.match(document.body.textContent, /70%/);

  hideProcessing();
  assert.equal(document.querySelector('.nh-global-processing')?.hidden, true);

  teardownFrontendDom(dom);
});

test('ui-processing: withProcessing esconde overlay no sucesso e no erro', async () => {
  const dom = setupFrontendDom('#/');

  await withProcessing(() => Promise.resolve('ok'), { title: 'Processando', message: 'Teste' });
  await flush();
  assert.equal(document.querySelector('.nh-global-processing')?.hidden, true);

  let failed = false;
  try {
    await withProcessing(() => Promise.reject(new Error('falha')), { title: 'Processando', message: 'Teste' });
  } catch {
    failed = true;
  }
  assert.equal(failed, true);
  assert.equal(document.querySelector('.nh-global-processing')?.hidden, true);

  teardownFrontendDom(dom);
});
