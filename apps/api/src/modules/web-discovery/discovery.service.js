import { BadRequestError, ValidationError } from '../../core/errors.js';
import { registrarEventoTimeline } from '../clientes/clientes.timeline.service.js';
import { getClienteById, updateCliente } from '../clientes/clientes.repository.js';
import { searchBraveWebDiscovery } from './providers/brave.provider.js';
import { searchDdgsWebDiscovery } from './providers/ddgs.provider.js';
import { searchTavilyWebDiscovery } from './providers/tavily.provider.js';

function normalize(value) { return String(value || '').trim(); }
function normalizeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
}
function buildQueries(cliente = {}) {
  const city = normalize(cliente.cidade);
  const state = normalize(cliente.estado);
  const name = normalize(cliente.razao_social || cliente.nome);
  const cnpj = normalize(cliente.documento).replace(/\D/g, '');
  const cnpjFormatted = cnpj.length === 14 ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
  return [
    [name, city, state].filter(Boolean).join(' '),
    [normalize(cliente.nome), city, state].filter(Boolean).join(' '),
    [cnpjFormatted, city, state].filter(Boolean).join(' '),
    [cnpj, city, state].filter(Boolean).join(' ')
  ].filter(Boolean);
}
function getEnvValue(key, fallback = '') {
  const value = process.env[key];
  return value === undefined || value === null ? fallback : value;
}
function penalizeDomain(domain = '') {
  const bad = ['facebook.com', 'instagram.com', 'linkedin.com', 'google.com', 'maps.google.com', 'reclameaqui.com.br', 'econodata.com.br', 'cnpj.biz', 'casadosdados.com.br', 'empresascnpj.com', 'youtube.com', 'wa.me'];
  return bad.some((item) => domain.includes(item)) ? 0.35 : 0;
}
function scoreCandidate(candidate, cliente, query) {
  const title = normalize(candidate.title).toLowerCase();
  const snippet = normalize(candidate.snippet).toLowerCase();
  const domain = normalizeDomain(candidate.url);
  if (!domain) return 0;
  let score = 0.35;
  if (title.includes(normalize(cliente.razao_social || cliente.nome).toLowerCase()) || snippet.includes(normalize(cliente.razao_social || cliente.nome).toLowerCase())) score += 0.25;
  if (title.includes(normalize(cliente.cidade).toLowerCase()) || snippet.includes(normalize(cliente.cidade).toLowerCase()) || title.includes(normalize(cliente.estado).toLowerCase()) || snippet.includes(normalize(cliente.estado).toLowerCase())) score += 0.2;
  if (query && (title.includes(query.toLowerCase()) || snippet.includes(query.toLowerCase()))) score += 0.05;
  score -= penalizeDomain(domain);
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
function normalizeResult(candidate, provider, query, cliente) {
  const url = normalize(candidate.url);
  const domain = normalizeDomain(url);
  return { title: normalize(candidate.title), url, domain, snippet: normalize(candidate.snippet), provider, confidence: scoreCandidate(candidate, cliente, query) };
}
async function runProviders(query, providers, context) {
  const results = [];
  for (const provider of providers) {
    if (provider === 'brave') {
      const response = await searchBraveWebDiscovery(query, { apiKey: getEnvValue('BRAVE_SEARCH_API_KEY'), fetchImpl: context.fetchImpl });
      results.push(...(response.items || []).map((item) => normalizeResult(item, 'brave', query, context.cliente)));
    } else if (provider === 'tavily') {
      const response = await searchTavilyWebDiscovery(query, { apiKey: getEnvValue('TAVILY_API_KEY'), fetchImpl: context.fetchImpl });
      results.push(...(response.items || []).map((item) => normalizeResult(item, 'tavily', query, context.cliente)));
    } else if (provider === 'ddgs') {
      const response = await searchDdgsWebDiscovery(query, { fetchImpl: context.fetchImpl });
      results.push(...(response.items || []).map((item) => normalizeResult(item, 'ddgs', query, context.cliente)));
    }
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}
function getProviders() {
  return String(getEnvValue('WEB_DISCOVERY_PROVIDERS', '')).split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}
function assertEnabled() {
  if (String(getEnvValue('WEB_DISCOVERY_ENABLED', 'false')).toLowerCase() !== 'true') throw new BadRequestError('Web discovery desabilitado', { domain: 'clientes-crm', code: 'WEB_DISCOVERY_DISABLED' });
}
function assertKeysForEnabled(providers) {
  const missing = [];
  if (providers.includes('tavily') && !String(getEnvValue('TAVILY_API_KEY')).trim()) missing.push('TAVILY_API_KEY');
  if (missing.length) throw new ValidationError('Chaves de API ausentes para web discovery', { domain: 'clientes-crm', details: { missing } });
}
export async function discoverClienteWebsite({ clienteId, accountId, force = false, fetchImpl } = {}) {
  if (!clienteId) throw new ValidationError('clienteId obrigatorio', { domain: 'clientes-crm' });
  const cliente = await getClienteById(clienteId, { accountId });
  const existingSite = normalize(cliente.site || cliente.website);
  if (existingSite) {
    return { found: true, source: 'existing', site: existingSite, domain: normalizeDomain(existingSite), provider: 'existing', confidence: 1, candidates: [] };
  }
  assertEnabled();
  const providers = getProviders();
  assertKeysForEnabled(providers);
  const queries = buildQueries(cliente);
  const candidates = [];
  const orderedProviders = ['tavily', 'ddgs', ...providers.filter((provider) => provider !== 'tavily' && provider !== 'ddgs')];
  for (const query of queries) {
    for (const provider of orderedProviders) {
      const results = await runProviders(query, [provider], { fetchImpl, cliente });
      candidates.push(...results.map((item) => ({ ...item, query })));
      const bestCandidate = candidates.sort((a, b) => b.confidence - a.confidence)[0] || null;
      const minConfidence = Number(getEnvValue('WEB_DISCOVERY_MIN_CONFIDENCE', '0.85'));
      if (bestCandidate && bestCandidate.confidence >= minConfidence) break;
    }
  }
  const best = candidates.sort((a, b) => b.confidence - a.confidence)[0] || null;
  const minConfidence = Number(getEnvValue('WEB_DISCOVERY_MIN_CONFIDENCE', '0.85'));
  if (!best || best.confidence < minConfidence) {
    await registrarEventoTimeline({ tipo: 'web_discovery_not_found', categoria: 'web_discovery', titulo: 'Site nao encontrado', descricao: 'Nenhum site oficial confiavel foi identificado.', metadata: { query: queries[0] || null, candidates: candidates.slice(0, 10) } }, { accountId, clienteId }).catch(() => null);
    return { found: false, site: null, domain: null, provider: null, confidence: best?.confidence || 0, candidates: candidates.slice(0, 10) };
  }
  const site = best.url;
  if (!normalize(cliente.site)) await updateCliente(clienteId, { site }, { accountId });
  await registrarEventoTimeline({ tipo: 'web_discovery_completed', categoria: 'web_discovery', titulo: 'Site oficial descoberto', descricao: 'Site oficial identificado por provider de busca.', metadata: { provider: best.provider, domain: best.domain, url: best.url, confidence: best.confidence, query: best.query, candidates: candidates.slice(0, 10) } }, { accountId, clienteId }).catch(() => null);
  return { found: true, site, domain: best.domain, provider: best.provider, confidence: best.confidence, candidates: candidates.slice(0, 10) };
}
