import { assertEqual } from '../assert.js';
import { createApiApp } from '../../app.js';
import { createTestRequest } from '../create-test-request.js';
import { createTestResponse } from '../create-test-response.js';
import { __resetMemoryClientesForTests, createCliente } from '../../modules/clientes/clientes.repository.js';
import { __resetMemoryGruposComerciaisForTests, addClientesToGrupo, createGrupoComercial, deleteGrupoComercial, getGruposComerciaisByClienteId, listGrupoComercialClientes, listGruposComerciais, removeClienteFromGrupo, updateGrupoComercial } from '../../modules/grupos-comerciais/grupos-comerciais.repository.js';

const accountA = 'acc-grupos-a';
const accountB = 'acc-grupos-b';

function parseBody(res) { try { return JSON.parse(res.body || '{}'); } catch { return {}; } }
async function call(app, { method, url, accountId, body }) {
  const headers = { 'x-test-role': 'admin', 'x-test-account-id': accountId };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const req = createTestRequest({ method, url, headers, body: body !== undefined ? JSON.stringify(body) : null });
  const res = createTestResponse();
  await app(req, res);
  return { res, body: parseBody(res) };
}

export function getGruposComerciaisTests() {
  return [
    { name: 'criar grupo', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      const created = await createGrupoComercial({ nome: 'Grupo A', descricao: 'Desc' }, { accountId: accountA });
      assertEqual(created.nome, 'Grupo A');
    } },
    { name: 'listar grupos', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const listed = await listGruposComerciais({}, { accountId: accountA });
      assertEqual(listed.items.length, 1);
    } },
    { name: 'editar grupo', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      const created = await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const updated = await updateGrupoComercial(created.id, { nome: 'Grupo B' }, { accountId: accountA });
      assertEqual(updated.nome, 'Grupo B');
    } },
    { name: 'inativar grupo', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      const created = await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const updated = await deleteGrupoComercial(created.id, { accountId: accountA });
      assertEqual(updated.ativo, false);
    } },
    { name: 'vincular cliente sem duplicar', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      __resetMemoryClientesForTests();
      const grupo = await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-001', cidade: 'Campinas', estado: 'SP', documento: '12.345.678/0001-90' }, { accountId: accountA });
      await addClientesToGrupo(grupo.id, [cliente.id, cliente.id], { accountId: accountA });
      const links = await getGruposComerciaisByClienteId(cliente.id, { accountId: accountA });
      assertEqual(links.length, 1);
    } },
    { name: 'listar clientes do grupo inclui cliente aninhado', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      __resetMemoryClientesForTests();
      const grupo = await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const cliente = await createCliente({ nome: 'Cliente A', codigo: 'CLI-001', cidade: 'Campinas', estado: 'SP', documento: '12.345.678/0001-90' }, { accountId: accountA });
      await addClientesToGrupo(grupo.id, [cliente.id], { accountId: accountA });
      const result = await listGrupoComercialClientes(grupo.id, { accountId: accountA });
      assertEqual(result.items.length, 1);
      assertEqual(result.items[0].cliente.id, cliente.id);
      assertEqual(result.items[0].cliente.nome, 'Cliente A');
      assertEqual(result.items[0].cliente.codigo, 'CLI-001');
      assertEqual(result.items[0].cliente.cidade, 'Campinas');
      assertEqual(result.items[0].cliente.estado, 'SP');
    } },
    { name: 'remover vínculo', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      __resetMemoryClientesForTests();
      const grupo = await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const cliente = await createCliente({ nome: 'Cliente A' }, { accountId: accountA });
      await addClientesToGrupo(grupo.id, [cliente.id], { accountId: accountA });
      await removeClienteFromGrupo(grupo.id, cliente.id, { accountId: accountA });
      const links = await getGruposComerciaisByClienteId(cliente.id, { accountId: accountA });
      assertEqual(links.length, 0);
    } },
    { name: 'isolamento account_id', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      __resetMemoryClientesForTests();
      const grupo = await createGrupoComercial({ nome: 'Grupo A' }, { accountId: accountA });
      const cliente = await createCliente({ nome: 'Cliente A' }, { accountId: accountB });
      await addClientesToGrupo(grupo.id, [cliente.id], { accountId: accountA }).catch(() => null);
      const links = await getGruposComerciaisByClienteId(cliente.id, { accountId: accountA });
      assertEqual(links.length, 0);
    } },
    { name: 'GET /grupos-comerciais retorna itens', run: async () => {
      __resetMemoryGruposComerciaisForTests();
      const app = createApiApp();
      await call(app, { method: 'POST', url: '/grupos-comerciais', accountId: accountA, body: { nome: 'Grupo A' } });
      const out = await call(app, { method: 'GET', url: '/grupos-comerciais', accountId: accountA });
      assertEqual(out.res.statusCode, 200);
      assertEqual(out.body.items.length, 1);
    } }
  ];
}
