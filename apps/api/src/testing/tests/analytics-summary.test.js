import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { assertEqual } from '../assert.js';

const parse = (res) => { try { return JSON.parse(res.body || '{}'); } catch { return {}; } };
async function call(app, method, url, role, accountId, body) { const headers = { 'x-test-role': role, 'x-test-account-id': accountId }; if (body) headers['content-type'] = 'application/json'; const req = createTestRequest({ method, url, headers, body: body ? JSON.stringify(body) : null }); const res = createTestResponse(); await app(req, res); return { res, body: parse(res) }; }

export function getAnalyticsSummaryTests() { return [{ name: 'summary calcula totais e status', run: async () => { const app = createApiApp();
const c = await call(app,'POST','/clientes','admin','acc-ana',{ nome: 'C1' }); const p = await call(app,'POST','/produtos','admin','acc-ana',{ nome: 'P1', preco: 100 });
await call(app,'POST','/pedidos','admin','acc-ana',{ cliente_id: c.body.item.id, itens:[{ produto_id:p.body.item.id, quantidade:2, preco_unitario:50 }], status:'rascunho' });
await call(app,'POST','/pedidos','admin','acc-ana',{ cliente_id: c.body.item.id, itens:[{ produto_id:p.body.item.id, quantidade:1, preco_unitario:100 }], status:'aprovado' });
const out = await call(app,'GET','/analytics/summary','manager','acc-ana');
assertEqual(out.res.statusCode,200); assertEqual(out.body.totalPedidos,2); assertEqual(out.body.totalFaturado,300); assertEqual(out.body.ticketMedio,150); assertEqual(out.body.pedidosPorStatus.rascunho,1); assertEqual(out.body.pedidosPorStatus.aprovado,1);
}}]; }
