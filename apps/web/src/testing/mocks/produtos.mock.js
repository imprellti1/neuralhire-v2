import { makeProduto, makePedido, makePedidoItem } from '../fixtures.js';
import {
  createMockScenario,
  createNotFoundResponse,
  createServerErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse
} from './mock-scenarios.js';

export function createProdutosMockHandlers({ scenario = 'success' } = {}) {
  const baseHandlers = {
    'GET /produtos': () => ({ items: [makeProduto()], pagination: { page: 1, totalPages: 1, total: 1, limit: 10 } }),
    'GET /produtos/p1': () => createSuccessResponse({ item: makeProduto() }),
    'GET /produtos/p1/imagens': () => createSuccessResponse({ items: [{ id: 'img-1', produto_id: 'p1', variacao_id: null, url: 'https://example.com/img.jpg', storage_path: 'acc/p1/pai/img.jpg', ordem: 0, principal: true, tipo: 'image' }] }),
    'POST /produtos': ({ body }) => createSuccessResponse({ item: body?.nome === 'SemID' ? {} : { id: 'p1' } }),
    'PATCH /produtos/p1': ({ body }) => ({ item: makeProduto({ ...body, updated_at: '2026-05-03T00:00:00.000Z' }) }),
    'POST /produtos/p1/imagens': ({ body }) => createSuccessResponse({ item: { id: 'img-new', produto_id: 'p1', ...body } }),
    'PATCH /produtos/p1/imagens/img-1': ({ body }) => createSuccessResponse({ item: { id: 'img-1', produto_id: 'p1', ...body } }),
    'DELETE /produtos/p1/imagens/img-1': () => createSuccessResponse({ removed: true })
  };

  if (scenario === 'notFound') return createMockScenario(baseHandlers, { 'GET /produtos/p1': () => createNotFoundResponse('Produto nao encontrado') });
  if (scenario === 'serverError') return createMockScenario(baseHandlers, { 'GET /produtos/p1': () => createServerErrorResponse('Erro interno') });
  if (scenario === 'validationError') return createMockScenario(baseHandlers, { 'PATCH /produtos/p1': () => createValidationErrorResponse('Dados invalidos') });
  return createMockScenario(baseHandlers);
}

export function createProdutoUsageMockData() {
  return {
    pedidos: [
      makePedido({ id: 'ped-1', numero: 'P001', status: 'faturado', created_at: '2026-05-28T10:00:00.000Z', cliente_nome: 'Acme' }),
      makePedido({ id: 'ped-2', numero: 'P002', status: 'aprovado', created_at: '2026-05-10T10:00:00.000Z', cliente_nome: 'Beta' })
    ],
    detalhes: {
      'ped-1': [makePedidoItem({ produto_id: 'p1', quantidade: 2, preco_unitario: 10, total: 20 })],
      'ped-2': [makePedidoItem({ produto_id: 'p1', quantidade: 1, preco_unitario: 15, total: 15 })]
    }
  };
}
