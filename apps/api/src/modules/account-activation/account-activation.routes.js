import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getActivationStatusHandler } from './account-activation.controller.js';
export function registerAccountActivationRoutes(router){ router.registerRoute({method:'GET',path:'/accounts/:accountId/activation-status',domain:'account-activation',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getActivationStatusHandler(ctx)))}); }
