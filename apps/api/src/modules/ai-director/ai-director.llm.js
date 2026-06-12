import { env } from '../../config/env.js';

function getLlmConfig() {
  const apiKey = String(env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
  const model = String(env.OPENAI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();
  const baseUrl = String(env.OPENAI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim().replace(/\/+$/, '');
  return { apiKey, model, baseUrl };
}

export function isAiDirectorLlmConfigured() {
  const { apiKey } = getLlmConfig();
  return Boolean(apiKey);
}

export async function askAiDirectorLlm(context = {}) {
  const { apiKey, model, baseUrl } = getLlmConfig();
  if (!apiKey) {
    return { answer: null, error: 'LLM nao configurada' };
  }

  const prompt = [
    'Voce e o Diretor IA do NeuralHire.',
    'Responda em pt-BR, com tom executivo, objetivo e sem inventar fatos.',
    'Use apenas os fatos fornecidos e, se faltar dado, deixe isso claro.',
    `Pergunta: ${context.question}`,
    `Fatos: ${JSON.stringify(context.facts || {})}`,
    `Memorias: ${JSON.stringify((context.usedMemories || []).map((m) => ({ id: m.id, titulo: m.titulo, conteudo: m.conteudo, tipo: m.tipo, prioridade: m.prioridade })))}`,
    `Gerentes: ${JSON.stringify(context.managerFacts || [])}`
  ].join('\n');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'Voce gera respostas executivas para um painel de diretoria.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    return { answer: null, error: `LLM respondeu com status ${response.status}` };
  }

  const data = await response.json();
  const answer = data?.choices?.[0]?.message?.content?.trim() || null;
  return { answer, raw: data };
}
