import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getProdutoById, listProdutos, updateProduto, __dumpMemoryProdutos } from '../produtos/produtos.repository.js';
import { listFabricantes, getFabricanteById } from '../fabricantes/fabricantes.repository.js';

const memoryLinks = [];

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
  if (String(item.status || '').toLowerCase() === 'inativo' || item.ativo === false) issues.push('inactive_product');
  if (Number(item.estoque || 0) <= 0) issues.push('zero_stock');
  if (Array.isArray(item.variacoes) && item.variacoes.length) {
    if (item.variacoes.some((v) => !v?.imagemUrl && !v?.imagem_url)) issues.push('variation_without_image');
    if (item.variacoes.some((v) => Number(v?.estoque || 0) <= 0)) issues.push('variation_without_stock');
  }
  if (!Array.isArray(item.variacoes) || !item.variacoes.length) issues.push('missing_variations');
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
  return {
    issue: filters.issue ? String(filters.issue) : '',
    fabricanteId: filters.fabricanteId ? String(filters.fabricanteId) : '',
    status: filters.status ? String(filters.status) : '',
    search: filters.search ? String(filters.search) : ''
  };
}

function applyFilters(items, filters = {}) {
  let filtered = items;
  if (filters.issue) filtered = filtered.filter((item) => item.issues.includes(filters.issue));
  if (filters.fabricanteId) filtered = filtered.filter((item) => item.fabricanteId === filters.fabricanteId);
  if (filters.status) filtered = filtered.filter((item) => String(item.status || '').toLowerCase() === String(filters.status).toLowerCase());
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    filtered = filtered.filter((item) => [item.nome, item.sku, item.categoria, item.fabricanteNome].some((value) => String(value || '').toLowerCase().includes(q)));
  }
  return filtered;
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
  const audited = products.map((item) => ({ ...item, issues: buildIssues(item, accountId, duplicateSkuSet, duplicateNameSet) }));
  return {
    audited,
    applyFilters: (filters) => applyFilters(audited, filters),
    buildSummary: (items) => buildSummary(items)
  };
}

export async function auditSummary(options = {}) {
  const { filters = {} } = options;
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const produtos = (await listProdutos({}, { accountId })).items || [];
  const context = buildAuditContext(produtos, accountId);
  const normalizedFilters = normalizeFilters(filters);
  const filtered = context.applyFilters(normalizedFilters);
  return context.buildSummary(filtered);
}

export async function listAuditProducts(filters = {}, options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const response = await listProdutos({}, { accountId });
  const fabricantes = await listFabricantes({}, { accountId });
  const fabricanteById = new Map((fabricantes.items || []).map((item) => [item.id, item]));
  const products = (response.items || []).map((item) => {
    const fabricanteId = extractFabricanteId(item, accountId);
    return {
      ...item,
      fabricanteId,
      fabricanteNome: fabricanteId ? fabricanteById.get(fabricanteId)?.nome || '-' : '-'
    };
  });
  const context = buildAuditContext(products, accountId);
  const normalizedFilters = normalizeFilters(filters);
  const filtered = context.applyFilters(normalizedFilters);
  const summary = context.buildSummary(filtered);
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
  const fabricanteId = extractFabricanteId(produto, accountId);
  const fabricantes = await listFabricantes({}, { accountId });
  const fabricanteNome = fabricanteId ? (fabricantes.items || []).find((item) => item.id === fabricanteId)?.nome || '-' : '-';
  const detail = await listAuditProducts({ search: produto.nome }, { accountId });
  const item = (detail.items || []).find((row) => row.id === productId) || { ...produto, fabricanteId, fabricanteNome, issues: buildIssues(produto, accountId, new Set(), new Set()) };
  return { ...item, fabricanteId, fabricanteNome, issues: item.issues || buildIssues(item, accountId, new Set(), new Set()) };
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
