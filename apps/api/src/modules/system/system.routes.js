import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import {
  echoSystemMessage,
  getAdminOnlySystem,
  getAuthContext,
  getProtectedSystem,
  getSystemInfo
} from './system.controller.js';

const echoSchema = {
  message: {
    required: true,
    type: 'string',
    minLength: 1,
    maxLength: 200
  }
};

export function registerSystemRoutes(router, { registeredModules = [], globalMiddlewares = [] } = {}) {
  router.registerRoute({
    method: 'GET',
    path: '/system/info',
    domain: 'core-platform',
    handler: asyncHandler(async (req, res) => {
      sendSuccess(res, getSystemInfo(registeredModules, globalMiddlewares));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/system/auth-context',
    domain: 'autenticacao-contas',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, getAuthContext(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/system/protected',
    domain: 'autenticacao-contas',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, getProtectedSystem(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/system/admin-only',
    domain: 'usuarios-permissoes',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, getAdminOnlySystem(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/system/echo',
    domain: 'core-platform',
    schema: echoSchema,
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, echoSystemMessage(context));
    })
  });
}
