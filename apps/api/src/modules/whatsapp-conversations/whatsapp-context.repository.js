import { ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getClienteById } from '../clientes/clientes.repository.js';
import { buildCustomerMemory } from '../customer-memory/customer-memory.builder.js';
import { getPersistedCustomerMemory } from '../customer-memory/customer-memory.repository.js';
import { getConversationById } from './whatsapp-conversations.repository.js';

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'whatsapp-conversations' });
}

function buildEmptyContext(conversation = null) {
  return {
    conversation: conversation ? {
      id: conversation.id,
      status: conversation.status,
      phone: conversation.phone,
      contactName: conversation.contact_name || null
    } : null,
    customer: null,
    memory: {
      commercial: { totalPedidos: 0, totalComprado: 0, ticketMedio: 0, ultimaCompra: null, diasSemCompra: 0 },
      behavior: { frequenciaCompra: 'baixa', risco: 'baixo', potencial: 'medio' },
      products: { recorrentes: [], maisComprados: [] },
      manufacturers: { favoritos: [] },
      opportunities: [],
      alerts: [],
      summary: ''
    }
  };
}

function normalizeMemory(memory = {}) {
  return {
    commercial: memory.commercial || { totalPedidos: 0, totalComprado: 0, ticketMedio: 0, ultimaCompra: null, diasSemCompra: 0 },
    behavior: memory.behavior || { frequenciaCompra: 'baixa', risco: 'baixo', potencial: 'medio' },
    products: memory.products || { recorrentes: [], maisComprados: [] },
    manufacturers: memory.manufacturers || { favoritos: [] },
    opportunities: memory.opportunities || [],
    alerts: memory.alerts || [],
    summary: memory.summary || ''
  };
}

export async function getWhatsappConversationContext(conversationId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const conversation = await getConversationById(conversationId, { accountId });
  const base = buildEmptyContext(conversation);
  if (!conversation.cliente_id) return base;

  let customer = null;
  try {
    customer = await getClienteById(conversation.cliente_id, { accountId, context: options.context });
  } catch (error) {
    if (error instanceof NotFoundError) return base;
    throw error;
  }

  let persisted = null;
  try {
    persisted = await getPersistedCustomerMemory(conversation.cliente_id, { accountId, context: options.context });
  } catch (error) {
    if (error?.code !== 'DATABASE_ERROR' && error?.code !== 'ECONNREFUSED') throw error;
  }
  const memory = persisted?.memory || normalizeMemory(await buildCustomerMemory(conversation.cliente_id, { accountId, context: options.context }));
  if (!persisted?.memory) {
    // Rebuild automatically when we had to compute the memory on demand.
  }

  return {
    conversation: {
      id: conversation.id,
      status: conversation.status,
      phone: conversation.phone,
      contactName: conversation.contact_name || null
    },
    customer: {
      clienteId: customer.id,
      nome: customer.nome || customer.razao_social || customer.empresa || '',
      empresa: customer.empresa || customer.razao_social || customer.nome || '',
      cidade: customer.cidade || '',
      uf: customer.uf || customer.estado || ''
    },
    memory: normalizeMemory(memory)
  };
}
