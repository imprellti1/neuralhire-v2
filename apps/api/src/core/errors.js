import { PAYLOAD_TOO_LARGE } from './http-status.js';
import {
  BAD_REQUEST,
  CONFLICT,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  SERVICE_UNAVAILABLE,
  UNAUTHORIZED,
  UNPROCESSABLE_ENTITY
} from './http-status.js';

export class AppError extends Error {
  constructor(message, {
    statusCode = INTERNAL_SERVER_ERROR,
    code = 'APP_ERROR',
    domain = 'core-platform',
    details = null,
    expose = true
  } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.domain = domain;
    this.details = details;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados invalidos', { details = null, domain = 'core-platform', code = 'VALIDATION_ERROR' } = {}) {
    const statusCode = code === 'PAYLOAD_TOO_LARGE' ? PAYLOAD_TOO_LARGE : UNPROCESSABLE_ENTITY;
    super(message, { statusCode, code, domain, details, expose: true });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso nao encontrado', { details = null, domain = 'core-platform', code = 'NOT_FOUND' } = {}) {
    super(message, { statusCode: NOT_FOUND, code, domain, details, expose: true });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Nao autorizado', { details = null, domain = 'autenticacao-contas', code = 'UNAUTHORIZED' } = {}) {
    super(message, { statusCode: UNAUTHORIZED, code, domain, details, expose: true });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso proibido', { details = null, domain = 'usuarios-permissoes', code = 'FORBIDDEN' } = {}) {
    super(message, { statusCode: FORBIDDEN, code, domain, details, expose: true });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de estado', { details = null, domain = 'core-platform', code = 'CONFLICT' } = {}) {
    super(message, { statusCode: CONFLICT, code, domain, details, expose: true });
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'Falha em servico externo', { details = null, domain = 'integracoes', code = 'EXTERNAL_SERVICE_ERROR' } = {}) {
    super(message, { statusCode: SERVICE_UNAVAILABLE, code, domain, details, expose: true });
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Requisicao invalida', { details = null, domain = 'core-platform', code = 'BAD_REQUEST' } = {}) {
    super(message, { statusCode: BAD_REQUEST, code, domain, details, expose: true });
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Erro de banco de dados', { details = null, domain = 'core-platform', code = 'DATABASE_ERROR' } = {}) {
    super(message, { statusCode: INTERNAL_SERVER_ERROR, code, domain, details, expose: true });
  }
}