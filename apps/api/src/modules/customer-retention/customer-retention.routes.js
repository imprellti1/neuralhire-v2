import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getCustomerRetentionHandler } from './customer-retention.controller.js';
export function registerCustomerRetentionRoutes(router){router.registerRoute({method:'GET',path:'/accounts/:accountId/customer-retention',domain:'customer-success',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getCustomerRetentionHandler(ctx)))});}
