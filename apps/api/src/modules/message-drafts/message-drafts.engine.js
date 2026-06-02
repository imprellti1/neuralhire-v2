import { calculateConfidenceScore } from './message-drafts.scoring.js';
import { buildCrossSellTemplate, buildFollowupTemplate, buildGenericTemplate, buildReactivationTemplate, buildReplenishmentTemplate, buildRelationshipTemplateWithAction, buildRiskRecoveryTemplate, buildUpsellTemplate } from './message-drafts.templates.js';

export function buildContext({ customerMemory = {}, opportunities = [], alerts = [], conversationSummary = {} } = {}) {
  return { customerMemory, opportunities, alerts, conversationSummary };
}

export function generateDraft(input = {}) {
  const action = input.action || input.commercialAction || {};
  const actionType = String(action.actionType || action.action_type || action.type || '').trim();
  const memory = input.customerMemory || {};
  const commercial = memory.commercial || {};
  const behavior = memory.behavior || {};
  const products = memory.products || {};
  const alerts = input.alerts || memory.alerts || [];
  const opportunities = input.opportunities || memory.opportunities || [];
  const daysWithoutPurchase = Number(commercial.diasSemCompra || 0);
  const hasRecurringProduct = Array.isArray(products.recorrentes) && products.recorrentes.length > 0;
  const recurringProduct = hasRecurringProduct ? String(products.recorrentes[0]?.nome || products.recorrentes[0] || 'o item recorrente').trim() : null;
  const recommendedManufacturers = Array.isArray(action.recommendation?.recommendedManufacturers) ? action.recommendation.recommendedManufacturers : Array.isArray(memory.manufacturers?.favoritos) ? memory.manufacturers.favoritos.map((item) => item?.nome || item).filter(Boolean) : [];
  const actionReason = String(action.reason || action.recommendation?.reason || '').trim();

  let template;
  if (actionType === 'reactivation') template = buildReactivationTemplate(input);
  else if (actionType === 'replenishment') template = buildReplenishmentTemplate({ recurringProduct, recommendedManufacturers });
  else if (actionType === 'upsell') template = buildUpsellTemplate({ actionReason });
  else if (actionType === 'cross_sell') template = buildCrossSellTemplate({ recommendedManufacturers });
  else if (actionType === 'relationship') template = buildRelationshipTemplateWithAction({ actionReason });
  else if (actionType === 'risk_recovery') template = buildRiskRecoveryTemplate({ actionReason });
  else if (daysWithoutPurchase > 120) template = buildReactivationTemplate(input);
  else if (hasRecurringProduct && behavior.frequenciaCompra === 'alta' && daysWithoutPurchase > 0) template = buildReplenishmentTemplate({ recurringProduct, recommendedManufacturers });
  else if ((input.conversationStatus || '').toLowerCase() === 'open' && alerts.length === 0) template = buildRelationshipTemplateWithAction(input);
  else if (daysWithoutPurchase > 15) template = buildFollowupTemplate(input);
  else template = buildGenericTemplate(input);

  const memoryQuality = [daysWithoutPurchase, hasRecurringProduct ? 1 : 0, opportunities.length, alerts.length].reduce((acc, value) => acc + Number(value || 0), 0);
  const confidence = calculateConfidenceScore({
    daysWithoutPurchase,
    opportunityCount: opportunities.length,
    alertCount: alerts.length,
    frequency: behavior.frequenciaCompra,
    hasRecurringProduct,
    actionScore: Number(action.confidence_score || action.confidence || 0),
    memoryQuality,
    contextCount: Object.keys(buildContext(input)).length
  });
  const context = { customerMemory: memory, action, opportunities, alerts };
  return {
    draftType: template.draftType,
    draftText: template.draftText,
    reason: template.reason,
    action: actionType ? {
      id: action.id || action.action_id || null,
      type: actionType,
      confidence: Number(action.confidence_score || action.confidence || 0),
      reason: actionReason
    } : null,
    confidenceScore: confidence,
    context
  };
}
