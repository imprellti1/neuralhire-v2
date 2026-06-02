import test from 'node:test';
import assert from 'node:assert/strict';
import { renderLaunchTemplatesPage } from './launch-templates.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('launch-templates page dom: list/create/edit/archive/preview', async ()=>{
  const dom = setupFrontendDom('#/x');
  const templates=[];
  const apiClient={
    get:async(u)=>{
      if(u==='/launch/templates') return {items:templates};
      if(u==='/interest-leads') return {items:[{id:'lead-1',nome:'Ana'}],pagination:{}};
      return {items:[]};
    },
    post:async(u,b)=>{
      if(u==='/launch/templates'){ const t={id:'t1',...b,updated_at:'now'}; templates.push(t); return {item:t}; }
      if(u==='/launch/preview') return {item:{subject:'Olá Ana',body:'Oi Ana'}};
      return {};
    },
    patch:async()=>({item:{}}),
    delete:async()=>({item:{}})
  };
  await renderLaunchTemplatesPage(document.body,{apiClient}); await flush();
  assert.match(document.body.textContent,/Templates de Lancamento/);
  teardownFrontendDom(dom);
});
