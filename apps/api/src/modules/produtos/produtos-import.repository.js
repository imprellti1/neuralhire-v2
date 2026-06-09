import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import xlsx from 'xlsx';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';
import { listProdutoCategorias } from '../produto-categorias/produto-categorias.repository.js';
import { createProduto, listProdutos, updateProduto } from './produtos.repository.js';
import { createVariation, listVariations, updateVariation } from '../product-editor/product-editor.repository.js';

const memoryBatches = [];
const memoryStocks = [];
const categoriaLookupCache = new Map();
const MAX_PREVIEW_ROWS = 50;
const VARIATION_HEADERS = ['P', 'M', 'G', 'GG', '35-36', '37-38', '39-40', '41-42', '43-44', 'UNI'];
const STOCK_HEADER_HINTS = ['estoque', 'quantidade', 'qtd', 'saldo'];
const CATEGORY_HEADER_HINTS = ['categoria', 'grupo'];
const PRICE_HEADER_HINTS = ['preco', 'preço', 'valor'];
const PRODUTO_VARIACOES_SELECT_FIELDS = 'id, account_id, produto_id, sku, nome, valor, cor, grade, estoque_atual, ativo';
const PRODUTO_IMPORT_BATCH_FIELDS = [
  'account_id',
  'fabricante_id',
  'arquivo_nome',
  'status',
  'total_linhas',
  'linhas_processadas',
  'produtos_criados',
  'produtos_atualizados',
  'variacoes_criadas',
  'variacoes_atualizadas',
  'estoques_atualizados',
  'erros',
  'created_at',
  'updated_at'
];
const IMPORT_PROGRESS_STEP = 25;
const CHUNK_SIZE = 100;

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
  if (parts.length === 1) return { codigo_erp: parts[0], nome_produto: parts[0], cor: null, variacao_nome: null };
  return {
    codigo_erp: parts[0],
    nome_produto: parts.length >= 3 ? parts.slice(1, -1).join(' - ') : parts[1],
    cor: parts.length >= 3 ? parts[parts.length - 1] : null,
    variacao_nome: parts.length >= 3 ? parts[parts.length - 1] : null
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
  const hasRequiredBaseColumns = columns.descriptionIndex >= 0 || columns.skuIndex >= 0;
  const hasVariationColumns = columns.variationIndexes.size > 0;
  if (!hasRequiredBaseColumns && !hasVariationColumns) {
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
  const { batchId: _ignoredBatchId, ...persistedPatch } = patch || {};
  const batchPayload = Object.fromEntries(
    Object.entries(persistedPatch).filter(([key]) => PRODUTO_IMPORT_BATCH_FIELDS.includes(key))
  );
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.from('produto_import_batches').update(batchPayload).eq('id', batchId).select('*').single();
      if (error) {
        console.error('[produtos-import] updateBatchRecord failed', {
          batchId,
          payload: batchPayload,
          error
        });
        throw new DatabaseError('Falha ao atualizar batch', { details: error });
      }
      return data;
    } catch (error) {
      console.error('[produtos-import] updateBatchRecord failed', {
        batchId,
        payload: batchPayload,
        error: {
          message: error?.message || String(error),
          code: error?.code || null,
          details: error?.details || null,
          hint: error?.hint || null,
          stack: error?.stack || null
        }
      });
      throw error;
    }
  }
  const index = memoryBatches.findIndex((batch) => batch.id === batchId);
  if (index < 0) return null;
  memoryBatches[index] = { ...memoryBatches[index], ...batchPayload, updated_at: new Date().toISOString() };
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

function buildVariationIdentity(record = {}) {
  const accountId = String(record.account_id || '').trim();
  const produtoId = String(record.produto_id || '').trim();
  const grade = String(record.grade || record.tamanho || '').trim();
  const nome = String(record.nome || '').trim() || (grade ? grade : '');
  return {
    accountId,
    produtoId,
    nome,
    grade
  };
}

function buildVariationMapKey({ accountId, produtoId, nome, grade }) {
  return [accountId, produtoId, nome, grade].map((value) => String(value || '').trim()).join('::');
}

async function confirmVariationFromDatabase(supabase, variationIdentity) {
  const { data, error } = await supabase
    .from('produto_variacoes')
    .select(PRODUTO_VARIACOES_SELECT_FIELDS)
    .eq('account_id', variationIdentity.accountId)
    .eq('produto_id', variationIdentity.produtoId)
    .eq('nome', variationIdentity.nome)
    .eq('grade', variationIdentity.grade)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function ensureVariationInDatabase(supabase, record, variationIdentity) {
  const conflictPayload = {
    account_id: variationIdentity.accountId,
    produto_id: variationIdentity.produtoId,
    sku: record.sku || null,
    nome: variationIdentity.nome || null,
    valor: record.valor || null,
    cor: record.cor || null,
    grade: variationIdentity.grade || null,
    estoque_atual: 0,
    ativo: true
  };

  const { error: upsertError } = await supabase
    .from('produto_variacoes')
    .upsert(conflictPayload, { onConflict: 'account_id,produto_id,nome,grade' })
    .select('id')
    .maybeSingle();
  if (upsertError) throw upsertError;

  const confirmedVariation = await confirmVariationFromDatabase(supabase, variationIdentity);
  if (!confirmedVariation?.id) {
    throw new BadRequestError('Falha ao confirmar variação de estoque.', { domain: 'produtos-import', code: 'VARIACAO_ESTOQUE_NAO_CONFIRMADA' });
  }
  return confirmedVariation;
}

async function findExistingVariationsForProduct(supabase, accountId, produtoId) {
  const { data, error } = await supabase
    .from('produto_variacoes')
    .select(PRODUTO_VARIACOES_SELECT_FIELDS)
    .eq('account_id', accountId)
    .eq('produto_id', produtoId);
  if (error) throw new DatabaseError('Falha ao consultar estoque', { details: error });
  const map = new Map();
  for (const variation of data || []) {
    const identity = buildVariationIdentity(variation);
    map.set(buildVariationMapKey(identity), variation);
  }
  return map;
}

async function recalculateProductAvailability(supabase, accountId, produtoId) {
  const { data, error } = await supabase
    .from('produto_variacoes')
    .select('id, ativo, estoque_atual')
    .eq('account_id', accountId)
    .eq('produto_id', produtoId);
  if (error) throw new DatabaseError('Falha ao consultar disponibilidade do produto', { details: error });
  const variations = data || [];
  const hasAvailableVariation = variations.some((variation) => Boolean(variation?.ativo) && Number(variation?.estoque_atual || 0) >= 10);
  const { error: updateError } = await supabase
    .from('produtos')
    .update({ ativo: hasAvailableVariation })
    .eq('id', produtoId)
    .eq('account_id', accountId);
  if (updateError) throw new DatabaseError('Falha ao atualizar disponibilidade do produto', { details: updateError });
  return hasAvailableVariation;
}

async function upsertStockRecord(record, confirmedVariation) {
  try {
    if (mode() === 'supabase') {
      const supabase = getSupabaseClient();
      const nextQuantidade = toQuantity(record.quantidade);
      if (nextQuantidade === null || nextQuantidade < 0) {
        throw new BadRequestError('Quantidade de estoque invalida', { domain: 'produtos-import', code: 'INVALID_STOCK_QUANTITY' });
      }

      if (!confirmedVariation?.id) {
        throw new BadRequestError('Falha ao confirmar variação de estoque.', { domain: 'produtos-import', code: 'VARIACAO_ESTOQUE_NAO_CONFIRMADA' });
      }

      const previousQuantidade = Number(confirmedVariation?.estoque_atual || 0);
      const desiredActive = nextQuantidade >= 10;
      if (previousQuantidade === nextQuantidade && Boolean(confirmedVariation?.ativo) === desiredActive) {
        return { row: confirmedVariation, created: false };
      }
      const { data: updatedVariation, error: updateError } = await supabase
        .from('produto_variacoes')
        .update({
          estoque_atual: nextQuantidade,
          ativo: desiredActive
        })
        .eq('id', confirmedVariation.id)
        .eq('account_id', confirmedVariation.account_id || record.account_id || null)
        .select(PRODUTO_VARIACOES_SELECT_FIELDS)
        .maybeSingle();
      if (updateError) throw updateError;
      const lookupResult = updatedVariation ? null : await confirmVariationFromDatabase(supabase, buildVariationIdentity(record));
      const resolvedUpdatedVariation = updatedVariation || lookupResult || confirmedVariation;
      if (!resolvedUpdatedVariation?.id) {
        throw new BadRequestError('Falha ao confirmar variação de estoque.', { domain: 'produtos-import', code: 'VARIACAO_ESTOQUE_NAO_CONFIRMADA' });
      }
      return { row: resolvedUpdatedVariation, created: false };
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
  } catch (error) {
    if (error?.code === '23505') {
      console.error('[produtos-import] insertVariationPayload', {
        accountId: record.account_id || null,
        produtoId: record.produto_id || null,
        nome: record.nome || null,
        grade: record.grade || null
      });
    }
    console.error('[produtos-import] stock upsert failed', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint
    });
    throw new DatabaseError('Falha ao criar estoque', { details: error });
  }
}

async function ensureFabricante(accountId, fabricanteId) {
  const fabricante = await getFabricanteById(fabricanteId, { accountId }).catch(() => null);
  if (!fabricante) throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import' });
  if (String(fabricante.account_id || '') !== String(accountId || '')) {
    throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import', code: 'FABRICANTE_CROSS_TENANT' });
  }
  return fabricante;
}

async function resolveCategoriaForProduto(accountId, categoriaNome) {
  const nome = String(categoriaNome || '').trim();
  if (!nome) return { categoria: null, categoria_id: null };
  const cacheKey = `${accountId}::${nome.toLowerCase()}`;
  if (categoriaLookupCache.has(cacheKey)) return categoriaLookupCache.get(cacheKey);
  const result = await listProdutoCategorias({}, { accountId });
  const match = (result.items || []).find((categoria) => String(categoria.nome || '').trim().toLowerCase() === nome.toLowerCase());
  const resolved = {
    categoria: nome,
    categoria_id: match?.id || null
  };
  categoriaLookupCache.set(cacheKey, resolved);
  return resolved;
}

function buildImportIdentity(row, headers) {
  const columns = detectColumns(headers);
  const description = columns.descriptionIndex >= 0 ? row[headers[columns.descriptionIndex]] : '';
  const sku = columns.skuIndex >= 0 ? row[headers[columns.skuIndex]] : '';
  const parsed = splitDescricaoProduto(description);
  const codigo = parsed?.codigo_erp || String(sku || description || '').trim() || null;
  const nome = parsed?.nome_produto || String(description || sku || '').trim() || null;
  return {
    parsed: parsed || { codigo_erp: codigo, nome_produto: nome, cor: null, variacao_nome: null },
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
  for (const grade of VARIATION_HEADERS) {
    const index = columns.variationIndexes.get(grade.toUpperCase());
    if (index === undefined) continue;
    const quantity = toQuantity(row[headers[index]]);
    if (quantity === null || quantity <= 0) continue;
    const cor = parsed.cor || parsed.variacao_nome || null;
    const baseName = cor || 'PADRAO';
    variations.push({
      nome: grade === 'UNI' ? baseName : `${baseName} / ${grade}`,
      grade,
      cor,
      quantidade: quantity
    });
  }
  return { variations };
}

function buildNormalizedItemsFromRow(row, headers, parsed, columns) {
  const { variations } = buildVariationsFromRow(row, headers, parsed, columns);
  const items = variations.length
    ? variations.map((variation) => ({
      codigo_erp: parsed.codigo_erp || parsed.codigo || null,
      nome_produto: parsed.nome_produto || parsed.nome || null,
      variacao_nome: variation.cor || parsed.cor || parsed.variacao_nome || null,
      sku: parsed.codigo_erp || parsed.codigo || null,
      nome: parsed.nome_produto || parsed.nome || null,
      cor: variation.cor || parsed.cor || parsed.variacao_nome || null,
      grade: variation.grade || variation.tamanho || null,
      tamanho: variation.tamanho || variation.grade || null,
      estoque: Number(variation.quantidade || 0),
      total: Number(variation.quantidade || 0),
      totalStock: Number(variation.quantidade || 0),
      variations: [{ grade: variation.grade || variation.tamanho || null, quantidade: Number(variation.quantidade || 0) }],
      variationsCount: 1
    }))
    : [];
  return { variations, items };
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getParentSkuFromItem(item = {}) {
  return String(item.codigo_erp || item.sku || item.nome_produto || '').trim() || null;
}

function getParentNameFromItem(item = {}) {
  return String(item.nome_produto || item.nome || item.codigo_erp || '').trim() || null;
}

function buildVariationPayloadFromItem(item = {}, parentId, accountId, fabricanteId) {
  const grade = String(item.grade || item.tamanho || '').trim() || null;
  const cor = String(item.cor || item.variacao_nome || '').trim() || null;
  const nome = grade === 'UNI'
    ? (cor || 'UNI')
    : `${cor || 'PADRAO'} / ${grade}`;
  const estoque = Number(item.estoque || 0);
  const ativo = estoque >= 10;
  return {
    account_id: accountId,
    produto_id: parentId,
    sku: `${String(item.codigo_erp || item.sku || item.nome_produto || 'SKU').trim()}-${grade || 'UNI'}`,
    nome,
    valor: cor || '',
    cor,
    grade,
    estoque_atual: estoque,
    ativo
  };
}

async function fetchExistingProductsBySku(supabase, accountId, fabricanteId, skus = []) {
  const uniqueSkus = [...new Set((skus || []).map((sku) => String(sku || '').trim()).filter(Boolean))];
  if (!uniqueSkus.length) return [];
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('account_id', accountId)
    .eq('fabricante_id', fabricanteId)
    .in('sku', uniqueSkus);
  if (error) throw new DatabaseError('Falha ao consultar produtos existentes', { details: error });
  return data || [];
}

async function fetchExistingVariationsByProductIds(supabase, accountId, productIds = []) {
  const uniqueIds = [...new Set((productIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!uniqueIds.length) return [];
  const variations = [];

  for (let index = 0; index < uniqueIds.length; index += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(index, index + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('produto_variacoes')
      .select(PRODUTO_VARIACOES_SELECT_FIELDS)
      .eq('account_id', accountId)
      .in('produto_id', chunk);

    if (error) {
      console.error('[produtos-import] fetch existing variations error', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        productIdsCount: productIds?.length,
        productIdsSample: productIds?.slice(0, 5),
        chunkIndex: index / CHUNK_SIZE,
        chunkSize: chunk.length
      });
      throw new DatabaseError('Falha ao consultar variacoes existentes', { details: error });
    }

    if (data?.length) {
      variations.push(...data);
    }
  }

  return variations;
}

function buildVariationLookupKey(accountId, produtoId, nome, grade) {
  return [normalizeKey(accountId), normalizeKey(produtoId), normalizeKey(nome), normalizeKey(grade)].join('::');
}

function buildProductParentActiveState(variations = []) {
  return variations.some((variation) => Boolean(variation?.ativo) && Number(variation?.estoque_atual || 0) >= 10);
}

export function __buildVariationsFromRowForTests(row, headers, parsed, columns) {
  return buildVariationsFromRow(row, headers, parsed, columns);
}

async function upsertProdutoPai(accountId, fabricanteId, identity) {
  const search = String(identity.codigo || identity.nome || '').trim();
  console.log('[produtos-import] search start', { accountId, fabricanteId, search });
  const result = await listProdutos({ search, page: 1, limit: 100 }, { accountId });
  console.log('[produtos-import] search result count', { count: result?.items?.length || 0 });
  const existing = (result.items || []).find((item) => String(item.fabricante_id || '') === String(fabricanteId) && [item.sku, item.codigo, item.nome].some((value) => String(value || '').trim() === search)) || null;
  const categoria = await resolveCategoriaForProduto(accountId, identity.categoria);
  const basePayload = {
    fabricante_id: fabricanteId,
    codigo: identity.codigo || null,
    sku: identity.codigo || null,
    nome: identity.nome || identity.codigo || 'Produto importado',
    descricao: identity.nome || null,
    categoria: categoria.categoria,
    categoria_id: categoria.categoria_id,
    estoque: identity.estoque ?? 0,
    status: 'ativo',
    ativo: true
  };
  const createPayload = {
    ...basePayload,
    preco: identity.preco ?? 0
  };
  const updatePayload = {
    ...basePayload,
    ...(Number.isFinite(identity.preco) && identity.preco > 0 ? { preco: identity.preco } : {})
  };
  if (existing) {
    console.log('[produtos-import] create/update start', {
      action: 'update',
      produtoId: existing.id
    });
    const item = await updateProduto(existing.id, updatePayload, { accountId });
    console.log('[produtos-import] create/update done', {
      action: 'update',
      produtoId: item?.id || existing.id
    });
    return { item, created: false };
  }
  console.log('[produtos-import] create/update start', {
    action: 'create',
    produtoId: null
  });
  const item = await createProduto(createPayload, { accountId });
  console.log('[produtos-import] create/update done', {
    action: 'create',
    produtoId: item?.id || null
  });
  return { item, created: true };
}

async function upsertVariacao(accountId, produtoId, parsed, grade) {
  const nome = grade === 'UNI' ? parsed.cor || parsed.variacao_nome || 'UNI' : `${parsed.cor || parsed.variacao_nome || 'PADRAO'} / ${grade}`;
  const variations = await listVariations(produtoId, { accountId });
  const cor = parsed.cor || parsed.variacao_nome || null;
  const existing = variations.find((v) => String(v.cor || '') === String(cor || '') && String(v.grade || '') === String(grade));
  const payload = { sku: `${parsed.codigo_erp || parsed.nome_produto}-${grade}`, nome, valor: cor || '', cor, preco: 0, ativo: true, multiplo_venda: 1, grade };
  if (existing) return { item: await updateVariation(produtoId, existing.id, payload, { accountId }), created: false };
  return { item: await createVariation(produtoId, payload, { accountId }), created: true };
}

function buildPreviewErrorRow(rowIndex, message, row) {
  return { row: rowIndex, message, raw: row };
}

export function __getProdutoVariacoesSelectFieldsForTests() {
  return PRODUTO_VARIACOES_SELECT_FIELDS;
}

export function __buildProductParentActiveStateForTests(variations = []) {
  return buildProductParentActiveState(variations);
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
    const { variations, items } = buildNormalizedItemsFromRow(row, parsedWorkbook.headers, identity.parsed, identity.columns);
    totalValid += 1;
    if (!items.length) return;
    if (sampleRows.length < MAX_PREVIEW_ROWS) {
      sampleRows.push({
        codigo_erp: identity.parsed?.codigo_erp || identity.codigo || null,
        nome_produto: identity.parsed?.nome_produto || identity.nome || null,
        variacao_nome: identity.parsed?.variacao_nome || identity.parsed?.cor || null,
        sku: identity.parsed?.codigo_erp || identity.codigo || null,
        nome: identity.parsed?.nome_produto || identity.nome || null,
        cor: identity.parsed?.cor || identity.parsed?.variacao_nome || null,
        grade: null,
        tamanho: null,
        estoque: Number(variations.reduce((sum, variation) => sum + Number(variation.quantidade || 0), 0)),
        total: Number(variations.reduce((sum, variation) => sum + Number(variation.quantidade || 0), 0)),
        totalStock: Number(variations.reduce((sum, variation) => sum + Number(variation.quantidade || 0), 0)),
        variations,
        variationsCount: variations.length,
        hasStock: variations.some((variation) => variation.quantidade > 0),
        categoria: identity.categoria,
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

  const result = {
    ok: true,
    batchId: batch.id,
    totalRows: parsedWorkbook.dataRows.length,
    totalValid,
    totalInvalid,
    divergences,
    errors: errors.slice(0, 10),
    sampleRows,
    items: sampleRows,
    headers: parsedWorkbook.headers,
    sheetName: parsedWorkbook.sheetName,
    sheetNames: parsedWorkbook.sheetNames
  };
  console.info('[produtos-import] preview sample', result.items?.slice(0, 6).map((item) => ({
    sku: item.sku,
    nome: item.nome,
    cor: item.cor,
    grade: item.grade || item.tamanho,
    estoque: item.estoque
  })));
  return result;
}

export async function executeImportXlsx({ accountId, fabricanteId, fileName, buffer }) {
  assertAccountId(accountId);
  await ensureFabricante(accountId, fabricanteId);
  const parsedWorkbook = await parseImportWorkbook(buffer);
  console.info('[produtos-import] import start', { fileName: fileName || null, totalLines: parsedWorkbook.dataRows.length });

  const groupedItems = new Map();
  for (const row of parsedWorkbook.dataRows) {
    const identity = buildImportIdentity(row, parsedWorkbook.headers);
    if (!identity.parsed?.codigo_erp && !identity.parsed?.nome_produto) continue;
    const { variations, items } = buildNormalizedItemsFromRow(row, parsedWorkbook.headers, identity.parsed, identity.columns);
    if (!items.length) continue;
    const parentSku = getParentSkuFromItem(items[0]);
    const parentName = getParentNameFromItem(items[0]);
    const parentKey = [fabricanteId, parentSku || '', parentName || ''].map((value) => normalizeKey(value)).join('::');
    if (!groupedItems.has(parentKey)) {
      groupedItems.set(parentKey, { parentSku, parentName, rows: [], items: [], variations: [] });
    }
    const group = groupedItems.get(parentKey);
    group.rows.push(row);
    group.items.push(...items);
    group.variations.push(...variations);
  }

  console.info('[produtos-import] import totals', { totalLines: parsedWorkbook.dataRows.length, totalParents: groupedItems.size });

  const batch = await createBatchRecord({
    account_id: accountId,
    fabricante_id: fabricanteId,
    arquivo_nome: fileName || null,
    status: 'processing',
    total_linhas: parsedWorkbook.dataRows.length,
    linhas_processadas: 0,
    produtos_criados: 0,
    produtos_atualizados: 0,
    variacoes_criadas: 0,
    variacoes_atualizadas: 0,
    estoques_atualizados: 0,
    erros: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const productCache = new Map();
  const variationCache = new Map();
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
    divergencias: 0,
    erros: []
  };

  try {
    const supabase = getSupabaseClient();
    const parentList = [...groupedItems.values()];
    const parentSkus = parentList.map((group) => group.parentSku).filter(Boolean);
    const existingProducts = mode() === 'supabase'
      ? await fetchExistingProductsBySku(supabase, accountId, fabricanteId, parentSkus)
      : [];
    const existingProductMap = new Map(existingProducts.map((product) => [normalizeKey(product.sku), product]));

    const productsToWrite = [];
    for (const group of parentList) {
      const sku = group.parentSku || group.parentName || 'Produto importado';
      const existing = existingProductMap.get(normalizeKey(sku)) || null;
      const firstItem = group.items[0] || {};
      const totalStock = group.items.reduce((sum, item) => sum + Number(item.estoque || 0), 0);
      const category = await resolveCategoriaForProduto(accountId, firstItem.categoria);
      const productPayload = {
        account_id: accountId,
        fabricante_id: fabricanteId,
        codigo: sku,
        sku,
        nome: group.parentName || sku,
        descricao: group.parentName || sku,
        categoria: category.categoria,
        categoria_id: category.categoria_id,
        estoque: totalStock,
        ativo: false,
        preco: Number.isFinite(firstItem.preco) && firstItem.preco > 0 ? firstItem.preco : existing?.preco ?? 0
      };
      productsToWrite.push({ existing, payload: productPayload, group });
    }

    if (mode() !== 'supabase') {
      for (const entry of productsToWrite) {
        let item = entry.existing || null;
        if (item?.id) {
          item = await updateProduto(item.id, entry.payload, { accountId });
          summary.produtos_atualizados += 1;
        } else {
          item = await createProduto(entry.payload, { accountId });
          summary.produtos_criados += 1;
        }
        entry.saved = item;
      }
      for (const entry of productsToWrite) {
        const productId = entry.saved?.id;
        if (!productId) continue;
        const existingVariationsForProduct = await listVariations(productId, { accountId });
        const variationLookup = new Map(existingVariationsForProduct.map((variation) => [buildVariationLookupKey(accountId, productId, variation.nome, variation.grade), variation]));
        for (const item of entry.group.items) {
          const grade = String(item.grade || item.tamanho || '').trim() || null;
          const cor = String(item.cor || item.variacao_nome || '').trim() || null;
          const variationName = grade === 'UNI'
            ? (cor || 'UNI')
            : `${cor || 'PADRAO'} / ${grade}`;
          const payload = {
            sku: `${String(item.codigo_erp || item.sku || item.nome_produto || 'SKU').trim()}-${grade || 'UNI'}`,
            nome: variationName,
            valor: cor || '',
            cor,
            preco: 0,
            ativo: Number(item.estoque || 0) >= 10,
            multiplo_venda: 1,
            grade,
            tamanho: grade,
            estoque: Number(item.estoque || 0)
          };
          const key = buildVariationLookupKey(accountId, productId, variationName, grade);
          const existingVariation = variationLookup.get(key) || null;
          if (existingVariation) {
            await updateVariation(productId, existingVariation.id, payload, { accountId });
            summary.variacoes_atualizadas += 1;
          } else {
            await createVariation(productId, payload, { accountId });
            summary.variacoes_criadas += 1;
          }
          summary.estoques_atualizados += 1;
        }
        const variationsAfter = await listVariations(productId, { accountId });
        const active = buildProductParentActiveState(variationsAfter);
        await updateProduto(productId, { ativo: active }, { accountId });
        summary.linhas_processadas += entry.group.rows.length;
      }
      for (let index = 0; index < productsToWrite.length; index += 1) {
        if ((index + 1) % IMPORT_PROGRESS_STEP === 0) {
          console.info('[produtos-import] import progress', { parentsProcessed: index + 1, totalParents: productsToWrite.length });
        }
      }
      const finalStatus = summary.erros.length || summary.divergencias ? 'completed_with_warnings' : 'completed';
      await updateBatchRecord(batch.id, { ...summary, status: finalStatus, erros: summary.erros.length, updated_at: new Date().toISOString() }).catch((error) => {
        console.error('[produtos-import] batch close failed after successful import', {
          batchId: batch.id,
          payload: { ...summary, status: finalStatus, erros: summary.erros.length, updated_at: new Date().toISOString() },
          error: {
            message: error?.message || String(error),
            code: error?.code || null,
            details: error?.details || null,
            hint: error?.hint || null,
            stack: error?.stack || null
          }
        });
        return null;
      });
      console.info('[produtos-import] import done', {
        batchId: batch.id,
        totalLines: summary.total_linhas,
        totalParents: groupedItems.size,
        productsCreated: summary.produtos_criados,
        productsUpdated: summary.produtos_atualizados,
        variationsCreated: summary.variacoes_criadas,
        variationsUpdated: summary.variacoes_atualizadas,
        stocksUpdated: summary.estoques_atualizados,
        status: finalStatus
      });
      return { ok: true, batch: { ...summary, status: finalStatus, erros: summary.erros } };
    }

    const savedProductMap = new Map();
    if (mode() === 'supabase') {
      const existingBySku = new Map();
      for (const product of existingProducts) {
        const key = normalizeKey(product.sku);
        if (!key) continue;
        if (existingBySku.has(key)) {
          console.warn('[produtos-import] duplicated product sku on import', {
            accountId,
            fabricanteId,
            sku: product.sku || null,
            keptId: existingBySku.get(key)?.id || null,
            duplicatedId: product.id || null
          });
          continue;
        }
        existingBySku.set(key, product);
      }

      const entriesToInsert = [];
      for (const entry of productsToWrite) {
        const skuKey = normalizeKey(entry.payload.sku);
        const existing = existingBySku.get(skuKey) || null;
        entry.existing = existing;
        if (existing?.id) {
          const { data, error } = await supabase
            .from('produtos')
            .update(entry.payload)
            .eq('id', existing.id)
            .select('id, sku, account_id, fabricante_id, codigo, nome, descricao, categoria, categoria_id, estoque, ativo, preco')
            .single();
          if (error) {
            console.error('[produtos-import] bulk products update error', {
              code: error?.code,
              message: error?.message,
              details: error?.details,
              hint: error?.hint,
              productId: existing.id,
              sku: entry.payload?.sku || null
            });
            throw new DatabaseError('Falha ao gravar produtos em lote', { details: error });
          }
          const saved = data || existing;
          entry.saved = saved;
          if (saved?.sku) savedProductMap.set(normalizeKey(saved.sku), saved);
          summary.produtos_atualizados += 1;
        } else {
          entriesToInsert.push(entry);
        }
      }

      if (entriesToInsert.length) {
        const insertPayloads = entriesToInsert.map((entry) => entry.payload);
        const { data, error } = await supabase
          .from('produtos')
          .insert(insertPayloads)
          .select('id, sku, account_id, fabricante_id, codigo, nome, descricao, categoria, categoria_id, estoque, ativo, preco');
        if (error) {
          console.error('[produtos-import] bulk products insert error', {
            code: error?.code,
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            count: insertPayloads?.length,
            sample: insertPayloads?.slice(0, 3)
          });
          throw new DatabaseError('Falha ao gravar produtos em lote', { details: error });
        }
        for (const product of data || []) {
          if (product?.sku) savedProductMap.set(normalizeKey(product.sku), product);
        }
        for (const entry of entriesToInsert) {
          const saved = savedProductMap.get(normalizeKey(entry.payload.sku)) || null;
          if (!saved?.id) continue;
          entry.saved = saved;
          summary.produtos_criados += 1;
        }
      }
    } else {
      for (const entry of productsToWrite) {
        let item = entry.existing || null;
        if (item?.id) {
          item = await updateProduto(item.id, entry.payload, { accountId });
          summary.produtos_atualizados += 1;
        } else {
          item = await createProduto(entry.payload, { accountId });
          summary.produtos_criados += 1;
        }
        entry.saved = item;
        if (item?.sku) savedProductMap.set(normalizeKey(item.sku), item);
      }
    }

    const allProductIds = productsToWrite.map((entry) => entry.saved?.id).filter(Boolean);
    const existingVariations = mode() === 'supabase'
      ? await fetchExistingVariationsByProductIds(supabase, accountId, allProductIds)
      : [];
    const variationMap = new Map();
    for (const variation of existingVariations) {
      variationMap.set(buildVariationLookupKey(variation.account_id, variation.produto_id, variation.nome, variation.grade), variation);
    }

    const variationsToUpsert = [];
    const parentActivityByProductId = new Map();
    for (const entry of productsToWrite) {
      const productId = entry.saved?.id;
      if (!productId) continue;
      const groupVariations = [];
      for (const item of entry.group.items) {
        const grade = String(item.grade || item.tamanho || '').trim() || null;
        const cor = String(item.cor || item.variacao_nome || '').trim() || null;
        const variationName = grade === 'UNI'
          ? (cor || 'UNI')
          : `${cor || 'PADRAO'} / ${grade}`;
        const variationPayload = buildVariationPayloadFromItem(item, productId, accountId, fabricanteId);
        const variationKey = buildVariationLookupKey(accountId, productId, variationName, grade);
        const existingVariation = variationMap.get(variationKey) || null;
        if (existingVariation) {
          summary.variacoes_atualizadas += 1;
        } else {
          summary.variacoes_criadas += 1;
        }
        groupVariations.push({
          ...variationPayload,
          nome: variationName
        });
      }
      parentActivityByProductId.set(productId, groupVariations);
      variationsToUpsert.push(...groupVariations);
      summary.linhas_processadas += entry.group.rows.length;
    }

    if (mode() === 'supabase' && variationsToUpsert.length) {
      const { error } = await supabase
        .from('produto_variacoes')
        .upsert(variationsToUpsert, { onConflict: 'account_id,produto_id,nome,grade' });
      if (error) {
        console.error('[produtos-import] bulk variations error', {
          code: error?.code,
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          count: variationsToUpsert?.length,
          sample: variationsToUpsert?.slice(0, 3)
        });
        throw new DatabaseError('Falha ao gravar variacoes em lote', { details: error });
      }
      summary.estoques_atualizados += variationsToUpsert.length;
    } else {
      summary.estoques_atualizados += variationsToUpsert.length;
    }

    const productIdsToRecalc = [...parentActivityByProductId.keys()];
    if (mode() === 'supabase' && productIdsToRecalc.length) {
      const allVariationsAfterUpsert = await fetchExistingVariationsByProductIds(supabase, accountId, productIdsToRecalc);
      const variationsByProduct = new Map();
      for (const variation of allVariationsAfterUpsert) {
        const list = variationsByProduct.get(variation.produto_id) || [];
        list.push(variation);
        variationsByProduct.set(variation.produto_id, list);
      }
      const productUpdates = [];
      for (const productId of productIdsToRecalc) {
        const active = buildProductParentActiveState(variationsByProduct.get(productId) || []);
        productUpdates.push({ id: productId, ativo: active, account_id: accountId });
      }
      for (const update of productUpdates) {
        await supabase
          .from('produtos')
          .update({ ativo: update.ativo })
          .eq('id', update.id)
          .eq('account_id', update.account_id);
      }
    }

    for (let index = 0; index < productsToWrite.length; index += 1) {
      if ((index + 1) % IMPORT_PROGRESS_STEP === 0) {
        console.info('[produtos-import] import progress', {
          parentsProcessed: index + 1,
          totalParents: productsToWrite.length
        });
      }
    }

    const finalStatus = summary.erros.length || summary.divergencias ? 'completed_with_warnings' : 'completed';
    await updateBatchRecord(batch.id, { ...summary, status: finalStatus, erros: summary.erros.length, updated_at: new Date().toISOString() }).catch((error) => {
      console.error('[produtos-import] batch close failed after successful import', {
        batchId: batch.id,
        payload: { ...summary, status: finalStatus, erros: summary.erros.length, updated_at: new Date().toISOString() },
        error: {
          message: error?.message || String(error),
          code: error?.code || null,
          details: error?.details || null,
          hint: error?.hint || null,
          stack: error?.stack || null
        }
      });
      return null;
    });
    console.info('[produtos-import] import done', {
      batchId: batch.id,
      totalLines: summary.total_linhas,
      totalParents: groupedItems.size,
      productsCreated: summary.produtos_criados,
      productsUpdated: summary.produtos_atualizados,
      variationsCreated: summary.variacoes_criadas,
      variationsUpdated: summary.variacoes_atualizadas,
      stocksUpdated: summary.estoques_atualizados,
      status: finalStatus
    });
    return { ok: true, batch: { ...summary, status: finalStatus, erros: summary.erros } };
  } catch (error) {
    console.error('[produtos-import] import error', {
      batchId: batch.id,
      message: error?.message,
      code: error?.code
    });
    await updateBatchRecord(batch.id, { status: 'failed', erros: summary.erros.length + 1, updated_at: new Date().toISOString() }).catch(() => null);
    throw error;
  }
}

export function splitDescricaoProdutoExport(descricao = '') {
  return splitDescricaoProduto(descricao);
}

export function __buildVariationIdentityForTests(record = {}) {
  return buildVariationIdentity(record);
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
