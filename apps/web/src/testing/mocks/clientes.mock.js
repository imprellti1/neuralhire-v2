import { makeCliente } from '../fixtures.js';
import {
  createMockScenario,
  createNotFoundResponse,
  createServerErrorResponse,
  createSuccessResponse,
  createValidationErrorResponse
} from './mock-scenarios.js';

export function createClientesMockHandlers({ scenario = 'success', overrides = {} } = {}) {
  const baseHandlers = {
    'GET /clientes': () => ({ items: [makeCliente()], pagination: { page: 1, totalPages: 1, total: 1, limit: 10 } }),
    'GET /clientes/c1': () => createSuccessResponse({ item: makeCliente() }),
    'GET /pedidos': ({ query }) => {
      if (String(query.cliente_id || '') === 'c1') {
        return { items: [{ id: 'p1', cliente_id: 'c1', numero: '1001', status: 'confirmado', created_at: '2026-06-01T00:00:00.000Z', total: 123.45 }], pagination: { page: 1, totalPages: 1, total: 1, limit: Number(query.limit || 100) } };
      }
      return { items: [], pagination: { page: Number(query.page || 1), totalPages: 1, total: 0, limit: Number(query.limit || 100) } };
    },
    'POST /clientes': () => createSuccessResponse({ item: { id: 'c1' } })
  };

  if (scenario === 'notFound') return createMockScenario(baseHandlers, { 'GET /clientes/c1': () => createNotFoundResponse('Cliente nao encontrado') }, overrides);
  if (scenario === 'serverError') return createMockScenario(baseHandlers, { 'GET /clientes/c1': () => createServerErrorResponse('Erro interno') }, overrides);
  if (scenario === 'createValidationError') return createMockScenario(baseHandlers, { 'POST /clientes': () => createValidationErrorResponse('Dados invalidos') }, overrides);
  if (scenario === 'createServerError') return createMockScenario(baseHandlers, { 'POST /clientes': () => createServerErrorResponse('Erro interno') }, overrides);
  return createMockScenario(baseHandlers, {}, overrides);
}
