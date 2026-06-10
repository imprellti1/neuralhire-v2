import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getProdutoById, getProdutosRepositoryMode, listProdutos, updateProduto, __dumpMemoryProdutos, __getProdutoVariacoesSelectFieldsForTests } from '../produtos/produtos.repository.js';
import { listFabricantes, getFabricanteById } from '../fabricantes/fabricantes.repository.js';

const memoryLinks = [];
const PRODUTO_VARIACOES_SELECT_FIELDS = __getProdutoVariacoesSelectFieldsForTests();

function assertAccountId(accountId) {
  if (!accountId) {
    throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'product-audit' });
  }
}

function debugRepository(action, payload) {
  if (env.NODE_ENV === 'production') return;
  console.debug(`[product-audit.repository] ${action}`, payload);
}

function getLink(accountId, productId) {
  return memoryLinks.find((item) => item.account_id === accountId && item.product_id === productId) || null;
}

function setLink(accountId, productId, fabricanteId) {
  const idx = memoryLinks.findIndex((item) => item.account_id === accountId && item.product_id === productId);
  const payload = { id: idx >= 0 ? memoryLinks[idx].id : randomUUID(), account_id: accountId, product_id: productId, fabricante_id: fabricanteId, updated_at: new Date().toISOString() };
  if (idx >= 0) memoryLinks[idx] = payload;
  else memoryLinks.push(payload);
  return payload;
}

function extractFabricanteId(item, accountId) {
  return getLink(accountId, item.id)?.fabricante_id || item.fabricanteId || item.fabricante_id || item.metadata?.fabricanteId || null;
}

function normalizeActiveValue(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0') return false;
  const text = String(value || '').trim().toLowerCase();
  if (text === 'true' || text === 'ativo' || text === 'active') return true;
  if (text === 'false' || text === 'inativo' || text === 'inactive') return false;
  return null;
}

function normalizeStatusValue(value) {
  return String(value || '').trim().toLowerCase();
}

function hasActiveIndicator(item = {}) {
  const activeFlag = normalizeActiveValue(item.ativo ?? item.active ?? item.status);
  return activeFlag === true;
}

function hasInactiveIndicator(item = {}) {
  const activeFlag = normalizeActiveValue(item.ativo ?? item.active ?? item.status);
  return activeFlag === false;
}

function isInactiveProduct(item = {}) {
  return hasInactiveIndicator(item);
}

function isActiveProduct(item = {}) {
  return hasActiveIndicator(item);
}

function normalizeVariation(item = {}) {
  const active = normalizeActiveValue(item.ativo ?? item.active ?? item.status);
  return {
    ...item,
    ativo: active === null ? true : active,
    status: item.status || (active === false ? 'inativo' : 'ativo')
  };
}

function getProductVariations(item = {}) {
  const candidates = [item.variacoes, item.variations, item.produto_variacoes, item.produtoVariacoes, item.product_variations];
  const raw = candidates.find((value) => Array.isArray(value));
  return (raw || []).map(normalizeVariation);
}

function buildIssues(item, accountId, duplicateSkuSet, duplicateNameSet) {
  const issues = [];
  const fabricanteId = extractFabricanteId(item, accountId);
  if (!fabricanteId) issues.push('missing_fabricante');
  if (!item.imagemUrl && !item.imagem_url) issues.push('missing_image');
  if (!String(item.sku || '').trim()) issues.push('missing_sku');
  if (!String(item.nome || '').trim()) issues.push('missing_name');
  if (!String(item.categoria || '').trim()) issues.push('missing_category');
  const preco = Number(item.preco ?? item.preco_unitario);
  if (!Number.isFinite(preco)) issues.push('missing_price');
  else if (preco <= 0) issues.push('invalid_price');
  if (duplicateSkuSet.has(String(item.sku || '').trim().toLowerCase()) && String(item.sku || '').trim()) issues.push('duplicate_sku');
  if (duplicateNameSet.has(String(item.nome || '').trim().toLowerCase()) && String(item.nome || '').trim()) issues.push('duplicate_name');
  if (isInactiveProduct(item)) issues.push('inactive_product');
  if (Number(item.estoque || 0) <= 0) issues.push('zero_stock');
  const variacoes = getProductVariations(item).filter((variacao) => normalizeActiveValue(variacao.ativo ?? variacao.active ?? variacao.status) !== false);
  if (variacoes.length) {
    if (variacoes.some((v) => !v?.imagemUrl && !v?.imagem_url)) issues.push('variation_without_image');
    if (variacoes.some((v) => Number(v?.estoque_atual ?? v?.estoque ?? v?.stock ?? 0) <= 0)) issues.push('variation_without_stock');
  }
  if (!variacoes.length) issues.push('missing_variations');
  return issues;
}

function getIssueSeverity(issue) {
  if (['duplicate_sku', 'missing_factory', 'missing_fabricante', 'missing_variation', 'missing_variations'].includes(issue)) return 'high';
  if (['invalid_price', 'zero_stock', 'estoque_zerado'].includes(issue)) return 'medium';
  if (['missing_image', 'missing_category', 'inactive_product'].includes(issue)) return 'low';
  return 'low';
}

function getSeverityScore(issue) {
  const severity = getIssueSeverity(issue);
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function getProductSeverity(item) {
  const issues = Array.isArray(item.issues) ? item.issues : [];
  return issues.reduce((max, issue) => Math.max(max, getSeverityScore(issue)), 0);
}

function normalizeFilters(filters = {}) {
  const rawStatus = normalizeStatusValue(filters.status);
  const status = rawStatus === 'inativos' || rawStatus === 'inactive' ? 'inativo' : rawStatus;
  return {
    issue: filters.issue ? String(filters.issue) : '',
    fabricanteId: filters.fabricanteId ? String(filters.fabricanteId) : '',
    status,
    search: filters.search ? String(filters.search) : ''
  };
}

function applyFilters(items, filters = {}) {
  let filtered = items;
  const statusFilter = normalizeStatusValue(filters.status);
  if (statusFilter === 'inativo') filtered = filtered.filter((item) => isInactiveProduct(item));
  else filtered = filtered.filter((item) => isActiveProduct(item));
  if (filters.issue) filtered = filtered.filter((item) => item.issues.includes(filters.issue));
  if (filters.fabricanteId) filtered = filtered.filter((item) => item.fabricanteId === filters.fabricanteId);
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    filtered = filtered.filter((item) => [item.nome, item.sku, item.categoria, item.fabricanteNome].some((value) => String(value || '').toLowerCase().includes(q)));
  }
  return filtered;
}

function filterByStatus(items, status) {
  const statusFilter = normalizeStatusValue(status);
  if (statusFilter === 'inativo') return items.filter((item) => isInactiveProduct(item));
  return items.filter((item) => isActiveProduct(item));
}

function buildSummary(items) {
  const summary = {
    totalProdutos: items.length,
    comProblemas: 0,
    semFabrica: 0,
    semImagem: 0,
    semCategoria: 0,
    duplicados: 0,
    inativos: 0,
    estoqueZerado: 0,
    criticos: 0,
    medios: 0,
    leves: 0
  };

  for (const item of items) {
    const issues = Array.isArray(item.issues) ? item.issues : [];
    if (issues.length) summary.comProblemas += 1;
    if (issues.includes('missing_fabricante') || issues.includes('missing_factory') || issues.includes('missing_fabricante')) summary.semFabrica += 1;
    if (issues.includes('missing_image')) summary.semImagem += 1;
    if (issues.includes('missing_category')) summary.semCategoria += 1;
    if (issues.includes('duplicate_sku') || issues.includes('duplicate_name') || issues.includes('duplicated')) summary.duplicados += 1;
    if (issues.includes('inactive_product')) summary.inativos += 1;
    if (issues.includes('zero_stock') || issues.includes('estoque_zerado')) summary.estoqueZerado += 1;
    const severity = getProductSeverity(item);
    if (severity >= 3) summary.criticos += 1;
    else if (severity === 2) summary.medios += 1;
    else if (severity === 1) summary.leves += 1;
  }

  return summary;
}

function buildAuditContext(products, accountId) {
  const skuCounts = new Map();
  const nameCounts = new Map();
  for (const item of products) {
    const sku = String(item.sku || '').trim().toLowerCase();
    const name = String(item.nome || '').trim().toLowerCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  const duplicateSkuSet = new Set([...skuCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  const duplicateNameSet = new Set([...nameCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  const audited = products.map((item) => ({ ...item, variacoes: getProductVariations(item), issues: buildIssues(item, accountId, duplicateSkuSet, duplicateNameSet) }));
  return {
    audited,
    applyFilters: (filters) => applyFilters(audited, filters),
    buildSummary: (items) => buildSummary(items)
  };
}

async function fetchAllAuditVariations(accountId) {
  const repositoryMode = getProdutosRepositoryMode();
  if (repositoryMode.mode !== 'supabase') {
    return __dumpMemoryProdutos().flatMap((produto) => {
      const variations = getProductVariations(produto);
      return variations.map((variation) => ({ ...variation, produto_id: produto.id, account_id: produto.account_id }));
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const items = [];

  do {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('produto_variacoes')
      .select(PRODUTO_VARIACOES_SELECT_FIELDS, { count: 'exact' })
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .range(from, to);
    if (error) throw new DatabaseError('Falha ao listar variacoes da auditoria', { details: error });
    items.push(...(data || []).map(normalizeVariation));
    totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));
    page += 1;
  } while (page <= totalPages);

  return items;
}

async function fetchAllAuditProducts(accountId) {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const items = [];

  do {
    const response = await listProdutos({ page, limit: pageSize }, { accountId });
    items.push(...(response.items || []));
    totalPages = Math.max(1, Number(response.totalPages || Math.ceil((response.total || 0) / pageSize) || 1));
    page += 1;
  } while (page <= totalPages);

  return items;
}

export async function auditSummary(options = {}) {
  const { filters = {} } = options;
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const produtos = await fetchAllAuditProducts(accountId);
  const normalizedFilters = normalizeFilters(filters);
  const context = buildAuditContext(filterByStatus(produtos, normalizedFilters.status), accountId);
  const filtered = context.applyFilters(normalizedFilters);
  return context.buildSummary(filtered.filter((item) => (item.issues || []).length > 0));
}

export async function listAuditProducts(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const response = await fetchAllAuditProducts(accountId);
  const fabricantes = await listFabricantes({}, { accountId });
  const variations = await fetchAllAuditVariations(accountId);
  const variationsByProductId = new Map();
  for (const variation of variations) {
    const productId = variation.produto_id || variation.product_id || variation.productId || null;
    if (!productId) continue;
    const list = variationsByProductId.get(String(productId)) || [];
    list.push(variation);
    variationsByProductId.set(String(productId), list);
  }
  const fabricanteById = new Map((fabricantes.items || [])
    .filter((item) => String(item.account_id || item.accountId || '') === String(accountId))
    .map((item) => [item.id, item]));
  const products = response.map((item) => {
    const fabricanteId = extractFabricanteId(item, accountId);
    const productVariations = getProductVariations(item);
    const mergedVariations = productVariations.length ? productVariations : (variationsByProductId.get(String(item.id)) || []);
    return {
      ...item,
      variacoes: mergedVariations,
      fabricanteId,
      fabricanteNome: fabricanteId ? fabricanteById.get(fabricanteId)?.nome || '-' : '-'
    };
  });
  const normalizedFilters = normalizeFilters(filters);
  const context = buildAuditContext(filterByStatus(products, normalizedFilters.status), accountId);
  const filtered = context.applyFilters(normalizedFilters);
  const summary = context.buildSummary(filtered.filter((item) => (item.issues || []).length > 0));
  const issueItems = filtered
    .filter((item) => (item.issues || []).length > 0)
    .slice()
    .sort((a, b) => {
      const severityDiff = getProductSeverity(b) - getProductSeverity(a);
      if (severityDiff) return severityDiff;
      const issueDiff = (b.issues?.length || 0) - (a.issues?.length || 0);
      if (issueDiff) return issueDiff;
      return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const total = issueItems.length;
  const totalPages = Math.ceil(total / limit);
  return {
    items: issueItems.slice((page - 1) * limit, (page - 1) * limit + limit),
    pagination: { page, limit, total, totalPages },
    summary
  };
}

export async function getAuditProduct(productId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const produto = await getProdutoById(productId, { accountId });
  const variations = await fetchAllAuditVariations(accountId);
  const productVariations = getProductVariations(produto);
  const mergedVariations = productVariations.length ? productVariations : variations.filter((variation) => String(variation.produto_id || variation.product_id || variation.productId || '') === String(productId));
  const fabricanteId = extractFabricanteId(produto, accountId);
  const fabricantes = await listFabricantes({}, { accountId });
  const fabricanteNome = fabricanteId ? (fabricantes.items || [])
    .filter((item) => String(item.account_id || item.accountId || '') === String(accountId))
    .find((item) => item.id === fabricanteId)?.nome || '-' : '-';
  const item = {
    ...produto,
    variacoes: mergedVariations,
    fabricanteId,
    fabricanteNome
  };
  return { ...item, issues: buildIssues(item, accountId, new Set(), new Set()) };
}

export async function linkFabricante(productId, fabricanteId, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getProdutoById(productId, { accountId });
  if (fabricanteId) await getFabricanteById(fabricanteId, { accountId });
  setLink(accountId, productId, fabricanteId || null);
  debugRepository('linkFabricante', { accountId, productId, fabricanteId });
  return getAuditProduct(productId, { accountId });
}

export async function fixProduct(productId, data = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  await getProdutoById(productId, { accountId });
  const payload = {};
  const allowed = ['nome', 'sku', 'categoria', 'subcategoria', 'familia', 'colecao', 'preco', 'preco_unitario', 'status', 'imagemUrl'];
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    payload[key] = data[key];
  }
  if (data.fabricanteId !== undefined) setLink(accountId, productId, data.fabricanteId || null);
  if (Object.keys(payload).length) {
    await updateProduto(productId, payload, { accountId });
  }
  return getAuditProduct(productId, { accountId });
}

export function __resetMemoryProductAuditForTests() {
  memoryLinks.length = 0;
}

export function __loadMemoryProductAuditLinks(items = []) {
  memoryLinks.length = 0;
  for (const item of items) memoryLinks.push({ ...item });
}

export function __dumpMemoryProductAuditLinks() {
  return memoryLinks.map((item) => ({ ...item }));
}
