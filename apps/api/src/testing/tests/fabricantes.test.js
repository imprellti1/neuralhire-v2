import assert from 'node:assert/strict';
import { createCondicaoPagamento, createFabricante, getFabricanteById, listFabricantes, updateCondicaoPagamento, updateFabricante, __resetMemoryFabricantesForTests } from '../../modules/fabricantes/fabricantes.repository.js';

export function getFabricantesTests() {
  return [
    { name: 'cria fabricante', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica A', cnpj: '12.345.678/0001-90' }, { accountId: 'acc-1' });
      assert.equal(created.cnpj, '12345678000190');
    } },
    { name: 'lista fabricantes', run: async () => {
      __resetMemoryFabricantesForTests();
      await createFabricante({ nome: 'Fabrica A' }, { accountId: 'acc-1' });
      const listed = await listFabricantes({}, { accountId: 'acc-1' });
      assert.equal(listed.total, 1);
    } },
    { name: 'detalhe fabricante', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica B' }, { accountId: 'acc-1' });
      const detail = await getFabricanteById(created.id, { accountId: 'acc-1' });
      assert.equal(detail.nome, 'Fabrica B');
    } },
    { name: 'edita fabricante', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica C' }, { accountId: 'acc-1' });
      const updated = await updateFabricante(created.id, { nome: 'Fabrica D', site: 'https://fab.com', email_comercial: 'contato@fab.com', telefone: '11999990000', regiao_atendida: 'SP', logradouro: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '01000-000' }, { accountId: 'acc-1' });
      assert.equal(updated.nome, 'Fabrica D');
      assert.equal(updated.site, 'https://fab.com');
      assert.equal(updated.email_comercial, 'contato@fab.com');
      assert.equal(updated.telefone, '11999990000');
      assert.equal(updated.regiao_atendida, 'SP');
      assert.equal(updated.logradouro, 'Rua A');
    } },
    { name: 'cria fabricante com contato e site', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica C2', site: 'https://site.com', email_comercial: 'c2@site.com', telefone: '1133334444', regiao_atendida: 'BR', logradouro: 'Rua B', numero: '20', complemento: 'Apto 1', bairro: 'Centro', cidade: 'São Paulo', uf: 'SP', cep: '02000-000' }, { accountId: 'acc-1' });
      assert.equal(created.site, 'https://site.com');
      assert.equal(created.email_comercial, 'c2@site.com');
      assert.equal(created.telefone, '1133334444');
      assert.equal(created.regiao_atendida, 'BR');
      assert.equal(created.endereco_completo.includes('Rua B'), true);
    } },
    { name: 'valida nome obrigatório', run: async () => {
      __resetMemoryFabricantesForTests();
      await assert.rejects(() => createFabricante({ nome: '' }, { accountId: 'acc-1' }));
    } },
    { name: 'normaliza cnpj', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica E', cnpj: '11.222.333/0001-44' }, { accountId: 'acc-1' });
      assert.equal(created.cnpj, '11222333000144');
    } },
    { name: 'bloqueia valores negativos', run: async () => {
      __resetMemoryFabricantesForTests();
      await assert.rejects(() => createFabricante({ nome: 'Fabrica F', pedido_minimo: -1 }, { accountId: 'acc-1' }));
    } },
    { name: 'cria condição pagamento', run: async () => {
      __resetMemoryFabricantesForTests();
      const fab = await createFabricante({ nome: 'Fabrica G' }, { accountId: 'acc-1' });
      const cond = await createCondicaoPagamento(fab.id, { nome: '30 dias', parcelas: 3, valor_minimo: 100 }, { accountId: 'acc-1' });
      assert.equal(cond.parcelas, 3);
    } },
    { name: 'edita condição pagamento', run: async () => {
      __resetMemoryFabricantesForTests();
      const fab = await createFabricante({ nome: 'Fabrica H' }, { accountId: 'acc-1' });
      const cond = await createCondicaoPagamento(fab.id, { nome: '30 dias' }, { accountId: 'acc-1' });
      const updated = await updateCondicaoPagamento(fab.id, cond.id, { ativo: false }, { accountId: 'acc-1' });
      assert.equal(updated.ativo, false);
    } },
    { name: 'tenant isolation', run: async () => {
      __resetMemoryFabricantesForTests();
      const fab = await createFabricante({ nome: 'Fabrica I' }, { accountId: 'acc-1' });
      await assert.rejects(() => getFabricanteById(fab.id, { accountId: 'acc-2' }));
    } },
    { name: 'ignora account_id malicioso', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica J', account_id: 'bad' }, { accountId: 'acc-1' });
      assert.equal(created.account_id, 'acc-1');
    } },
    { name: 'deduplicação', run: async () => {
      __resetMemoryFabricantesForTests();
      await createFabricante({ nome: 'Fabrica K', cnpj: '111' }, { accountId: 'acc-1' });
      await assert.rejects(() => createFabricante({ nome: 'Fabrica K', cnpj: '222' }, { accountId: 'acc-1' }));
    } }
  ];
}
