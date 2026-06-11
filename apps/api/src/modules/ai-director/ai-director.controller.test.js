import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveAiDirectorEventHandler, createAiDirectorEventHandler, getAiDirectorAgentsHandler, getAiDirectorOverviewHandler, markAiDirectorEventReadHandler } from './ai-director.controller.js';
import { __resetAiDirectorMemoryForTests } from './ai-director.repository.js';

test('ai director controller shapes overview agents and event lifecycle', async () => {
  __resetAiDirectorMemoryForTests();
  const overview = await getAiDirectorOverviewHandler();
  assert.equal(overview.ok, true);
  const agents = await getAiDirectorAgentsHandler();
  assert.equal(agents.ok, true);
  assert.equal(agents.gerentes[1].nome, 'Gerente de Produtos');
  const created = await createAiDirectorEventHandler({ body: { tipo: 'importacao com erro', entidade: 'importacao', titulo: 'Falha na importacao' } });
  const read = await markAiDirectorEventReadHandler({ params: { id: created.item.id } });
  const archived = await archiveAiDirectorEventHandler({ params: { id: created.item.id } });
  assert.equal(read.item.status, 'lido');
  assert.equal(archived.item.status, 'arquivado');
});
