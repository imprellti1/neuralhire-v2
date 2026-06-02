export const COMMERCIAL_AGENT_ACTION_TYPES = [
  'reactivation',
  'replenishment',
  'followup',
  'upsell',
  'cross_sell',
  'relationship',
  'risk_recovery'
];

export function pickActionFromSignals(signals = {}) {
  if ((signals.diasSemCompra || 0) > 120) return 'reactivation';
  if ((signals.recurringProductCount || 0) > 0 && (signals.daysAboveAverageReorder || 0) > 0) return 'replenishment';
  if (signals.activeCustomer && (signals.ticketTrend || 0) > 0) return 'upsell';
  if ((signals.brandAUsed || 0) > 0 && (signals.brandBMissing || 0) > 0) return 'cross_sell';
  if ((signals.riskLevel || '') === 'alto' && (signals.frequencyTrend || 0) < 0) return 'risk_recovery';
  if (signals.activeCustomer && !signals.alertCount) return 'relationship';
  return 'followup';
}
