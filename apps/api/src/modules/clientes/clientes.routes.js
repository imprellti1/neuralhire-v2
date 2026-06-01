import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { createClienteHandler, getClienteByIdHandler, getClientes } from './clientes.controller.js';
import { createClienteSchema } from './clientes.schemas.js';

export function registerClientesRoutes(router) {
  router.registerRoute({
    method: 'GET',
    path: '/clientes',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getClientes(context));
    })
  });

  router.registerRoute({
    method: 'GET',
    path: '/clientes/:id',
    domain: 'clientes-crm',
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await getClienteByIdHandler(context));
    })
  });

  router.registerRoute({
    method: 'POST',
    path: '/clientes',
    domain: 'clientes-crm',
    schema: createClienteSchema,
    handler: asyncHandler(async (req, res, context) => {
      sendSuccess(res, await createClienteHandler(context));
    })
  });
}
