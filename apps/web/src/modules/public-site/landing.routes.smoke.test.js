import test from 'node:test';
import assert from 'node:assert/strict';
import { bootstrapWebApp } from '../../app.js';
import { flush, setHash, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';
import { getSanitizedFetchCalls, installFetchMock } from '../../testing/mocks/api-client.mock.js';

test('landing publica 55B: conversao, validacao mock e sem api', async () => {
  const dom = setupFrontendDom('#/');
  installFetchMock({});
  bootstrapWebApp();
  await flush(); await flush();

  assert.match(document.body.textContent, /A nova geração da representação comercial chegou/i);
  assert.match(document.body.textContent, /Entrar na Lista de Interesse/i);
  assert.match(document.body.textContent, /15 dias grátis/i);
  assert.match(document.body.textContent, /Agentes Comerciais de IA/i);
  assert.ok(document.querySelector('#interest-form'));

  document.querySelector('#interest-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  assert.match(document.querySelector('#interest-feedback').textContent, /Preencha Nome, Empresa e pelo menos WhatsApp ou E-mail/i);

  document.querySelector('input[name="nome"]').value = 'Ana';
  document.querySelector('input[name="empresa"]').value = 'Acme';
  document.querySelector('input[name="email"]').value = 'ana@acme.com';
  document.querySelector('#interest-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await flush();
  assert.match(document.querySelector('#interest-feedback').textContent, /Interesse registrado nesta prévia/i);

  const text = document.body.textContent;
  assert.doesNotMatch(text, /checkout/i);
  assert.doesNotMatch(text, /contratação imediata/i);
  assert.equal(getSanitizedFetchCalls().length, 0);

  setHash('#/produtos');
  await flush(); await flush();
  assert.match(document.body.textContent, /Produtos/i);

  setHash('#/clientes');
  await flush(); await flush();
  assert.match(document.body.textContent, /Clientes/i);

  setHash('#/pedidos');
  await flush(); await flush();
  assert.match(document.body.textContent, /Pedidos/i);

  teardownFrontendDom(dom);
});
