import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryInterestLeadsForTests } from '../../modules/interest-leads/interest-leads.repository.js';

export function getLaunchPreviewTests(){return[{name:'POST /launch/preview gera preview',run:async()=>{__resetMemoryInterestLeadsForTests();const app=createApiApp();let req=createTestRequest({method:'POST',url:'/interest-leads',headers:{'content-type':'application/json'},body:JSON.stringify({nome:'Ana',empresa:'Acme',email:'ana@acme.com',cidade:'SP',estado:'SP'})});let res=createTestResponse();await app(req,res);const leadId=JSON.parse(res.body).item.id;req=createTestRequest({method:'POST',url:'/launch/templates',headers:{'content-type':'application/json'},body:JSON.stringify({channel:'email',name:'T',subject:'Olá {{nome}}',body:'Cidade {{cidade}}',status:'active'})});res=createTestResponse();await app(req,res);const templateId=JSON.parse(res.body).item.id;req=createTestRequest({method:'POST',url:'/launch/preview',headers:{'content-type':'application/json'},body:JSON.stringify({leadId,templateId})});res=createTestResponse();await app(req,res);assertEqual(res.statusCode,200);const body=JSON.parse(res.body);assertEqual(body.item.subject,'Olá Ana');}}];}
