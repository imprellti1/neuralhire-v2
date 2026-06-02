import test from 'node:test';
import assert from 'node:assert/strict';
import { renderInterestLeadDetailsPage } from '../interest-leads-details/interest-lead-details.page.js';
import { setupFrontendDom, teardownFrontendDom, flush } from '../../testing/frontend-test-helpers.js';

test('interest-leads convert card/button flow', async ()=>{const dom=setupFrontendDom('#/x');let converted=false;const apiClient={get:async(u)=>u.endsWith('/events')?({items:[]}):({item:{id:'1',nome:'Ana',empresa:'Acme',status:converted?'convertido':'novo'}}),patch:async()=>({}),post:async(u)=>{if(u.endsWith('/convert')) converted=true; return {status:'trial',subscriberRef:'acc-1',trialEndsAt:new Date().toISOString()};}};await renderInterestLeadDetailsPage(document.body,{apiClient,leadId:'1'});await flush();const btn=document.querySelector('#cv');btn.click();btn.click();await flush();assert.match(document.body.textContent,/convertido|sucesso/i);teardownFrontendDom(dom);});
