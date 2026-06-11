import assert from 'node:assert/strict';
import { createIaMemoria, deleteIaMemoria, listIaMemorias, searchIaMemorias, updateIaMemoria, __resetMemoryIaMemoriasForTests } from './ia-memorias.repository.js';

export function getIaMemoriasTests() {
  return [
    {
      name: 'ia memorias backend basics',
      run: async () => {
      __resetMemoryIaMemoriasForTests();
      const a = await createIaMemoria({ tipo: 'regra_negocio', titulo: 'Regra', conteudo: 'x', account_id: 'evil', tags: ['a'] }, { accountId: 'acc-1' });
      assert.equal(a.account_id, 'acc-1');
      const b = await createIaMemoria({ tipo: 'bug_corrigido', titulo: 'Bug', conteudo: 'conteudo', modulo: 'web', tags: ['tag-1'] }, { accountId: 'acc-2' });
      await updateIaMemoria(b.id, { status: 'arquivada' }, { accountId: 'acc-2' });
      const list = await listIaMemorias({}, { accountId: 'acc-1' });
      assert.equal(list.items.length, 1);
      const search = await searchIaMemorias({ search: 'regra' }, { accountId: 'acc-1' });
      assert.equal(search.items.length, 1);
      await deleteIaMemoria(a.id, { accountId: 'acc-1' });
      const afterDelete = await listIaMemorias({}, { accountId: 'acc-1' });
      assert.equal(afterDelete.items.length, 0);
      }
    }
  ];
}
