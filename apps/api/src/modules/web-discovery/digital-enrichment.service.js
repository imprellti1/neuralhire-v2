import { BadRequestError, ValidationError } from '../../core/errors.js';
import { registrarEventoTimeline } from '../clientes/clientes.timeline.service.js';
import { getClienteById, updateCliente } from '../clientes/clientes.repository.js';
import { searchDdgsWebDiscovery } from './providers/ddgs.provider.js';
import { searchTavilyWebDiscovery } from './providers/tavily.provider.js';

const MAX_DISCOVERY_PAGES = 8;
const PRIORITY_PATHS = ['contato', 'sobre', 'quem-somos', 'institucional', 'lojas', 'atendimento'];

function normalize(value) { return String(value || '').trim(); }
function normalizeDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
}
function ensureUrl(value, fallbackBase = '') {
  const raw = normalize(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!fallbackBase) return '';
  try { return new URL(raw, fallbackBase).toString(); } catch { return ''; }
}
function getSiteOrigin(site) {
  try { return new URL(site).origin; } catch { return ''; }
}
function isExternalLink(url, origin) {
  try {
    const parsed = new URL(url, origin);
    if (!origin) return false;
    return parsed.origin !== origin;
  } catch {
    return true;
  }
}
function isSocialDomain(domain = '') {
  return ['instagram.com', 'facebook.com', 'linkedin.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'wa.me', 'whatsapp.com'].some((item) => domain.includes(item));
}
function uniquePush(list, value) {
  const text = normalize(value);
  if (!text || list.includes(text)) return;
  list.push(text);
}
function normalizeList(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : [values]).map((item) => normalize(item)).filter(Boolean)));
}
function normalizeMoneyValue(value) {
  const text = String(value || '').trim().replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
function extractPriceMentions(text = '') {
  const matches = [];
  const regex = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2}))/gi;
  for (const match of String(text || '').matchAll(regex)) {
    const value = normalizeMoneyValue(match[1]);
    if (Number.isFinite(value)) matches.push(value);
  }
  return matches;
}
function inferCategories(text = '') {
  const source = String(text || '').toLowerCase();
  const entries = [
    ['cama', ['cama', 'jogo de cama', 'colcha', 'edredom', 'lençol', 'lencol', 'coberdrom', 'travesseiro', 'fronha']],
    ['mesa', ['mesa', 'jogo americano', 'guardanapo', 'toalha de mesa']],
    ['banho', ['banho', 'toalha', 'tapete de banho', 'banheiro']],
    ['decoração', ['decoração', 'decoracao', 'decor', 'almofada', 'manta', 'cortina', 'enxoval']],
    ['roupas', ['roupas', 'vestido', 'camisa', 'calça', 'calca', 'moda']],
    ['acessórios', ['acessórios', 'acessorios', 'bolsa', 'cinto', 'brinco']],
    ['calçados', ['calçados', 'calcados', 'tênis', 'tenis', 'sapato']],
    ['serviços', ['serviços', 'servicos']]
  ];
  return Array.from(new Set(entries.filter(([, terms]) => terms.some((term) => source.includes(term))).map(([category]) => category)));
}
function inferBrands(text = '') {
  const source = String(text || '');
  return Array.from(new Set((source.match(/\b[A-Z][A-Za-z0-9&.-]{2,}\b/g) || []).filter((item) => !['instagram', 'facebook', 'whatsapp', 'produto', 'catálogo', 'catalogo', 'loja'].includes(item.toLowerCase())))).slice(0, 20);
}
function inferCategoryForPrice(text = '') {
  const categories = inferCategories(text);
  return categories[0] || 'Geral';
}
function buildPriceRangesByCategory(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const category = normalize(entry.category) || 'Geral';
    const value = Number(entry.price);
    if (!Number.isFinite(value)) continue;
    const current = map.get(category) || { category, min_price: null, max_price: null, sum: 0, sample_count: 0 };
    current.min_price = current.min_price === null ? value : Math.min(current.min_price, value);
    current.max_price = current.max_price === null ? value : Math.max(current.max_price, value);
    current.sum += value;
    current.sample_count += 1;
    map.set(category, current);
  }
  return Array.from(map.values()).map((item) => ({
    category: item.category,
    min_price: item.min_price,
    max_price: item.max_price,
    avg_price: item.sample_count ? Number((item.sum / item.sample_count).toFixed(2)) : null,
    sample_count: item.sample_count
  }));
}
function buildCommercialProfile({ text = '', html = '', socialText = '' } = {}) {
  const ecommerceText = `${text} ${html}`;
  const instagramText = `${socialText} ${text}`;
  const ecommerceCategories = inferCategories(ecommerceText);
  const ecommerceBrands = inferBrands(ecommerceText);
  const ecommercePrices = extractPriceMentions(ecommerceText).map((price) => ({ category: inferCategoryForPrice(ecommerceText), price }));
  const instagramCategories = inferCategories(instagramText);
  const instagramBrands = inferBrands(instagramText);
  const instagramPrices = extractPriceMentions(instagramText).map((price) => ({ category: inferCategoryForPrice(instagramText), price }));
  return {
    ecommerce: {
      categories: normalizeList(ecommerceCategories),
      brands: normalizeList(ecommerceBrands),
      price_ranges_by_category: buildPriceRangesByCategory(ecommercePrices)
    },
    instagram: {
      categories: normalizeList(instagramCategories),
      brands: normalizeList(instagramBrands),
      price_ranges_by_category: buildPriceRangesByCategory(instagramPrices)
    }
  };
}
function hasEcommerceSignals({ text = '', html = '', url = '' } = {}) {
  const source = `${text} ${html} ${url}`.toLowerCase();
  return [
    /shopping_cart|cart|carrinho/i,
    /checkout|finalizar compra|finalizar pedido/i,
    /comprar|buy|adicionar ao carrinho|adicionar no carrinho/i,
    /à vista|a vista|em até|em ate|parcelamento|parcelar/i,
    /\bpreço\b|\bpreco\b|\bvalor\b/i
  ].some((pattern) => pattern.test(source));
}
function createEmptyPayload(site = '') {
  return {
    contacts: { emails: [], phones: [], whatsapp: [] },
    social: { instagram: [], facebook: [], linkedin: [], youtube: [], tiktok: [] },
    company: { description: '', segment: '', categories: [], brands: [], business_hours: '', address: '' },
    commercial_profile: {
      ecommerce: { categories: [], brands: [], price_ranges_by_category: [] },
      instagram: { categories: [], brands: [], price_ranges_by_category: [] }
    },
    commercial: { has_ecommerce: false, has_catalog: false, product_links: [], marketplaces: [] },
    sources: [],
    confidence: { site: site ? 100 : 0, emails: 0, phones: 0, social: 0, company: 0, commercial: 0 }
  };
}
function mergePayload(base, next) {
  return {
    contacts: {
      emails: Array.from(new Set([...(base?.contacts?.emails || []), ...(next?.contacts?.emails || [])])),
      phones: Array.from(new Set([...(base?.contacts?.phones || []), ...(next?.contacts?.phones || [])])),
      whatsapp: Array.from(new Set([...(base?.contacts?.whatsapp || []), ...(next?.contacts?.whatsapp || [])]))
    },
    social: {
      instagram: Array.from(new Set([...(base?.social?.instagram || []), ...(next?.social?.instagram || [])])),
      facebook: Array.from(new Set([...(base?.social?.facebook || []), ...(next?.social?.facebook || [])])),
      linkedin: Array.from(new Set([...(base?.social?.linkedin || []), ...(next?.social?.linkedin || [])])),
      youtube: Array.from(new Set([...(base?.social?.youtube || []), ...(next?.social?.youtube || [])])),
      tiktok: Array.from(new Set([...(base?.social?.tiktok || []), ...(next?.social?.tiktok || [])]))
    },
    company: {
      description: next?.company?.description || base?.company?.description || '',
      segment: next?.company?.segment || base?.company?.segment || '',
      categories: Array.from(new Set([...(base?.company?.categories || []), ...(next?.company?.categories || [])])),
      brands: Array.from(new Set([...(base?.company?.brands || []), ...(next?.company?.brands || [])])),
      business_hours: next?.company?.business_hours || base?.company?.business_hours || '',
      address: next?.company?.address || base?.company?.address || ''
    },
    commercial: {
      has_ecommerce: Boolean(base?.commercial?.has_ecommerce || next?.commercial?.has_ecommerce),
      has_catalog: Boolean(base?.commercial?.has_catalog || next?.commercial?.has_catalog),
      product_links: Array.from(new Set([...(base?.commercial?.product_links || []), ...(next?.commercial?.product_links || [])])),
      marketplaces: Array.from(new Set([...(base?.commercial?.marketplaces || []), ...(next?.commercial?.marketplaces || [])]))
    },
    commercial_profile: {
      ecommerce: {
        categories: Array.from(new Set([...(base?.commercial_profile?.ecommerce?.categories || []), ...(next?.commercial_profile?.ecommerce?.categories || [])])),
        brands: Array.from(new Set([...(base?.commercial_profile?.ecommerce?.brands || []), ...(next?.commercial_profile?.ecommerce?.brands || [])])),
        price_ranges_by_category: [...(base?.commercial_profile?.ecommerce?.price_ranges_by_category || []), ...(next?.commercial_profile?.ecommerce?.price_ranges_by_category || [])]
      },
      instagram: {
        categories: Array.from(new Set([...(base?.commercial_profile?.instagram?.categories || []), ...(next?.commercial_profile?.instagram?.categories || [])])),
        brands: Array.from(new Set([...(base?.commercial_profile?.instagram?.brands || []), ...(next?.commercial_profile?.instagram?.brands || [])])),
        price_ranges_by_category: [...(base?.commercial_profile?.instagram?.price_ranges_by_category || []), ...(next?.commercial_profile?.instagram?.price_ranges_by_category || [])]
      }
    },
    sources: Array.from(new Set([...(base?.sources || []), ...(next?.sources || [])])),
    confidence: {
      site: Math.max(Number(base?.confidence?.site || 0), Number(next?.confidence?.site || 0)),
      emails: Math.max(Number(base?.confidence?.emails || 0), Number(next?.confidence?.emails || 0)),
      phones: Math.max(Number(base?.confidence?.phones || 0), Number(next?.confidence?.phones || 0)),
      social: Math.max(Number(base?.confidence?.social || 0), Number(next?.confidence?.social || 0)),
      company: Math.max(Number(base?.confidence?.company || 0), Number(next?.confidence?.company || 0)),
      commercial: Math.max(Number(base?.confidence?.commercial || 0), Number(next?.confidence?.commercial || 0))
    }
  };
}
function buildQueries(cliente = {}) {
  const city = normalize(cliente.cidade);
  const state = normalize(cliente.estado);
  const fantasyName = normalize(cliente.nome);
  const corporateName = normalize(cliente.razao_social);
  const cnpj = normalize(cliente.documento).replace(/\D/g, '');
  const cnpjFormatted = cnpj.length === 14 ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
  return [
    [fantasyName, city, state, 'site'].filter(Boolean).join(' '),
    [corporateName || fantasyName, city, state, 'site'].filter(Boolean).join(' '),
    [cnpjFormatted, corporateName || fantasyName].filter(Boolean).join(' '),
    [cnpj, corporateName || fantasyName].filter(Boolean).join(' ')
  ].filter(Boolean);
}
async function discoverClienteWebsite({ clienteId, accountId, force = false, fetchImpl } = {}) {
  if (!clienteId) throw new ValidationError('clienteId obrigatorio', { domain: 'clientes-crm' });
  const cliente = await getClienteById(clienteId, { accountId });
  const existingSite = normalize(cliente.site || cliente.website);
  if (existingSite) return { found: true, source: 'existing', site: existingSite, domain: normalizeDomain(existingSite), provider: 'existing', confidence: 1, candidates: [] };
  assertEnabled();
  const providers = getProviders();
  assertKeysForEnabled(providers);
  const queries = buildQueries(cliente);
  const candidates = [];
  for (const query of queries) {
    for (const provider of ['tavily', 'ddgs']) {
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
function getEnvValue(key, fallback = '') {
  const value = process.env[key];
  return value === undefined || value === null ? fallback : value;
}
function penalizeDomain(domain = '') {
  const bad = ['facebook.com', 'instagram.com', 'linkedin.com', 'google.com', 'maps.google.com', 'reclameaqui.com.br', 'econodata.com.br', 'cnpj.biz', 'casadosdados.com.br', 'empresascnpj.com', 'youtube.com', 'wa.me'];
  return bad.some((item) => domain.includes(item)) ? 0.35 : 0;
}
function countTokenMatches(source = '', target = '') {
  const sourceTokens = String(source || '').toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length >= 3);
  if (!sourceTokens.length) return 0;
  const targetValue = String(target || '').toLowerCase();
  return sourceTokens.reduce((count, token) => count + (targetValue.includes(token) ? 1 : 0), 0);
}
function scoreCandidate(candidate, cliente, query) {
  const title = normalize(candidate.title).toLowerCase();
  const snippet = normalize(candidate.snippet).toLowerCase();
  const domain = normalizeDomain(candidate.url);
  if (!domain) return 0;
  let score = 0.35;
  const nameSignals = [normalize(cliente.nome), normalize(cliente.razao_social)].filter(Boolean);
  const locationSignals = [normalize(cliente.cidade), normalize(cliente.estado)].filter(Boolean);
  const bestNameMatch = nameSignals.reduce((best, value) => Math.max(best, countTokenMatches(value, title) + countTokenMatches(value, snippet) + countTokenMatches(value, domain)), 0);
  const bestLocationMatch = locationSignals.reduce((best, value) => Math.max(best, countTokenMatches(value, title) + countTokenMatches(value, snippet) + countTokenMatches(value, domain)), 0);
  if (bestNameMatch > 0) score += Math.min(0.35, bestNameMatch * 0.12);
  if (bestLocationMatch > 0) score += Math.min(0.2, bestLocationMatch * 0.08);
  if (query && (title.includes(query.toLowerCase()) || snippet.includes(query.toLowerCase()))) score += 0.05;
  score -= penalizeDomain(domain);
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}
function normalizeResult(candidate, provider, query, cliente) {
  const url = normalize(candidate.url);
  const domain = normalizeDomain(url);
  return { title: normalize(candidate.title), url, domain, snippet: normalize(candidate.snippet || candidate.content), provider, confidence: scoreCandidate(candidate, cliente, query) };
}
async function runProviders(query, providers, context) {
  const results = [];
  for (const provider of providers) {
    if (provider === 'tavily') {
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
function extractTextFromHtml(html = '') {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function extractEmails(text = '') { return Array.from(new Set((String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((item) => item.toLowerCase()))); }
function extractPhones(text = '') { return Array.from(new Set((String(text || '').match(/(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?(?:9?\d{4})[-\s]?\d{4}/g) || []).map((item) => item.trim()))); }
function extractSocialLinks(html = '', origin = '') {
  const matches = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((item) => item[1]);
  const result = { instagram: [], facebook: [], linkedin: [], youtube: [], tiktok: [] };
  for (const link of matches) {
    const url = ensureUrl(link, origin);
    if (!url) continue;
    const domain = normalizeDomain(url);
    if (domain.includes('instagram.com')) uniquePush(result.instagram, url);
    else if (domain.includes('facebook.com')) uniquePush(result.facebook, url);
    else if (domain.includes('linkedin.com')) uniquePush(result.linkedin, url);
    else if (domain.includes('youtube.com') || domain.includes('youtu.be')) uniquePush(result.youtube, url);
    else if (domain.includes('tiktok.com')) uniquePush(result.tiktok, url);
  }
  return result;
}
function buildStructuredPayloadFromPage({ url, html, text, title }) {
  const origin = getSiteOrigin(url);
  const emails = extractEmails(`${text} ${html}`);
  const phones = extractPhones(text);
  const socials = extractSocialLinks(html, origin);
  const segment = /atacado|varejo|ind[uú]stria|moda|confec|servi[cç]os|distribuidora|restaurante/i.test(text) ? (text.match(/atacado|varejo|ind[uú]stria|moda|confec|servi[cç]os|distribuidora|restaurante/i)?.[0] || '') : '';
  const categories = Array.from(new Set((text.match(/\b(?:roupas|calçados|acessórios|eletrônicos|cosméticos|alimentos|bebidas|móveis|serviços)\b/gi) || []).map((item) => item.toLowerCase())));
  const brands = Array.from(new Set((text.match(/\b(?:Nike|Adidas|Puma|Samsung|Apple|LG|Nike)\b/gi) || [])));
  const hasEcommerce = hasEcommerceSignals({ text, html, url }) || /carrinho|checkout|comprar agora|adicionar ao carrinho|finalizar compra/i.test(text);
  const hasCatalog = /cat[aá]logo|produtos|cole[cç][aã]o|linha de produtos/i.test(text) || hasEcommerce;
  const marketplaces = Array.from(new Set((text.match(/\b(?:Mercado Livre|Shopee|Amazon|Magazine Luiza)\b/gi) || []).map((item) => item.trim())));
  const commercialProfile = buildCommercialProfile({ text, html, socialText: text });
  return {
    contacts: { emails, phones, whatsapp: phones.filter((item) => /whats|9\d{4}[-\s]?\d{4}/i.test(item)) },
    social: socials,
    company: {
      description: text.slice(0, 500),
      segment,
      categories,
      brands,
      business_hours: (text.match(/(?:seg|ter|qua|qui|sex|sab|dom)[^.\n]{0,80}/i) || [''])[0] || '',
      address: (text.match(/(?:rua|avenida|av\.|alameda|travessa)[^.\n]{0,120}/i) || [''])[0] || ''
    },
    commercial: {
      has_ecommerce: hasEcommerce,
      has_catalog: hasCatalog,
      product_links: Array.from(new Set(Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((item) => ensureUrl(item[1], origin)).filter((item) => item && !isExternalLink(item, origin) && /produto|categoria|collection|catalog|buy|comprar|checkout|cart/i.test(item)))).slice(0, 20),
      marketplaces
    },
    commercial_profile: commercialProfile,
    sources: [{ url, title: title || null }]
  };
}
async function fetchPageContent(url, { fetchImpl, timeoutMs = 6000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await response.text();
    return { ok: response.ok, status: response.status, html, text: extractTextFromHtml(html), title: (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '' };
  } finally {
    clearTimeout(timer);
  }
}

export async function enrichClienteWebsite({ clienteId, accountId, fetchImpl, force = false } = {}) {
  if (!clienteId) throw new ValidationError('clienteId obrigatorio', { domain: 'clientes-crm' });
  const cliente = await getClienteById(clienteId, { accountId });
  let site = normalize(cliente.site || cliente.website);
  if (!site) {
    const discovery = await discoverClienteWebsite({ clienteId, accountId, force, fetchImpl });
    site = normalize(discovery?.site);
    var discoveryMeta = discovery || {};
  }
  if (!site) {
    const payload = createEmptyPayload('');
    const updated = await updateCliente(clienteId, { site: null, digital_enrichment_status: 'nao_encontrado', digital_enrichment_updated_at: new Date().toISOString(), digital_enrichment_payload: payload }, { accountId });
    return { found: false, site: null, domain: null, provider: discoveryMeta?.provider || null, confidence: discoveryMeta?.confidence || 0, payload, cliente: updated, sources: [] };
  }

  const origin = getSiteOrigin(site);
  const urls = [site];
  const priorityCandidates = PRIORITY_PATHS.map((path) => `${origin}/${path}`);
  const crawlTargets = [...urls, ...priorityCandidates].slice(0, MAX_DISCOVERY_PAGES);
  const payload = createEmptyPayload(site);
  let normalizedSite = site;
  for (const target of crawlTargets) {
    try {
      const page = await fetchPageContent(target, { fetchImpl });
      if (!page.ok) continue;
      const pagePayload = buildStructuredPayloadFromPage({ url: target, html: page.html, text: page.text, title: page.title });
      const merged = mergePayload(payload, pagePayload);
      Object.assign(payload.contacts, merged.contacts);
      Object.assign(payload.social, merged.social);
      Object.assign(payload.company, merged.company);
      Object.assign(payload.commercial, merged.commercial);
      Object.assign(payload.commercial_profile.ecommerce, merged.commercial_profile.ecommerce);
      Object.assign(payload.commercial_profile.instagram, merged.commercial_profile.instagram);
      payload.sources = merged.sources;
      payload.confidence = merged.confidence;
      if (!normalizedSite && page.ok) normalizedSite = target;
    } catch {
      continue;
    }
  }

  const updated = await updateCliente(clienteId, {
    site: normalizedSite,
    digital_enrichment_status: 'concluido',
    digital_enrichment_updated_at: new Date().toISOString(),
    digital_enrichment_payload: payload
  }, { accountId });

  await registrarEventoTimeline({ tipo: 'digital_enrichment_completed', categoria: 'web_discovery', titulo: 'Presença digital enriquecida', descricao: 'Informações digitais do site foram coletadas.', metadata: { site: normalizedSite, sources: payload.sources.slice(0, 8) } }, { accountId, clienteId }).catch(() => null);

  return { found: Boolean(normalizedSite), site: normalizedSite, domain: normalizeDomain(normalizedSite), provider: discoveryMeta?.provider || 'existing', confidence: discoveryMeta?.confidence || 1, payload, cliente: updated, sources: payload.sources };
}
