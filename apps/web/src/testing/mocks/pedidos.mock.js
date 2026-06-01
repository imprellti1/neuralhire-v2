import { makePedido, makePedidoItem } from '../fixtures.js';
import {
  createMockScenario,
  createNotFoundResponse,
  createServerErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse
} from './mock-scenarios.js';

export function createPedidosMockHandlers({ scenario = 'success', overrides = {} } = {}) {
  const baseHandlers = {
    'GET /pedidos': () => ({ items: [makePedido({ id: 'p1', itens: [] })], pagination: { page: 1, totalPages: 1, total: 1, limit: 10 } }),
    'GET /pedidos/p1': () => createSuccessResponse({ item: makePedido({ id: 'p1', itens: [makePedidoItem()] }) }),
    'PATCH /pedidos/p1/status': () => createSuccessResponse({ item: { id: 'p1', status: 'faturado' } })
  };

  if (scenario === 'notFound') return createMockScenario(baseHandlers, { 'GET /pedidos/p1': () => createNotFoundResponse('Pedido nao encontrado') }, overrides);
  if (scenario === 'serverError') return createMockScenario(baseHandlers, { 'GET /pedidos/p1': () => createServerErrorResponse('Erro interno') }, overrides);
  if (scenario === 'statusValidationError') return createMockScenario(baseHandlers, { 'PATCH /pedidos/p1/status': () => createValidationErrorResponse('Dados invalidos') }, overrides);
  if (scenario === 'statusServerError') return createMockScenario(baseHandlers, { 'PATCH /pedidos/p1/status': () => createServerErrorResponse('Erro interno') }, overrides);
  return createMockScenario(baseHandlers, {}, overrides);
}
