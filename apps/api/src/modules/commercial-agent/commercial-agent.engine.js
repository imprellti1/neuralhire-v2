import { pickActionFromSignals } from './commercial-agent.rules.js';
import { scoreCommercialAction } from './commercial-agent.scoring.js';

export function analyzeConversation(conversation = {}, context = {}) {
  return {
    daysSinceLastMessage: conversation.last_message_at ? Math.max(0, Math.floor((Date.now() - new Date(conversation.last_message_at).getTime()) / 86400000)) : 0,
    active: String(conversation.status || 'open') === 'open',
    hasCustomer: Boolean(conversation.cliente_id),
    alertCount: Array.isArray(context.memory?.alerts) ? context.memory.alerts.length : 0
  };
}

export function analyzeCustomerMemory(memory = {}) {
  const commercial = memory.commercial || {};
  const behavior = memory.behavior || {};
  const products = memory.products || {};
  const manufacturers = memory.manufacturers || {};
  return {
    diasSemCompra: Number(commercial.diasSemCompra || 0),
    recurringProductCount: Array.isArray(products.recorrentes) ? products.recorrentes.length : 0,
    favoriteManufacturerCount: Array.isArray(manufacturers.favoritos) ? manufacturers.favoritos.length : 0,
    activeCustomer: (behavior.frequenciaCompra || '') !== 'baixa',
    riskLevel: behavior.risco || 'baixo',
    ticketTrend: Number(commercial.ticketMedio || 0) > 0 ? Math.min(20, Math.floor(Number(commercial.ticketMedio || 0) / 100)) : 0,
    frequencyTrend: behavior.risco === 'alto' ? -2 : behavior.risco === 'medio' ? -1 : 1
  };
}

export function analyzeOrders(orders = []) {
  const totalOrders = Array.isArray(orders) ? orders.length : 0;
  const totalValue = (orders || []).reduce((sum, order) => sum + Number(order.total || order.total_value || 0), 0);
  const manufacturers = new Set();
  for (const order of orders || []) {
    for (const item of order.itens || order.items || []) {
      if (item.fabricante || item.manufacturer) manufacturers.add(item.fabricante || item.manufacturer);
    }
  }
  return {
    totalOrders,
    totalValue,
    manufacturerCount: manufacturers.size,
    averageTicket: totalOrders ? totalValue / totalOrders : 0
  };
}

export function generateRecommendation(payload = {}) {
  const signals = {
    ...payload.signals,
    diasSemCompra: payload.memorySignals?.diasSemCompra ?? payload.signals?.diasSemCompra ?? 0,
    recurringProductCount: payload.memorySignals?.recurringProductCount ?? payload.signals?.recurringProductCount ?? 0,
    activeCustomer: payload.memorySignals?.activeCustomer ?? payload.signals?.activeCustomer ?? false,
    ticketTrend: payload.memorySignals?.ticketTrend ?? payload.signals?.ticketTrend ?? 0,
    brandAUsed: payload.memorySignals?.brandAUsed ?? payload.signals?.brandAUsed ?? 0,
    brandBMissing: payload.memorySignals?.brandBMissing ?? payload.signals?.brandBMissing ?? 0,
    riskLevel: payload.memorySignals?.riskLevel ?? payload.signals?.riskLevel ?? 'baixo',
    frequencyTrend: payload.memorySignals?.frequencyTrend ?? payload.signals?.frequencyTrend ?? 0,
    alertCount: payload.memorySignals?.alertCount ?? payload.signals?.alertCount ?? 0,
    gapSignals: payload.orderSignals?.manufacturerCount ?? 0,
    nextStepSignal: payload.conversationSignals?.hasCustomer ? 1 : 0
  };
  const actionType = pickActionFromSignals(signals);
  const confidence = scoreCommercialAction(signals, actionType);
  return { actionType, confidence };
}
