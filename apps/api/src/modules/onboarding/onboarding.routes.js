import { asyncHandler } from '../../core/async-handler.js'; import { sendSuccess } from '../../core/response.js';
import { getOnboardingHandler,startOnboardingHandler,patchOnboardingStepHandler,completeOnboardingHandler } from './onboarding.controller.js';
export function registerOnboardingRoutes(router){
router.registerRoute({method:'GET',path:'/accounts/:accountId/onboarding',domain:'onboarding',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await getOnboardingHandler(ctx)))});
router.registerRoute({method:'POST',path:'/accounts/:accountId/onboarding/start',domain:'onboarding',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await startOnboardingHandler(ctx)))});
router.registerRoute({method:'PATCH',path:'/accounts/:accountId/onboarding/step',domain:'onboarding',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await patchOnboardingStepHandler(ctx)))});
router.registerRoute({method:'POST',path:'/accounts/:accountId/onboarding/complete',domain:'onboarding',handler:asyncHandler(async(req,res,ctx)=>sendSuccess(res,await completeOnboardingHandler(ctx)))});
}
