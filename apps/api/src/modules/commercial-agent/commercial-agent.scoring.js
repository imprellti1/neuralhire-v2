const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value || 0))));

export function scoreCommercialAction(context = {}, actionType = 'followup') {
  const diasSemCompra = Number(context.diasSemCompra || 0);
  const ticketTrend = Number(context.ticketTrend || 0);
  const alertCount = Number(context.alertCount || 0);
  const frequencyTrend = Number(context.frequencyTrend || 0);
  const base = {
    reactivation: 72 + Math.min(20, Math.floor(diasSemCompra / 8)),
    replenishment: 74 + Math.min(18, Number(context.recurringProductCount || 0) * 4),
    followup: 58 + Math.min(12, Number(context.nextStepSignal || 0) * 3),
    upsell: 70 + Math.min(20, Math.max(0, ticketTrend)),
    cross_sell: 67 + Math.min(20, Number(context.gapSignals || 0) * 5),
    relationship: 62 + Math.max(0, 12 - alertCount),
    risk_recovery: 78 + Math.min(16, Math.max(0, -frequencyTrend) * 4)
  }[actionType] ?? 50;
  return clamp(base);
}
