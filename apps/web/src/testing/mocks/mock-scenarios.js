export function createMockScenario(baseHandlers, scenarioHandlers = {}, overrides = {}) {
  return { ...baseHandlers, ...scenarioHandlers, ...overrides };
}

export function createSuccessResponse(body) {
  return body;
}

export function createNotFoundResponse(message = 'Recurso nao encontrado') {
  return { __mockError: true, status: 404, body: { error: { message } } };
}

export function createValidationErrorResponse(message = 'Dados invalidos') {
  return { __mockError: true, status: 422, body: { error: { message } } };
}

export function createServerErrorResponse(message = 'Erro interno') {
  return { __mockError: true, status: 500, body: { error: { message } } };
}
