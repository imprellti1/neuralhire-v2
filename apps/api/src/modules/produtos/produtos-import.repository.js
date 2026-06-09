import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import xlsx from 'xlsx';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';
import { createProduto, listProdutos, updateProduto } from './produtos.repository.js';
import { createVariation, listVariations, updateVariation } from '../product-editor/product-editor.repository.js';

const memoryBatches = [];
const memoryStocks = [];
const MAX_PREVIEW_ROWS = 50;
const VARIATION_HEADERS = ['P', 'M', 'G', 'GG', '35-36', '37-38', '39-40', '41-42', '43-44', 'UNI'];
const STOCK_HEADER_HINTS = ['estoque', 'quantidade', 'qtd', 'saldo'];
const CATEGORY_HEADER_HINTS = ['categoria', 'grupo'];
const PRICE_HEADER_HINTS = ['preco', 'preço', 'valor'];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produtos-import' });
}

function mode() {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

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

function toQuantity(value) {
  if (value === '' || value === null || value === undefined) return null;
  const raw = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isNonEmpty(value) {
  return String(value ?? '').trim() !== '';
}

function splitDescricaoProduto(descricao = '') {
  const raw = String(descricao || '').trim();
  if (!raw) return null;
  const parts = raw.split(' - ').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return { codigo_erp: parts[0], nome_produto: parts[0], variacao_nome: null };
  return {
    codigo_erp: parts[0],
    nome_produto: parts.length >= 3 ? parts[1] : parts[parts.length - 1],
    variacao_nome: parts.length >= 3 ? parts.slice(2).join(' - ') : null
  };
}

function chooseSheetName(workbook) {
  const names = workbook?.SheetNames || [];
  if (!names.length) return null;
  const agGrid = names.find((name) => normalizeText(name) === 'ag grid');
  if (agGrid) return agGrid;
  return names.find((name) => workbook.Sheets?.[name]?.['!ref']) || names[0] || null;
}

function parseRowsFromSheet(sheet) {
  return xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false })
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some(isNonEmpty));
}

function findHeaderIndex(headers, hints) {
  const normalized = headers.map((header) => normalizeHeaderKey(header));
  for (const hint of hints) {
    const idx = normalized.indexOf(normalizeHeaderKey(hint));
    if (idx >= 0) return idx;
  }
  return -1;
}

function detectColumns(headers) {
  const variationIndexes = new Map();
  for (const grade of VARIATION_HEADERS) {
    const idx = findHeaderIndex(headers, [grade]);
    if (idx >= 0) variationIndexes.set(grade.toUpperCase(), idx);
  }
  return {
    descriptionIndex: findHeaderIndex(headers, ['produto', 'nome', 'descricao', 'descrição']),
    skuIndex: findHeaderIndex(headers, ['sku', 'codigo', 'código', 'referencia', 'referência']),
    categoryIndex: findHeaderIndex(headers, CATEGORY_HEADER_HINTS),
    priceIndex: findHeaderIndex(headers, PRICE_HEADER_HINTS),
    stockIndex: findHeaderIndex(headers, STOCK_HEADER_HINTS),
    variationIndexes
  };
}

function validateMinimalColumns(headers) {
  const columns = detectColumns(headers);
  if (columns.descriptionIndex < 0 && columns.skuIndex < 0) {
    throw new BadRequestError('A planilha precisa conter ao menos uma coluna de produto/nome/descrição.', { domain: 'produtos-import', code: 'MISSING_MINIMAL_COLUMNS' });
  }
}

function resolveRowObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    const key = String(header || '').trim();
    if (key) obj[key] = row[index] ?? '';
  });
  return obj;
}

async function parseImportWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new BadRequestError('Nao foi possivel ler a planilha.', { domain: 'produtos-import', code: 'INVALID_XLSX' });
  }
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false, cellNF: false, cellFormula: false });
  } catch (error) {
    throw new BadRequestError('Nao foi possivel ler a planilha.', { domain: 'produtos-import', code: 'INVALID_XLSX', details: { cause: error?.message || String(error) } });
  }
  const sheetName = chooseSheetName(workbook);
  if (!sheetName) {
    throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'produtos-import', code: 'NO_SHEET_WITH_DATA' });
  }
  const rows = parseRowsFromSheet(workbook.Sheets[sheetName]);
  if (!rows.length) {
    throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'produtos-import', code: 'NO_SHEET_WITH_DATA' });
  }
  const headers = rows[0].map((header) => String(header || '').trim());
  validateMinimalColumns(headers);
  return {
    workbook,
    sheetName,
    sheetNames: workbook.SheetNames || [],
    headers,
    dataRows: rows.slice(1).map((row) => resolveRowObject(headers, row)).filter((row) => Object.values(row).some(isNonEmpty))
  };
}

async function createBatchRecord(payload) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('produto_import_batches').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar batch', { details: error });
    return data;
  }
  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryBatches.push(item);
  return item;
}

async function updateBatchRecord(batchId, patch = {}) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('produto_import_batches').update(patch).eq('id', batchId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar batch', { details: error });
    return data;
  }
  const index = memoryBatches.findIndex((batch) => batch.id === batchId);
  if (index < 0) return null;
  memoryBatches[index] = { ...memoryBatches[index], ...patch, updated_at: new Date().toISOString() };
  return memoryBatches[index];
}

async function findBatchById(batchId) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('produto_import_batches').select('*').eq('id', batchId).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar batch', { details: error });
    return data;
  }
  return memoryBatches.find((batch) => batch.id === batchId) || null;
}

function makeStockKey(record) {
  return [record.account_id, record.produto_id, record.variacao_id, record.fabricante_id].join('::');
}

async function upsertStockRecord(record) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: existing, error: findError } = await supabase
      .from('produto_variacao_estoques')
      .select('*')
      .eq('account_id', record.account_id)
      .eq('produto_id', record.produto_id)
      .eq('variacao_id', record.variacao_id)
      .eq('fabricante_id', record.fabricante_id)
      .maybeSingle();
    if (findError) throw new DatabaseError('Falha ao consultar estoque', { details: findError });
    if (existing) {
      const { data, error } = await supabase.from('produto_variacao_estoques').update(record).eq('id', existing.id).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar estoque', { details: error });
      return { row: data, created: false };
    }
    const { data, error } = await supabase.from('produto_variacao_estoques').insert(record).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar estoque', { details: error });
    return { row: data, created: true };
  }
  const key = makeStockKey(record);
  const index = memoryStocks.findIndex((stock) => makeStockKey(stock) === key);
  if (index >= 0) {
    memoryStocks[index] = { ...memoryStocks[index], ...record, updated_at: new Date().toISOString() };
    return { row: memoryStocks[index], created: false };
  }
  const row = { id: randomUUID(), ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryStocks.push(row);
  return { row, created: true };
}

async function ensureFabricante(accountId, fabricanteId) {
  const fabricante = await getFabricanteById(fabricanteId, { accountId }).catch(() => null);
  if (!fabricante) throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import' });
  if (String(fabricante.account_id || '') !== String(accountId || '')) {
    throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import', code: 'FABRICANTE_CROSS_TENANT' });
  }
  return fabricante;
}

function buildImportIdentity(row, headers) {
  const columns = detectColumns(headers);
  const description = columns.descriptionIndex >= 0 ? row[headers[columns.descriptionIndex]] : '';
  const sku = columns.skuIndex >= 0 ? row[headers[columns.skuIndex]] : '';
  const parsed = splitDescricaoProduto(description);
  const codigo = parsed?.codigo_erp || String(sku || description || '').trim() || null;
  const nome = parsed?.nome_produto || String(description || sku || '').trim() || null;
  return {
    parsed: parsed || { codigo_erp: codigo, nome_produto: nome, variacao_nome: null },
    codigo,
    nome,
    categoria: columns.categoryIndex >= 0 ? String(row[headers[columns.categoryIndex]] || '').trim() || null : null,
    preco: columns.priceIndex >= 0 ? toQuantity(row[headers[columns.priceIndex]]) : null,
    estoque: columns.stockIndex >= 0 ? toQuantity(row[headers[columns.stockIndex]]) : null,
    columns
  };
}

function buildVariationsFromRow(row, headers, parsed, columns) {
  const variations = [];
  let totalGrades = 0;
  for (const grade of VARIATION_HEADERS) {
    const index = columns.variationIndexes.get(grade.toUpperCase());
    if (index === undefined) continue;
    const quantity = toQuantity(row[headers[index]]);
    if (quantity === null || quantity < 0) continue;
    totalGrades += quantity;
    if (quantity === 0) continue;
    const baseName = parsed.variacao_nome || 'PADRAO';
    variations.push({ nome: grade === 'UNI' ? baseName : `${baseName} / ${grade}`, grade, quantidade: quantity });
  }
  return { variations, totalGrades };
}

async function findProductByIdentity(accountId, fabricanteId, identity) {
  const search = String(identity.codigo || identity.nome || '').trim();
  if (!search) return null;
  const result = await listProdutos({ search, page: 1, limit: 100 }, { accountId });
  return (result.items || []).find((item) => String(item.fabricante_id || '') === String(fabricanteId) && [item.sku, item.codigo, item.nome].some((value) => String(value || '').trim() === search)) || null;
}

async function upsertProdutoPai(accountId, fabricanteId, identity) {
  const existing = await findProductByIdentity(accountId, fabricanteId, identity);
  const payload = {
    fabricante_id: fabricanteId,
    codigo: identity.codigo || null,
    sku: identity.codigo || null,
    nome: identity.nome || identity.codigo || 'Produto importado',
    descricao: identity.nome || null,
    categoria: identity.categoria || null,
    ativo: true
  };
  if (existing) return { item: await updateProduto(existing.id, payload, { accountId }), created: false };
  return { item: await createProduto({ ...payload, preco: identity.preco ?? 0, estoque: identity.estoque ?? 0 }, { accountId }), created: true };
}

async function upsertVariacao(accountId, produtoId, parsed, grade) {
  const nome = grade === 'UNI' ? parsed.variacao_nome || 'UNI' : `${parsed.variacao_nome || 'PADRAO'} / ${grade}`;
  const variations = await listVariations(produtoId, { accountId });
  const existing = variations.find((v) => String(v.nome) === String(nome) && String(v.grade || '') === String(grade));
  const payload = { sku: `${parsed.codigo_erp || parsed.nome_produto}-${grade}`, nome, valor: parsed.variacao_nome || '', cor: parsed.variacao_nome || '', preco: 0, ativo: true, multiplo_venda: 1, grade, tamanho: grade };
  if (existing) return { item: await updateVariation(produtoId, existing.id, payload, { accountId }), created: false };
  return { item: await createVariation(produtoId, payload, { accountId }), created: true };
}

function buildPreviewErrorRow(rowIndex, message, row) {
  return { row: rowIndex, message, raw: row };
}

export async function previewImportXlsx({ accountId, fabricanteId, fileName, buffer }) {
  assertAccountId(accountId);
  await ensureFabricante(accountId, fabricanteId);
  const parsedWorkbook = await parseImportWorkbook(buffer);
  console.log('[produtos-import] preview', {
    fileName: fileName || null,
    size: Buffer.isBuffer(buffer) ? buffer.length : 0,
    sheets: parsedWorkbook.sheetNames,
    chosenSheet: parsedWorkbook.sheetName,
    rows: parsedWorkbook.dataRows.length
  });

  const errors = [];
  const sampleRows = [];
  let totalValid = 0;
  let totalInvalid = 0;
  let divergences = 0;

  parsedWorkbook.dataRows.forEach((row, index) => {
    const identity = buildImportIdentity(row, parsedWorkbook.headers);
    if (!identity.parsed?.codigo_erp && !identity.parsed?.nome_produto) {
      totalInvalid += 1;
      errors.push(buildPreviewErrorRow(index + 2, 'A planilha precisa conter ao menos uma coluna de produto/nome/descrição.', row));
      return;
    }
    const { variations, totalGrades } = buildVariationsFromRow(row, parsedWorkbook.headers, identity.parsed, identity.columns);
    if (identity.estoque !== null && identity.estoque !== totalGrades) divergences += 1;
    totalValid += 1;
    if (sampleRows.length < MAX_PREVIEW_ROWS) {
      sampleRows.push({
        codigo_erp: identity.parsed.codigo_erp,
        nome_produto: identity.parsed.nome_produto,
        variacao_nome: identity.parsed.variacao_nome,
        categoria: identity.categoria,
        total: identity.estoque,
        totalGrades,
        variationsCount: variations.length,
        hasStock: variations.some((variation) => variation.quantidade > 0),
        raw: row
      });
    }
  });

  const batch = await createBatchRecord({
    account_id: accountId,
    fabricante_id: fabricanteId,
    arquivo_nome: fileName || null,
    status: 'preview',
    total_linhas: parsedWorkbook.dataRows.length,
    linhas_processadas: 0,
    produtos_criados: 0,
    produtos_atualizados: 0,
    variacoes_criadas: 0,
    variacoes_atualizadas: 0,
    estoques_atualizados: 0,
    erros: totalInvalid,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  return {
    ok: true,
    batchId: batch.id,
    totalRows: parsedWorkbook.dataRows.length,
    totalValid,
    totalInvalid,
    divergences,
    errors: errors.slice(0, 10),
    sampleRows,
    headers: parsedWorkbook.headers,
    sheetName: parsedWorkbook.sheetName,
    sheetNames: parsedWorkbook.sheetNames
  };
}

export async function executeImportXlsx({ accountId, fabricanteId, fileName, buffer }) {
  assertAccountId(accountId);
  await ensureFabricante(accountId, fabricanteId);
  const parsedWorkbook = await parseImportWorkbook(buffer);
  const preview = await previewImportXlsx({ accountId, fabricanteId, fileName, buffer });
  const batch = await updateBatchRecord(preview.batchId, {
    status: 'processing',
    arquivo_nome: fileName || null,
    fabricante_id: fabricanteId,
    total_linhas: parsedWorkbook.dataRows.length,
    linhas_processadas: 0,
    produtos_criados: 0,
    produtos_atualizados: 0,
    variacoes_criadas: 0,
    variacoes_atualizadas: 0,
    estoques_atualizados: 0,
    erros: 0
  });

  const summary = {
    batchId: batch.id,
    arquivo_nome: fileName || null,
    fabricante_id: fabricanteId,
    status: 'processing',
    total_linhas: parsedWorkbook.dataRows.length,
    linhas_processadas: 0,
    produtos_criados: 0,
    produtos_atualizados: 0,
    variacoes_criadas: 0,
    variacoes_atualizadas: 0,
    estoques_atualizados: 0,
    divergencias: preview.divergences || 0,
    erros: []
  };

  try {
    for (const row of parsedWorkbook.dataRows) {
      const identity = buildImportIdentity(row, parsedWorkbook.headers);
      if (!identity.parsed?.codigo_erp && !identity.parsed?.nome_produto) {
        summary.erros.push({ linha: summary.linhas_processadas + 2, message: 'A planilha precisa conter ao menos uma coluna de produto/nome/descrição.' });
        continue;
      }
      const productUpsert = await upsertProdutoPai(accountId, fabricanteId, identity);
      summary[productUpsert.created ? 'produtos_criados' : 'produtos_atualizados'] += 1;
      const { variations } = buildVariationsFromRow(row, parsedWorkbook.headers, identity.parsed, identity.columns);
      for (const variation of variations) {
        const variationUpsert = await upsertVariacao(accountId, productUpsert.item.id, identity.parsed, variation.grade);
        summary[variationUpsert.created ? 'variacoes_criadas' : 'variacoes_atualizadas'] += 1;
        await upsertStockRecord({
          account_id: accountId,
          produto_id: productUpsert.item.id,
          variacao_id: variationUpsert.item.id,
          fabricante_id: fabricanteId,
          quantidade: variation.quantidade,
          origem: 'IMPORTACAO_XLSX',
          arquivo_origem: fileName || null,
          import_batch_id: batch.id
        });
        summary.estoques_atualizados += 1;
      }
      summary.linhas_processadas += 1;
    }
    const finalStatus = summary.erros.length || summary.divergencias ? 'completed_with_warnings' : 'completed';
    await updateBatchRecord(batch.id, { ...summary, status: finalStatus, erros: summary.erros.length, updated_at: new Date().toISOString() });
    return { ok: true, batch: { ...summary, status: finalStatus, erros: summary.erros } };
  } catch (error) {
    await updateBatchRecord(batch.id, { status: 'failed', erros: summary.erros.length + 1, updated_at: new Date().toISOString() }).catch(() => null);
    throw error;
  }
}

export function splitDescricaoProdutoExport(descricao = '') {
  return splitDescricaoProduto(descricao);
}

export async function __dumpImportMemory() {
  return { batches: memoryBatches.map((x) => ({ ...x })), stocks: memoryStocks.map((x) => ({ ...x })) };
}

export async function upsertProdutoImportBatch(patch) {
  if (!patch?.id) return null;
  return updateBatchRecord(patch.id, patch);
}

export async function getProdutoImportBatch(batchId) {
  return findBatchById(batchId);
}
