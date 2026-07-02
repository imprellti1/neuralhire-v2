import assert from 'node:assert/strict';
import test from 'node:test';
import { mapClienteDetailsData } from './cliente-details.mapper.js';

test('cliente details mapper normaliza payload de presença digital', () => {
  const mapped = mapClienteDetailsData({
    clienteId: 'c1',
    cliente: {
      id: 'c1',
      empresa: 'Cliente A',
      site: 'https://clientea.com.br',
      digital_enrichment_status: 'concluido',
      digital_enrichment_updated_at: '2026-07-01T10:00:00.000Z',
      digital_enrichment_payload: {
        contacts: { emails: ['a@a.com'], phones: ['(11) 99999-9999'], whatsapp: ['(11) 99999-9999'] },
        social: { instagram: ['https://instagram.com/clientea'] },
        company: { description: 'Empresa de moda', categories: ['roupas'], brands: ['Marca X'] },
        commercial: { has_ecommerce: true, has_catalog: false, product_links: ['https://clientea.com.br/produto'] },
        sources: [{ url: 'https://clientea.com.br' }],
        confidence: { site: 100 }
      }
    },
    pedidos: []
  });

  assert.equal(mapped.site, 'https://clientea.com.br');
  assert.equal(mapped.digital_enrichment_status, 'concluido');
  assert.equal(mapped.digital_enrichment_payload.contacts.emails[0], 'a@a.com');
  assert.equal(mapped.digital_enrichment_payload.commercial.has_ecommerce, true);
  assert.equal(mapped.digital_enrichment_payload.company.categories[0], 'roupas');
});
