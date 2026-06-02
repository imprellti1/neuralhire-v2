import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';
import { __resetMemoryInterestLeadsForTests } from '../../modules/interest-leads/interest-leads.repository.js';

export function getInterestLeadsConvertTests(){return[{name:'converte lead com sucesso e bloqueia duplicado',run:async()=>{__resetMemoryInterestLeadsForTests();const app=createApiApp();let req=createTestRequest({method:'POST',url:'/interest-leads',headers:{'content-type':'application/json'},body:JSON.stringify({nome:'Ana',empresa:'Acme',email:'ana@acme.com'})});let res=createTestResponse();await app(req,res);const id=JSON.parse(res.body).item.id;req=createTestRequest({method:'POST',url:`/interest-leads/${id}/convert`});res=createTestResponse();await app(req,res);assertEqual(res.statusCode,200);const body=JSON.parse(res.body);assertEqual(body.status,'trial');req=createTestRequest({method:'GET',url:`/interest-leads/${id}`});res=createTestResponse();await app(req,res);const lead=JSON.parse(res.body).item;assertEqual(lead.status,'convertido');assertEqual(lead.invite_status,'convertido');req=createTestRequest({method:'POST',url:`/interest-leads/${id}/convert`});res=createTestResponse();await app(req,res);assertEqual(res.statusCode,409);}}];}
