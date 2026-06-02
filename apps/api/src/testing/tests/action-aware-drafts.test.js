import assert from 'node:assert/strict';
import { generateDraft } from '../../modules/message-drafts/message-drafts.engine.js';

export function getActionAwareDraftsTests() {
  return [
    {
      name: 'draft baseado em action comercial',
      run: async () => {
        const draft = generateDraft({
          action: { id: 'act-1', actionType: 'reactivation', confidence_score: 91, reason: 'Cliente está há 147 dias sem comprar.' },
          customerMemory: { commercial: { diasSemCompra: 147 }, behavior: { frequenciaCompra: 'baixa' }, products: { recorrentes: [] }, alerts: [], opportunities: [] },
          conversationStatus: 'open'
        });
        assert.equal(draft.draftType, 'reactivation');
        assert.equal(draft.action.type, 'reactivation');
        assert.equal(draft.action.id, 'act-1');
      }
    },
    {
      name: 'draft context inclui action e memoria',
      run: async () => {
        const draft = generateDraft({
          action: { id: 'act-2', actionType: 'cross_sell', confidence_score: 76, reason: 'Fabricantes não explorados.' },
          customerMemory: { commercial: { diasSemCompra: 21 }, behavior: { frequenciaCompra: 'media' }, manufacturers: { favoritos: [{ nome: 'Marca A' }] }, products: { recorrentes: [] }, alerts: [{ title: 'alerta' }], opportunities: [{ title: 'oportunidade' }] },
          conversationStatus: 'open'
        });
        assert.equal(draft.context.customerMemory.commercial.diasSemCompra, 21);
        assert.equal(draft.context.action.actionType, 'cross_sell');
      }
    }
  ];
}
