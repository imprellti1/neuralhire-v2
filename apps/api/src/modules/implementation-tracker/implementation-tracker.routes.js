import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getImplementationStatusHandler } from './implementation-tracker.controller.js';
export function registerImplementationTrackerRoutes(router){router.registerRoute({method:'GET',path:'/accounts/:accountId/implementation-status',domain:'implementation',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getImplementationStatusHandler(ctx)))});}
