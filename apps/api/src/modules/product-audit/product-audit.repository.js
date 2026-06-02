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

export async function auditSummary(options = {}) {
  const accountId = options.accountId || null;
  assertAccountId(accountId);
  const produtos = (await listProdutos({}, { accountId })).items || [];
  const fabricantes = (await listFabricantes({}, { accountId })).items || [];
  void fabricantes;

  const skuCounts = new Map();
  const nameCounts = new Map();
  for (const item of produtos) {
    const sku = String(item.sku || '').trim().toLowerCase();
    const name = String(item.nome || '').trim().toLowerCase();
    if (sku) skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
    if (name) nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
  }

  const duplicateSkuSet = new Set([...skuCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  const duplicateNameSet = new Set([...nameCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  const issues = new Map();

  const summary = {
    totalProducts: produtos.length,
    withFabricante: 0,
    withoutFabricante: 0,
    withImage: 0,
    withoutImage: 0,
    withCategory: 0,
    withoutCategory: 0,
    duplicates: 0,
    inactive: 0,
    zeroStock: 0,
    issues: []
  };

  for (const item of produtos) {
    const itemIssues = buildIssues(item, accountId, duplicateSkuSet, duplicateNameSet);
    if (extractFabricanteId(item, accountId)) summary.withFabricante += 1; else summary.withoutFabricante += 1;
    if (item.imagemUrl || item.imagem_url) summary.withImage += 1; else summary.withoutImage += 1;
    if (item.categoria) summary.withCategory += 1; else summary.withoutCategory += 1;
    if (itemIssues.includes('duplicate_sku') || itemIssues.includes('duplicate_name')) summary.duplicates += 1;
    if (itemIssues.includes('inactive_product')) summary.inactive += 1;
    if (itemIssues.includes('zero_stock')) summary.zeroStock += 1;
    for (const issue of itemIssues) issues.set(issue, (issues.get(issue) || 0) + 1);
  }

  summary.issues = [...issues.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => a.type.localeCompare(b.type));
  return summary;
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

  let filtered = products.map((item) => ({ ...item, issues: buildIssues(item, accountId, duplicateSkuSet, duplicateNameSet) }));
  if (filters.issue) filtered = filtered.filter((item) => item.issues.includes(filters.issue));
  if (filters.fabricanteId) filtered = filtered.filter((item) => item.fabricanteId === filters.fabricanteId);
  if (filters.status) filtered = filtered.filter((item) => String(item.status || '').toLowerCase() === String(filters.status).toLowerCase());
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    filtered = filtered.filter((item) => [item.nome, item.sku, item.categoria, item.fabricanteNome].some((value) => String(value || '').toLowerCase().includes(q)));
  }
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(100, Math.max(1, Number(filters.limit || 20)));
  const total = filtered.length;
  return { items: filtered.slice((page - 1) * limit, (page - 1) * limit + limit), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
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
