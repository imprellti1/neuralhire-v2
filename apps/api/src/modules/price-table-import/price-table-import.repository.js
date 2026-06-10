import { randomUUID } from 'node:crypto';
import xlsx from 'xlsx';
import { BadRequestError, ForbiddenError } from '../../core/errors.js';
import { listProdutos, updateProduto } from '../produtos/produtos.repository.js';

const importSessions = new Map();
const REF_HEADERS = ['ref', 'referencia', 'referência', 'sku', 'codigo', 'código', 'codigo_erp', 'cod', 'codigo produto', 'código produto'];
const PRICE_HEADERS = ['unitarior', 'unitario r', 'unitário r', 'preco', 'preço', 'valor', 'price', 'price r', 'preco unitario', 'preço unitário'];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { domain: 'price-table-import', code: 'TENANT_REQUIRED' });
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeRef(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d+(\.0+)?$/.test(raw)) return raw.replace(/\.0+$/, '');
  return raw.replace(/\s+/g, ' ').toLowerCase();
}

function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s+/g, '').replace(/^R\$/i, '').replace(/\./g, '').replace(/,/g, '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickHeaderIndex(headers, candidates) {
  const normalized = headers.map((header) => normalizeText(header));
  for (const candidate of candidates) {
    const idx = normalized.indexOf(normalizeText(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseWorkbook(buffer) {
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'price-table-import', code: 'INVALID_XLSX' });
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  } catch (error) {
    throw new BadRequestError('Nao foi possivel ler a planilha.', { domain: 'price-table-import', code: 'INVALID_XLSX', details: { cause: error?.message || String(error) } });
  }
  const sheetName = workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
    return rows.some((row) => row.some((cell) => String(cell ?? '').trim()));
  });
  if (!sheetName) throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'price-table-import', code: 'NO_SHEET_WITH_DATA' });
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  if (!rows.length) throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'price-table-import', code: 'NO_SHEET_WITH_DATA' });
  const headers = rows[0].map((cell) => String(cell ?? '').trim());
  const dataRows = rows.slice(1).map((row, index) => ({ rowNumber: index + 2, row })).filter((entry) => entry.row.some((cell) => String(cell ?? '').trim()));
  return { headers, dataRows, sheetName, sheetNames: workbook.SheetNames };
}

function isChildProduct(product = {}) {
  return Boolean(
    product.parent_id ||
    product.parentId ||
    product.produto_pai_id ||
    product.produtoPaiId ||
    product.produto_id_pai ||
    product.produtoIdPai ||
    product.produto_id_parent ||
    product.produtoIdParent ||
    String(product.tipo || '').toLowerCase() === 'variacao' ||
    String(product.type || '').toLowerCase() === 'variacao'
  );
}

function getProductRefs(product = {}) {
  const metadata = product.metadata || {};
  return [
    product.sku,
    product.codigo,
    product.codigo_produto,
    product.referencia,
    product.ref,
    metadata.sku,
    metadata.codigo,
    metadata.codigo_produto,
    metadata.referencia,
    metadata.ref
  ].map(normalizeRef).filter(Boolean);
}

async function listAllProdutos(accountId) {
  const collected = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const result = await listProdutos({ page, limit }, { accountId });
    collected.push(...(result.items || []));
    if (!result.items?.length || collected.length >= (result.total || 0) || page >= (result.totalPages || 1)) break;
    page += 1;
  }
  return collected;
}

function findProductByRef(products, ref) {
  const normalizedRef = normalizeRef(ref);
  if (!normalizedRef) return null;
  return products.find((product) => !isChildProduct(product) && getProductRefs(product).includes(normalizedRef)) || null;
}

function buildPreviewItems(rows, products) {
  const byRef = new Map();
  for (const entry of rows) {
    const ref = normalizeRef(entry.row[0]);
    if (!ref) continue;
    if (!byRef.has(ref)) byRef.set(ref, []);
    byRef.get(ref).push(entry);
  }

  const duplicatedRefs = new Set([...byRef.entries()].filter(([, entries]) => entries.length > 1).map(([ref]) => ref));
  const items = [];
  let invalidRows = 0;
  let matchedRows = 0;
  let unchangedRows = 0;
  let changedRows = 0;
  let unmatchedRows = 0;

  for (const entry of rows) {
    const ref = normalizeRef(entry.row[0]);
    const price = normalizePrice(entry.row[1]);
    const item = { rowNumber: entry.rowNumber, ref, rawPrice: entry.row[1] };
    if (duplicatedRefs.has(ref)) {
      item.status = 'duplicated_ref';
      item.message = 'Referência duplicada na planilha.';
      invalidRows += 1;
      items.push(item);
      continue;
    }
    if (!ref) {
      item.status = 'invalid_ref';
      item.message = 'Referência inválida ou vazia.';
      invalidRows += 1;
      items.push(item);
      continue;
    }
    if (!(price > 0)) {
      item.status = 'invalid_price';
      item.message = 'Preço unitário inválido.';
      invalidRows += 1;
      items.push(item);
      continue;
    }
    const product = findProductByRef(products, ref);
    if (!product) {
      item.status = 'unmatched';
      item.message = 'Produto não encontrado.';
      unmatchedRows += 1;
      items.push(item);
      continue;
    }
    item.productId = product.id;
    item.productName = product.nome || product.name || null;
    item.currentPrice = Number(product.preco || 0);
    item.newPrice = price;
    if (Number(item.currentPrice) === Number(price)) {
      item.status = 'matched_unchanged';
      item.message = 'Preço já está atualizado.';
      unchangedRows += 1;
    } else {
      item.status = 'matched_changed';
      item.message = 'Preço será atualizado.';
      changedRows += 1;
    }
    matchedRows += 1;
    items.push(item);
  }

  const validRows = rows.length - invalidRows;
  return {
    items,
    summary: {
      totalRows: rows.length,
      validRows,
      matchedRows,
      unmatchedRows,
      invalidRows,
      unchangedRows,
      changedRows
    }
  };
}

export async function previewPriceTableImport({ accountId, fileName, buffer }) {
  assertAccountId(accountId);
  const workbook = parseWorkbook(buffer);
  const refIndex = pickHeaderIndex(workbook.headers, REF_HEADERS);
  const priceIndex = pickHeaderIndex(workbook.headers, PRICE_HEADERS);
  if (refIndex < 0 || priceIndex < 0) {
    throw new BadRequestError('A planilha precisa conter colunas de referencia e preco unitario.', { domain: 'price-table-import', code: 'MISSING_COLUMNS' });
  }

  const products = await listAllProdutos(accountId);
  const rows = workbook.dataRows.map((entry) => ({
    rowNumber: entry.rowNumber,
    row: [entry.row[refIndex], entry.row[priceIndex]]
  }));
  const preview = buildPreviewItems(rows, products);
  const token = randomUUID();
  importSessions.set(token, {
    accountId,
    fileName: fileName || null,
    createdAt: new Date().toISOString(),
    rows: preview.items
  });

  return {
    ok: true,
    importToken: token,
    fileName: fileName || null,
    sheetName: workbook.sheetName,
    sheetNames: workbook.sheetNames,
    ...preview
  };
}

export async function executePriceTableImport({ accountId, importToken }) {
  assertAccountId(accountId);
  const session = importSessions.get(String(importToken || ''));
  if (!session || session.accountId !== accountId) {
    throw new BadRequestError('Prévia da importação não encontrada.', { domain: 'price-table-import', code: 'IMPORT_TOKEN_INVALID' });
  }
  const changedRows = session.rows.filter((item) => item.status === 'matched_changed');
  const updated = [];
  for (const item of changedRows) {
    updated.push(await updateProduto(item.productId, { preco: item.newPrice }, { accountId }));
  }
  importSessions.delete(String(importToken || ''));
  return {
    ok: true,
    summary: {
      updatedRows: changedRows.length,
      skippedRows: session.rows.length - changedRows.length
    },
    updated
  };
}

export function __resetPriceTableImportSessionsForTests() {
  importSessions.clear();
}

export function __normalizePriceTableRefForTests(value) {
  return normalizeRef(value);
}

export function __normalizePriceTableValueForTests(value) {
  return normalizePrice(value);
}
