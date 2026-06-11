import { asyncHandler } from '../../core/async-handler.js';
import { sendSuccess } from '../../core/response.js';
import { createIaMemoriaHandler, deleteIaMemoriaHandler, getIaMemoriaHandler, getIaMemoriasHandler, patchIaMemoriaHandler, searchIaMemoriasHandler } from './ia-memorias.controller.js';
import { createIaMemoriaSchema, updateIaMemoriaSchema } from './ia-memorias.schemas.js';

export function registerIaMemoriasRoutes(router) {
  router.registerRoute({ method: 'GET', path: '/ia-memorias', domain: 'ia-memorias', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getIaMemoriasHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/ia-memorias/search', domain: 'ia-memorias', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await searchIaMemoriasHandler(context))) });
  router.registerRoute({ method: 'GET', path: '/ia-memorias/:id', domain: 'ia-memorias', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await getIaMemoriaHandler(context))) });
  router.registerRoute({ method: 'POST', path: '/ia-memorias', domain: 'ia-memorias', schema: createIaMemoriaSchema, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await createIaMemoriaHandler(context))) });
  router.registerRoute({ method: 'PATCH', path: '/ia-memorias/:id', domain: 'ia-memorias', schema: updateIaMemoriaSchema, handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await patchIaMemoriaHandler(context))) });
  router.registerRoute({ method: 'DELETE', path: '/ia-memorias/:id', domain: 'ia-memorias', handler: asyncHandler(async (_req, res, context) => sendSuccess(res, await deleteIaMemoriaHandler(context))) });
}
