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
    'POST /clientes': () => createSuccessResponse({ item: { id: 'c1' } })
  };

  if (scenario === 'notFound') return createMockScenario(baseHandlers, { 'GET /clientes/c1': () => createNotFoundResponse('Cliente nao encontrado') }, overrides);
  if (scenario === 'serverError') return createMockScenario(baseHandlers, { 'GET /clientes/c1': () => createServerErrorResponse('Erro interno') }, overrides);
  if (scenario === 'createValidationError') return createMockScenario(baseHandlers, { 'POST /clientes': () => createValidationErrorResponse('Dados invalidos') }, overrides);
  if (scenario === 'createServerError') return createMockScenario(baseHandlers, { 'POST /clientes': () => createServerErrorResponse('Erro interno') }, overrides);
  return createMockScenario(baseHandlers, {}, overrides);
}
