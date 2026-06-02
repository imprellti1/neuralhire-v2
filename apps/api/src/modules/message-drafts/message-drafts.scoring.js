export function calculateConfidenceScore({
  daysWithoutPurchase = 0,
  opportunityCount = 0,
  alertCount = 0,
  frequency = 'media',
  hasRecurringProduct = false,
  actionScore = 0,
  memoryQuality = 0,
  contextCount = 0
} = {}) {
  let score = 35;
  if (daysWithoutPurchase > 120) score += 30;
  else if (daysWithoutPurchase > 60) score += 18;
  else if (daysWithoutPurchase > 15) score += 10;

  if (opportunityCount > 0) score += 12;
  if (hasRecurringProduct) score += 15;
  if (frequency === 'alta') score += 12;
  else if (frequency === 'media') score += 6;

  if (alertCount > 0) score -= Math.min(25, alertCount * 8);
  score += Math.max(0, Math.min(20, Math.round(actionScore / 5)));
  score += Math.max(0, Math.min(12, Math.round(memoryQuality / 8)));
  score += Math.max(0, Math.min(8, Math.round(contextCount / 2)));
  return Math.max(0, Math.min(100, Math.round(score)));
}
