import { consultManager, findRelevantExecutiveMemories, getAiDirectorDashboard, listAiDirectorMemories, listManagers, recordExecutiveInsight } from './ai-director.repository.js';
import { BadRequestError } from '../../core/errors.js';
import { buildAiDirectorContext } from './ai-director.context-builder.js';
import { askAiDirectorLlm } from './ai-director.llm.js';
import { analyzeExecutiveFacts } from './ai-director.executive-memory.js';

const intentRules = [
  { intent: 'analise_clientes', keywords: ['cliente', 'clientes', 'risco', 'carteira', 'recompra'], managers: ['comercial', 'followup'] },
  { intent: 'analise_faturamento', keywords: ['faturamento', 'receita', 'venda', 'vendas', 'pedido', 'pedidos'], managers: ['comercial'] },
  { intent: 'analise_produtos', keywords: ['produto', 'produtos', 'categoria', 'categorias', 'fabricante', 'fabricantes', 'promoção', 'promocoes', 'promoções', 'importação', 'importações'], managers: ['produtos'] },
  { intent: 'analise_auditoria', keywords: ['erro', 'erros', 'log', 'logs', 'auditoria', 'inconsistência', 'inconsistencias', 'integridade', 'problema critico', 'problema crítico'], managers: ['auditoria'] },
  { intent: 'analise_administrativa', keywords: ['usuário', 'usuarios', 'permissão', 'permissoes', 'configuração', 'configuracoes', 'tenant', 'conta'], managers: ['administrativo'] }
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
  const managerResponses = await Promise.all(selectedManagers.map(async (managerId) => {
    const manager = managerMap.get(managerId);
    if (!manager) return null;
    try {
      return await consultManager({ accountId: options.accountId, context: options.context }, managerId, { question });
    } catch (error) {
      return {
        manager: { id: managerId, nome: manager.nome },
        question,
        summary: `Falha controlada ao consultar ${manager.nome}.`,
        status: 'fallback',
        sources: [...manager.modulos],
        facts: {
          manager_id: manager.id,
          manager_nome: manager.nome,
          sources: [...manager.modulos],
          question,
          provider: 'fallback',
          provider_error: error?.message || 'Falha ao consultar gerente'
        }
      };
    }
  })).then((items) => items.filter(Boolean));

  return {
    question,
    intent,
    selectedManagers,
    managerResponses,
    summary: `O Diretor IA consultou ${managerResponses.map((item) => item.manager.nome).join(' e ')} e consolidou uma resposta inicial.`,
    status: 'delegated'
  };
}

export async function answerAiDirectorQuestion(payload = {}, options = {}) {
  const question = normalizeQuestion(payload.question);
  const delegation = await delegateAiDirectorQuestion({ question }, options);
  const dashboard = await getAiDirectorDashboard(options.context || {});
  const memoriesResult = await listAiDirectorMemories({ limit: 8 }, { accountId: options.accountId, context: options.context }).catch(() => ({ items: [] }));
  const executiveMemoriesResult = await findRelevantExecutiveMemories({ limit: 8, question }, { accountId: options.accountId, context: options.context }).catch(() => ({ items: [] }));
  const insights = analyzeExecutiveFacts(delegation.managerResponses || [], executiveMemoriesResult.items || []);
  const storedInsights = [];
  for (const insight of insights) {
    const exists = (executiveMemoriesResult.items || []).some((memory) => memory.tipo === insight.tipo && memory.titulo === insight.titulo && memory.categoria === insight.categoria);
    if (!exists) {
      const created = await recordExecutiveInsight(insight, { accountId: options.accountId, context: options.context }).catch(() => null);
      if (created) storedInsights.push(created);
    }
  }
  const allExecutiveMemories = [...(executiveMemoriesResult.items || []), ...storedInsights];
  const context = await buildAiDirectorContext({
    question,
    delegation,
    dashboard,
    memories: memoriesResult.items || [],
    executiveMemories: allExecutiveMemories
  });
  const llmResult = await askAiDirectorLlm(context, options).catch((error) => ({
    answer: null,
    error: error?.message || 'LLM indisponivel'
  }));

  const answer = llmResult.answer || context.safeFallbackAnswer;
  return {
    question,
    answer,
    consultedManagers: delegation.selectedManagers,
    managerResponses: delegation.managerResponses,
    usedMemories: context.usedMemories.map((memory) => memory.id),
    executiveMemories: allExecutiveMemories.map((memory) => memory.id),
    facts: context.facts,
    status: llmResult.answer ? 'answered' : 'answered_with_fallback',
    llm: llmResult.error ? { error: llmResult.error } : undefined
  };
}
