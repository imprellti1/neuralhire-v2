import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryAlertasForTests } from '../../modules/clientes/clientes.alerts.service.js';
import { __resetMemoryTimelineForTests } from '../../modules/clientes/clientes.timeline.service.js';

export function getClientesTimelineTests() {
  return [{
    name: 'timeline registra e lista eventos do cliente em ordem decrescente',
    run: async () => {
      __resetMemoryClientesForTests();
      __resetMemoryAlertasForTests();
      __resetMemoryTimelineForTests();
      const app = createApiApp();
      const accountId = 'acc-timeline';
      const cliente = await createCliente({ nome: 'Cliente Timeline' }, { accountId });

      let req = createTestRequest({ method: 'GET', url: `/clientes/${cliente.id}/timeline`, headers: { 'x-account-id': accountId } });
      let res = createTestResponse();
      await app(req, res);
      assert.equal(res.statusCode, 200);
      let payload = JSON.parse(res.body);
      assert.equal((payload.data || payload.item || payload).items.length, 0);

      req = createTestRequest({ method: 'POST', url: `/clientes/${cliente.id}/enriquecer`, headers: { 'x-account-id': accountId } });
      res = createTestResponse();
      await app(req, res);

      req = createTestRequest({ method: 'GET', url: `/clientes/${cliente.id}/timeline`, headers: { 'x-account-id': accountId } });
      res = createTestResponse();
      await app(req, res);
      payload = JSON.parse(res.body);
      const items = (payload.data || payload.item || payload).items;
      assert.ok(items.length >= 1);
      assert.equal(items[0].categoria, 'enriquecimento');
      assert.equal(items.every((item, index, array) => index === 0 || new Date(array[index - 1].created_at) >= new Date(item.created_at)), true);
    }
  }];
}
