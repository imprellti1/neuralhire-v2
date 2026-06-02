import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getConversationById } from '../whatsapp-conversations/whatsapp-conversations.repository.js';
import { getWhatsappConversationContext } from '../whatsapp-conversations/whatsapp-context.repository.js';
import { generateRecommendation, analyzeConversation, analyzeCustomerMemory, analyzeOrders } from './commercial-agent.engine.js';

const actions = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'commercial-agent' });
}

function now() { return new Date().toISOString(); }

function buildReason(actionType, signals = {}) {
  if (actionType === 'reactivation') return `Cliente está há ${signals.diasSemCompra || 0} dias sem comprar.`;
  if (actionType === 'replenishment') return 'Cliente tem produto recorrente e já passou do ciclo médio de recompra.';
  if (actionType === 'upsell') return 'Cliente está ativo e mostra tendência de aumento de ticket.';
  if (actionType === 'cross_sell') return 'Há oportunidade de ampliar mix com fabricante ainda não comprado.';
  if (actionType === 'risk_recovery') return 'Há risco alto combinado com queda de frequência.';
  if (actionType === 'relationship') return 'Cliente está ativo e sem alertas relevantes.';
  return 'Há um próximo passo comercial a revisar com o representante.';
}

export async function analyzeCommercialConversation(conversationId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const conversation = await getConversationById(conversationId, { accountId });
  const context = await getWhatsappConversationContext(conversationId, { accountId });
  const conversationSignals = analyzeConversation(conversation, context);
  const memorySignals = { ...analyzeCustomerMemory(context.memory || {}), ...(options.memorySignals || {}) };
  const orderSignals = analyzeOrders(options.orders || []);
  const recommendation = generateRecommendation({ conversationSignals, memorySignals, orderSignals, signals: { alertCount: memorySignals.alertCount || 0 } });
  const item = {
    id: randomUUID(),
    account_id: accountId,
    conversation_id: conversationId,
    cliente_id: conversation.cliente_id || null,
    action_type: recommendation.actionType,
    confidence_score: recommendation.confidence,
    reason: buildReason(recommendation.actionType, memorySignals),
    context: { conversationSignals, memorySignals, orderSignals },
    recommendation: {
      actionType: recommendation.actionType,
      confidence: recommendation.confidence,
      reason: buildReason(recommendation.actionType, memorySignals),
      recommendedProducts: (context.memory?.products?.recorrentes || []).slice(0, 2).map((item) => item.nome || item),
      recommendedManufacturers: (context.memory?.manufacturers?.favoritos || []).slice(0, 2).map((item) => item.nome || item),
      summary: recommendation.actionType === 'reactivation' ? 'Entrar em contato para validar estoque e necessidade de reposição.' : 'Orientar o representante com o próximo passo mais provável.'
    },
    created_at: now()
  };
  actions.push(item);
  return { ...item };
}

export async function getCommercialActionForConversation(conversationId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const item = [...actions].reverse().find((row) => row.account_id === accountId && row.conversation_id === conversationId);
  if (!item) throw new NotFoundError('Analise comercial nao encontrada', { code: 'COMMERCIAL_AGENT_NOT_FOUND', domain: 'commercial-agent' });
  return { ...item };
}

export function __resetMemoryCommercialAgentForTests() { actions.length = 0; }
