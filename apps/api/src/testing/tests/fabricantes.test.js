import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createCondicaoPagamento, createFabricante, deleteFabricanteVendedor, getFabricanteById, listFabricanteVendedores, listFabricantes, replaceFabricanteVendedores, updateCondicaoPagamento, updateFabricante, updateFabricanteVendedor, updateFabricanteLogo, __resetMemoryFabricantesForTests } from '../../modules/fabricantes/fabricantes.repository.js';
import { createVendedor, __resetMemoryVendedoresForTests } from '../../modules/vendedores/vendedores.repository.js';
import { env } from '../../config/env.js';

function createSupabaseMock() {
  const rows = new Map();
  const uploads = [];
  return {
    rows,
    uploads,
    storage: {
      listBuckets: async () => ({ data: [{ name: 'fabricantes-logos' }], error: null }),
      createBucket: async () => ({ data: null, error: null }),
      from: (bucket) => ({
        upload: async (objectPath, bytes, options) => {
          uploads.push({ bucket, objectPath, size: bytes.length, contentType: options?.contentType });
          return { data: { path: objectPath }, error: null };
        },
        getPublicUrl: (objectPath) => ({ data: { publicUrl: `https://supabase.local/storage/v1/object/public/${bucket}/${objectPath}` } })
      })
    },
    from: (table) => {
      if (table !== 'fabricantes') throw new Error(`Tabela nao suportada: ${table}`);
      const state = { filters: {} };
      return {
        insert: (payload) => ({
          select: () => ({
            single: async () => {
              const row = { id: `fab-${rows.size + 1}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...payload };
              rows.set(row.id, row);
              return { data: row, error: null };
            }
          })
        }),
        update: (payload) => ({
          eq: (field, value) => {
            state.filters[field] = value;
            return {
              eq: (field2, value2) => {
                state.filters[field2] = value2;
                return {
                  select: () => ({
                    single: async () => {
                      const row = rows.get(state.filters.id);
                      if (!row) return { data: null, error: { message: 'not found' } };
                      const next = { ...row, ...payload };
                      rows.set(row.id, next);
                      return { data: next, error: null };
                    }
                  })
                };
              },
              select: () => ({
                single: async () => {
                  const row = rows.get(state.filters.id);
                  if (!row) return { data: null, error: { message: 'not found' } };
                  const next = { ...row, ...payload };
                  rows.set(row.id, next);
                  return { data: next, error: null };
                }
              })
            };
          }
        }),
        select: () => ({
          eq: (field, value) => {
            state.filters[field] = value;
            return {
              eq: (field2, value2) => {
                state.filters[field2] = value2;
                return {
                  maybeSingle: async () => ({ data: rows.get(state.filters.id) || null, error: null })
                };
              },
              maybeSingle: async () => ({ data: rows.get(state.filters.id) || null, error: null })
            };
          }
        })
      };
    }
  };
}

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
    { name: 'persiste regras comerciais', run: async () => {
      __resetMemoryFabricantesForTests();
      const created = await createFabricante({ nome: 'Fabrica Regras', pedido_minimo_valor: 800, valor_minimo_duplicata: 1000, aceita_bonificacao: true, aceita_consignacao: true }, { accountId: 'acc-1' });
      assert.equal(created.pedido_minimo_valor, 800);
      assert.equal(created.valor_minimo_duplicata, 1000);
      assert.equal(created.aceita_bonificacao, true);
      assert.equal(created.aceita_consignacao, true);
      const updated = await updateFabricante(created.id, { pedido_minimo_valor: 900, valor_minimo_duplicata: 1500, aceita_bonificacao: false, aceita_consignacao: false }, { accountId: 'acc-1' });
      assert.equal(updated.pedido_minimo_valor, 900);
      assert.equal(updated.valor_minimo_duplicata, 1500);
      assert.equal(updated.aceita_bonificacao, false);
      assert.equal(updated.aceita_consignacao, false);
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
    { name: 'cria condição pagamento estruturada', run: async () => {
      __resetMemoryFabricantesForTests();
      const fab = await createFabricante({ nome: 'Fabrica G' }, { accountId: 'acc-1' });
      const cond = await createCondicaoPagamento(fab.id, { prazo: '30/60/90' }, { accountId: 'acc-1' });
      assert.equal(cond.condicoes_pagamento[0].parcelas, 3);
      assert.equal(cond.condicoes_pagamento[0].prazo_medio_dias, 60);
    } },
    { name: 'edita condição pagamento estruturada', run: async () => {
      __resetMemoryFabricantesForTests();
      const fab = await createFabricante({ nome: 'Fabrica H' }, { accountId: 'acc-1' });
      const created = await createCondicaoPagamento(fab.id, { prazo: '30/60' }, { accountId: 'acc-1' });
      const condId = created.condicoes_pagamento[0].id;
      const updated = await updateCondicaoPagamento(fab.id, condId, { prazo: '28/35/42/49' }, { accountId: 'acc-1' });
      assert.equal(updated.condicoes_pagamento[0].parcelas, 4);
      assert.equal(updated.condicoes_pagamento[0].prazo_medio_dias, 39);
    } },
    { name: 'rejeita prazo invalido', run: async () => {
      __resetMemoryFabricantesForTests();
      const fab = await createFabricante({ nome: 'Fabrica H2' }, { accountId: 'acc-1' });
      await assert.rejects(() => createCondicaoPagamento(fab.id, { prazo: '30/0' }, { accountId: 'acc-1' }));
      await assert.rejects(() => createCondicaoPagamento(fab.id, { prazo: '30//60' }, { accountId: 'acc-1' }));
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
    { name: 'upload de logo atualiza logo_url com storage real', run: async () => {
      const original = { ...env };
      const mock = createSupabaseMock();
      globalThis.__NEURALHIRE_SUPABASE_MOCK__ = mock;
      env.SUPABASE_URL = 'https://supabase.local';
      env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
      try {
        const created = await createFabricante({ nome: 'Fabrica Logo' }, { accountId: 'acc-logo' });
        const updated = await updateFabricanteLogo(created.id, { fileName: 'logo.png', mimeType: 'image/png', base64: Buffer.from('fakepng').toString('base64'), size: 7 }, { accountId: 'acc-logo' });
        assert.match(updated.logo_url, /fabricantes-logos\/acc-logo\//);
        assert.equal(mock.uploads[0].contentType, 'image/png');
      } finally {
        Object.assign(env, original);
        delete globalThis.__NEURALHIRE_SUPABASE_MOCK__;
      }
    } },
    { name: 'rejeita logo grande ou tipo invalido', run: async () => {
      __resetMemoryFabricantesForTests();
      const base = await createFabricante({ nome: 'Fabrica Base' }, { accountId: 'acc-1' });
      await assert.rejects(() => updateFabricanteLogo(base.id, { fileName: 'bad.gif', mimeType: 'image/gif', base64: 'AA==', size: 1 }, { accountId: 'acc-1' }));
      await assert.rejects(() => updateFabricanteLogo(base.id, { fileName: 'big.png', mimeType: 'image/png', base64: 'AA==', size: 3 * 1024 * 1024 }, { accountId: 'acc-1' }));
    } },
    { name: 'deduplicação', run: async () => {
      __resetMemoryFabricantesForTests();
      await createFabricante({ nome: 'Fabrica K', cnpj: '111' }, { accountId: 'acc-1' });
      await assert.rejects(() => createFabricante({ nome: 'Fabrica K', cnpj: '222' }, { accountId: 'acc-1' }));
    } },
    { name: 'vínculos fábrica-vendedor com regras', run: async () => {
      __resetMemoryFabricantesForTests();
      __resetMemoryVendedoresForTests();
      const fab = await createFabricante({ nome: 'Fabrica Vinculo' }, { accountId: 'acc-vinc' });
      const vend1 = await createVendedor({ nome: 'Vendedor 1', email: 'v1@ex.com' }, { accountId: 'acc-vinc' });
      const vend2 = await createVendedor({ nome: 'Vendedor 2', email: 'v2@ex.com' }, { accountId: 'acc-vinc' });
      const created = await replaceFabricanteVendedores(fab.id, [
        { vendedor_id: vend1.id, principal: true, status: 'ativo', comissao_percentual: 5, pedido_minimo_valor: 100, valor_minimo_duplicata: 50, condicoes_pagamento: [{ prazo: '30/60/90' }], observacoes: 'principal' },
        { vendedor_id: vend2.id, principal: false, status: 'ativo' }
      ], { accountId: 'acc-vinc' });
      assert.equal(created.total, 2);
      assert.equal(created.items[0].principal, true);
      const listed = await listFabricanteVendedores(fab.id, { accountId: 'acc-vinc' });
      assert.equal(listed.items.length, 2);
      assert.equal(listed.items[0].vendedor_nome, 'Vendedor 1');
      const updated = await updateFabricanteVendedor(fab.id, vend1.id, { comissao_percentual: 7 }, { accountId: 'acc-vinc' });
      assert.equal(updated.comissao_percentual, 7);
      await assert.rejects(() => replaceFabricanteVendedores(fab.id, [
        { vendedor_id: vend1.id, principal: true },
        { vendedor_id: vend2.id, principal: true }
      ], { accountId: 'acc-vinc' }));
      await deleteFabricanteVendedor(fab.id, vend2.id, { accountId: 'acc-vinc' });
    } }
  ];
}
