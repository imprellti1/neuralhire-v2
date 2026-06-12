import { consultManager, listManagers } from './ai-director.repository.js';
import { BadRequestError } from '../../core/errors.js';

const intentRules = [
  {
    intent: 'analise_clientes',
    keywords: ['cliente', 'clientes', 'risco', 'carteira', 'recompra'],
    managers: ['comercial', 'followup']
  },
  {
    intent: 'analise_faturamento',
    keywords: ['faturamento', 'receita', 'venda', 'vendas', 'pedido', 'pedidos'],
    managers: ['comercial']
  },
  {
    intent: 'analise_produtos',
    keywords: ['produto', 'produtos', 'categoria', 'categorias', 'fabricante', 'fabricantes', 'promoção', 'promoções', 'importação', 'importações'],
    managers: ['produtos']
  },
  {
    intent: 'analise_auditoria',
    keywords: ['erro', 'erros', 'log', 'logs', 'auditoria', 'inconsistência', 'inconsistencias', 'integridade'],
    managers: ['auditoria']
  },
  {
    intent: 'analise_administrativa',
    keywords: ['usuário', 'usuarios', 'permissão', 'permissoes', 'configuração', 'configuracoes', 'tenant', 'conta'],
    managers: ['administrativo']
  }
];

function normalizeQuestion(question) {
  const text = String(question ?? '').trim();
  if (!text) throw new BadRequestError('question obrigatorio');
  return text;
}

function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getManagerMap() {
  return new Map(listManagers().map((manager) => [manager.id, manager]));
}

export function classifyDelegation(question) {
  const normalized = normalizeText(question);
  const match = intentRules.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)));
  if (match) return { intent: match.intent, selectedManagers: [...match.managers] };
  return { intent: 'analise_geral', selectedManagers: ['comercial', 'produtos'] };
}

export async function delegateAiDirectorQuestion(payload = {}, options = {}) {
  const question = normalizeQuestion(payload.question);
  const { intent, selectedManagers } = classifyDelegation(question);
  const managerMap = getManagerMap();
  const managerResponses = selectedManagers.map((managerId) => {
    const manager = managerMap.get(managerId);
    if (!manager) return null;
    return consultManager({ accountId: options.accountId }, managerId, { question });
  }).filter(Boolean);

  return {
    question,
    intent,
    selectedManagers,
    managerResponses,
    summary: `O Diretor IA consultou ${managerResponses.map((item) => item.manager.nome).join(' e ')} e consolidou uma resposta inicial.`,
    status: 'delegated'
  };
}
