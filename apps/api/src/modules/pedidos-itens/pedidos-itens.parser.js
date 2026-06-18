import { Buffer } from 'node:buffer';
import xlsx from 'xlsx';
import { BadRequestError } from '../../core/errors.js';

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\s]+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeHeaderKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function isNonEmpty(value) {
  return String(value ?? '').trim() !== '';
}

function chooseSheetName(workbook) {
  const names = workbook?.SheetNames || [];
  for (const name of names) {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: false, raw: false });
    if (rows.some((row) => Array.isArray(row) && row.some(isNonEmpty))) return name;
  }
  return null;
}

function findHeaderIndex(headers, candidates) {
  const normalized = headers.map((header) => normalizeHeaderKey(header));
  for (const candidate of candidates) {
    const idx = normalized.indexOf(normalizeHeaderKey(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function resolveCell(row, index) {
  if (index < 0) return '';
  return row[index] ?? '';
}

function resolveNameCell(row, nameIndex, codeIndex) {
  const nameValue = resolveCell(row, nameIndex);
  if (isNonEmpty(nameValue)) return nameValue;
  return resolveCell(row, codeIndex);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim().replace(/\s+/g, '').replace(/^R\$/i, '');
  const raw = text.includes(',')
    ? text.replace(/\./g, '').replace(/,/g, '.')
    : text;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMoney(value) {
  const parsed = parseNumber(value);
  if (parsed === null || parsed < 0) return null;
  const rawText = typeof value === 'string' ? value.trim() : '';
  const hasDecimalSeparator = rawText.includes(',') || rawText.includes('.');
  const isIntegerLike = Number.isInteger(parsed) && !hasDecimalSeparator;
  const normalized = isIntegerLike ? parsed / 100 : parsed;
  return Number(normalized.toFixed(3));
}

export function normalizePedidoItensHeader(value) {
  return normalizeHeaderKey(value);
}

export function parsePedidosItensWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'pedidos-itens', code: 'INVALID_XLSX' });
  }

  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false, cellNF: false, cellFormula: false });
  } catch (error) {
    throw new BadRequestError('Nao foi possivel ler a planilha.', { domain: 'pedidos-itens', code: 'INVALID_XLSX', details: { cause: error?.message || String(error) } });
  }

  const sheetName = chooseSheetName(workbook);
  if (!sheetName) {
    throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'pedidos-itens', code: 'NO_SHEET_WITH_DATA' });
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false, raw: false })
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some(isNonEmpty));

  if (!rows.length) {
    throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'pedidos-itens', code: 'NO_SHEET_WITH_DATA' });
  }

  const headers = rows[0].map((header) => String(header ?? '').trim());
  const mapping = {
    codigo_produto_erp_original: findHeaderIndex(headers, ['codigo_produto_erp_original', 'codigo produto erp', 'codigo produto', 'codigo produto sku', 'codigo produto codigo', 'produto codigo', 'produto', 'codigo', 'sku', 'codigo sku', 'codigo_erp', 'codigo erp', 'referencia', 'referencia erp']),
    nome_produto_original: findHeaderIndex(headers, ['nome_produto_original', 'nome produto', 'descricao', 'descrição', 'descricao do produto', 'nome', 'produto nome']),
    cor_original: findHeaderIndex(headers, ['cor', 'color', 'variante cor']),
    tamanho_original: findHeaderIndex(headers, ['tamanho_original', 'tamanho', 'grade', 'numero', 'num', 'size']),
    ean_original: findHeaderIndex(headers, ['ean', 'gtin', 'barcode', 'codigo de barras']),
    quantidade: findHeaderIndex(headers, ['quantidade', 'qtd', 'qtde', 'qt', 'volume']),
    valor_unitario: findHeaderIndex(headers, ['valor_unitario', 'valor unitario', 'valor unitário', 'unitario', 'unitário', 'preco unitario', 'preço unitário', 'preco', 'valor unit']),
    valor_total: findHeaderIndex(headers, ['valor_total', 'valor total', 'total', 'subtotal'])
  };

  const required = ['codigo_produto_erp_original', 'tamanho_original', 'quantidade'];
  const missing = required.filter((key) => mapping[key] < 0);
  if (missing.length) {
    throw new BadRequestError(`Colunas essenciais ausentes no XLSX: ${missing.join(', ')}`, { domain: 'pedidos-itens', code: 'MISSING_COLUMNS', details: { missing } });
  }

  const dataRows = rows.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    codigo_produto_erp_original: resolveCell(row, mapping.codigo_produto_erp_original),
    nome_produto_original: resolveNameCell(row, mapping.nome_produto_original, mapping.codigo_produto_erp_original),
    cor_original: resolveCell(row, mapping.cor_original),
    tamanho_original: resolveCell(row, mapping.tamanho_original),
    ean_original: resolveCell(row, mapping.ean_original),
    quantidade: parseNumber(resolveCell(row, mapping.quantidade)),
    valor_unitario: parseNumber(resolveCell(row, mapping.valor_unitario)),
    valor_total: parseMoney(resolveCell(row, mapping.valor_total))
  })).filter((row) => Object.values(row).some((value) => value !== '' && value !== null && value !== undefined));

  return { workbook, sheetName, headers, mapping, dataRows };
}
