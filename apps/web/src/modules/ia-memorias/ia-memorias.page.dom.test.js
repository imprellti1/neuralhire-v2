import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bootstrapWebApp } from '../../app.js';
import { dispatchChange, dispatchInput, findButtonByText, flush, mockAuthenticatedSession, setupFrontendDom, teardownFrontendDom } from '../../testing/frontend-test-helpers.js';

async function waitForText(pattern, tries = 10) {
  for (let i = 0; i < tries; i += 1) {
    if (pattern.test(document.body.textContent || '')) return true;
    await flush();
  }
  return pattern.test(document.body.textContent || '');
}

test('ia memorias page render, create, filter and archive', async () => {
  const dom = setupFrontendDom('#/ia-memorias', 'app.neuralhire.com.br');
  mockAuthenticatedSession();
  let items = [{ id: '1', tipo: 'regra_negocio', titulo: 'Regra A', conteudo: 'Conteudo A', tags: ['tag1'], modulo: 'API', prioridade: 1, status: 'ativa' }];
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const key = `${(options.method || 'GET').toUpperCase()} ${path}`;
    calls.push(key);
    if (key === 'GET /ia-memorias') return new Response(JSON.stringify({ ok: true, items }), { status: 200 });
    if (key === 'POST /ia-memorias') { items = [...items, { id: '2', tipo: 'operacional', titulo: 'Nova', conteudo: 'x', tags: [], modulo: 'web', prioridade: 0, status: 'ativa' }]; return new Response(JSON.stringify({ ok: true, item: items[1] }), { status: 200 }); }
    if (key === 'DELETE /ia-memorias/1') { items = items.filter((i) => i.id !== '1'); return new Response(JSON.stringify({ ok: true, item: { id: '1', status: 'arquivada' } }), { status: 200 }); }
    if (key === 'PATCH /ia-memorias/1') return new Response(JSON.stringify({ ok: true, item: items[0] }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, items: [] }), { status: 200 });
  };
  window.fetch = fetchMock;
  global.fetch = fetchMock;
  bootstrapWebApp();
  await waitForText(/Regra A/);
  assert.match(document.body.textContent, /Memória IA/);
  assert.match(document.body.textContent, /Regra A/);
  dispatchInput(document.querySelector('#ia-filter-search'), 'Regra');
  await waitForText(/Regra A/);
  assert.ok(document.body.textContent.includes('Regra A'));
  findButtonByText('Nova memória')?.click();
  await flush();
  const form = document.querySelector('.ia-form');
  dispatchInput(form.querySelector('#ia-tipo'), 'operacional');
  dispatchInput(form.querySelector('#ia-titulo'), 'Nova');
  dispatchInput(form.querySelector('#ia-conteudo'), 'x');
  dispatchInput(form.querySelector('#ia-modulo'), 'web');
  dispatchInput(form.querySelector('#ia-tags'), 'tag2');
  dispatchInput(form.querySelector('#ia-prioridade'), '0');
  dispatchInput(form.querySelector('#ia-origem'), 'manual');
  document.querySelector('#ia-save').click();
  await flush(); await flush(); await flush();
  await waitForText(/Nova/);
  assert.ok(calls.includes('POST /ia-memorias'));
  document.querySelector('[data-archive="1"]').click();
  await flush(); await flush();
  await waitForText(/Nova/);
  assert.ok(calls.includes('DELETE /ia-memorias/1'));
  teardownFrontendDom(dom);
});
