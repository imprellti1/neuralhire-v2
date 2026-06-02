import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getCustomerSuccessAutomationHandler } from './customer-success-automation.controller.js';
export function registerCustomerSuccessAutomationRoutes(router){router.registerRoute({method:'GET',path:'/accounts/:accountId/customer-success-automation',domain:'customer-success',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getCustomerSuccessAutomationHandler(ctx)))});}
