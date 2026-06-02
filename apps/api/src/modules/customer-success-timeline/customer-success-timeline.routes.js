import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getCustomerSuccessTimelineHandler } from './customer-success-timeline.controller.js';
export function registerCustomerSuccessTimelineRoutes(router){router.registerRoute({method:'GET',path:'/accounts/:accountId/customer-success-timeline',domain:'customer-success-timeline',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getCustomerSuccessTimelineHandler(ctx)))});}
