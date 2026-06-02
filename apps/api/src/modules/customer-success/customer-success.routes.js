import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getCustomerSuccessHandler } from './customer-success.controller.js';
export function registerCustomerSuccessRoutes(router){router.registerRoute({method:'GET',path:'/accounts/:accountId/customer-success',domain:'customer-success',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getCustomerSuccessHandler(ctx)))});}
