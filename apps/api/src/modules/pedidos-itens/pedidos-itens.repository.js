import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { logger } from '../../core/logger.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { __dumpMemoryProdutos, getProdutoById } from '../produtos/produtos.repository.js';
import { buildExpectedSku, classifyVariationMatch, extractSkuBase } from './pedidos-itens.matching.js';
import { parsePedidosItensWorkbook } from './pedidos-itens.parser.js';

let supabaseConfiguredOverride = null;
let supabaseClientOverride = null;

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'pedidos-itens' });
}

function mode() {
  if (typeof supabaseConfiguredOverride === 'boolean') return supabaseConfiguredOverride ? 'supabase' : 'memory';
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

function resolveSupabaseClient() {
  return supabaseClientOverride || getSupabaseClient();
}

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function normalizeFileNumber(fileName) {
  const name = normalizeValue(fileName).replace(/\.[^.]+$/, '');
  return name || null;
}

function normalizeSku(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseMoneyLike(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const compact = text.replace(/\s+/g, '').replace(/^R\$/i, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(/,/g, '.')
    : compact;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeSpreadsheetMoney(value, { fallback = null } = {}) {
  const numeric = parseMoneyLike(value);
  if (numeric === null || numeric < 0) return fallback;
  const rawText = typeof value === 'string' ? value.trim() : '';
  const hasDecimalSeparator = rawText.includes(',') || rawText.includes('.');
  const isIntegerLike = Number.isInteger(numeric) && !hasDecimalSeparator;
  const normalized = isIntegerLike ? numeric / 100 : numeric;
  return Number(normalized.toFixed(3));
}

function toNonNegativeMoney(value, fallback = 0) {
  const raw = value ?? fallback;
  const numeric = parseMoneyLike(raw);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Number(numeric.toFixed(2));
}

function resolvePrecoUnitario(row = {}) {
  const explicit = normalizeSpreadsheetMoney(row.preco_unitario ?? row.valor_unitario, { fallback: null });
  if (explicit !== null && explicit !== undefined) return explicit;
  const quantidade = toNonNegativeMoney(row.quantidade, 0);
  const valorTotal = normalizeSpreadsheetMoney(row.valor_total, { fallback: null });
  if (valorTotal === null || !quantidade) return 0;
  return Number((valorTotal / quantidade).toFixed(3));
}

function buildItemMetadata(row = {}) {
  return {
    origem: 'importacao_xlsx_pedidos_itens',
    codigo_produto_erp_original: row.codigo_produto_erp_original || null,
    nome_produto_original: row.nome_produto_original || null,
    cor_original: row.cor_original || null,
    tamanho_original: row.tamanho_original || null,
    ean_original: row.ean_original || null,
    sku_base_extraido: row.sku_base_extraido || null,
    sku_esperado: row.sku_esperado || null,
    valor_unitario: row.valor_unitario ?? null,
    valor_total: row.valor_total ?? null,
    motivo_vinculo: row.motivo_vinculo || null
  };
}

function logPedidoLookupError(error, context = {}) {
  console.error('[pedidos-itens.repository] Falha ao buscar pedido', {
    message: error?.message || null,
    details: error?.details || null,
    hint: error?.hint || null,
    context
  });
}

function toCandidatesFromProduct(product = {}) {
  const productVariations = Array.isArray(product.variacoes) ? product.variacoes : Array.isArray(product.variations) ? product.variations : Array.isArray(product.produto_variacoes) ? product.produto_variacoes : [];
  return productVariations.map((variation) => ({ ...variation, produto_id: variation.produto_id || product.id || null, produto_nome: product.nome || null }));
}

async function findVariationCandidates(accountId, skuExpected) {
  if (!skuExpected) return [];
  if (mode() === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('produto_variacoes')
      .select('id, account_id, produto_id, sku, nome, cor, grade, ativo')
      .eq('account_id', accountId)
      .eq('sku', skuExpected);
    if (error) throw new DatabaseError('Falha ao buscar variacoes do produto', { details: error });
    return data || [];
  }

  return __dumpMemoryProdutos()
    .filter((produto) => produto.account_id === accountId)
    .flatMap((produto) => toCandidatesFromProduct(produto))
    .filter((variacao) => normalizeSku(variacao.sku) === normalizeSku(skuExpected));
}

async function findPedidoByNumero(accountId, numero) {
  const pedidoNumero = normalizeValue(numero);
  if (!pedidoNumero) throw new BadRequestError('Numero do pedido obrigatorio no nome do arquivo', { domain: 'pedidos-itens', code: 'ORDER_NUMBER_REQUIRED' });
  if (mode() === 'supabase') {
    const supabase = resolveSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase
      .from('pedidos')
      .select('id, account_id, numero')
      .eq('account_id', accountId)
      .eq('numero', pedidoNumero)
      .maybeSingle();
    if (error) {
      logPedidoLookupError(error, { accountId, numero: pedidoNumero });
      throw new DatabaseError('Falha ao buscar pedido', { details: error });
    }
    if (!data) {
      throw new NotFoundError(`Pedido ERP ${pedidoNumero} nao encontrado`, { domain: 'pedidos-itens', code: 'PEDIDO_NOT_FOUND', details: { numero: pedidoNumero } });
    }
    return data;
  }
  const { __dumpMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  const pedido = (snapshot.pedidos || []).find((item) => String(item.account_id || '') === String(accountId) && normalizeValue(item.numero) === pedidoNumero);
  if (!pedido) throw new NotFoundError(`Pedido ERP ${pedidoNumero} nao encontrado`, { domain: 'pedidos-itens', code: 'PEDIDO_NOT_FOUND', details: { numero: pedidoNumero } });
  return pedido;
}

function buildPedidoItemRow({ accountId, pedidoId, row = {}, match = {} }) {
  const produtoNome = row.produto_nome
    || match?.produto_nome
    || (match?.status_vinculo === 'vinculado' ? row.nome_produto_original : null)
    || row.nome_produto_original
    || row.codigo_produto_erp_original
    || null;
  const precoUnitario = resolvePrecoUnitario(row);
  const valorTotal = normalizeSpreadsheetMoney(row.valor_total, { fallback: null });
  const valorUnitario = normalizeSpreadsheetMoney(row.valor_unitario ?? row.preco_unitario, { fallback: null });
  return {
    account_id: accountId,
    pedido_id: pedidoId,
    produto_id: match?.produto_id ?? null,
    variacao_id: match?.variacao_id ?? null,
    produto_nome: produtoNome,
    codigo_produto_erp_original: row.codigo_produto_erp_original || null,
    nome_produto_original: row.nome_produto_original || null,
    cor_original: row.cor_original || null,
    tamanho_original: row.tamanho_original || null,
    ean_original: row.ean_original || null,
    quantidade: row.quantidade ?? null,
    preco_unitario: precoUnitario,
    valor_unitario: valorUnitario,
    valor_total: valorTotal,
    sku_base_extraido: row.sku_base_extraido || null,
    sku_esperado: row.sku_esperado || null,
    status_vinculo: match.status_vinculo,
    motivo_vinculo: match.motivo_vinculo || null,
    metadata: buildItemMetadata({ ...row, motivo_vinculo: match.motivo_vinculo || null })
  };
}

export function __buildPedidoItemRowForTests(args) {
  return buildPedidoItemRow(args);
}

function buildSummary(items = []) {
  const summary = { total_linhas: items.length, validas: 0, vinculadas: 0, nao_encontradas: 0, ambiguas: 0, erros: 0 };
  for (const item of items) {
    if (!item.erros?.length) summary.validas += 1;
    if (item.status_vinculo === 'vinculado') summary.vinculadas += 1;
    if (item.status_vinculo === 'nao_encontrado') summary.nao_encontradas += 1;
    if (item.status_vinculo === 'ambiguo') summary.ambiguas += 1;
    summary.erros += item.erros?.length || 0;
  }
  return summary;
}

export async function previewPedidosItensImport({ accountId, fileName, buffer }) {
  assertAccountId(accountId);
  const pedidoNumero = normalizeFileNumber(fileName);
  const pedido = await findPedidoByNumero(accountId, pedidoNumero);
  const parsed = parsePedidosItensWorkbook(buffer);
  const itens = [];
  const erros = [];

  for (const row of parsed.dataRows) {
    const skuBase = extractSkuBase(row.codigo_produto_erp_original);
    const skuEsperado = buildExpectedSku(skuBase, row.tamanho_original);
    if (!skuBase) erros.push({ linha: row.rowNumber, codigo: 'SKU_BASE_INVALIDO', motivo: 'Nao foi possivel extrair sku base da coluna codigo_produto_erp_original' });
    if (!skuEsperado) erros.push({ linha: row.rowNumber, codigo: 'SKU_ESPERADO_INVALIDO', motivo: 'Nao foi possivel montar sku esperado com tamanho_original' });
    const candidates = await findVariationCandidates(accountId, skuEsperado);
    const match = classifyVariationMatch({ candidates, corOriginal: row.cor_original, tamanhoOriginal: row.tamanho_original });
    let produtoId = null;
    let variacaoId = null;
    let produtoNome = null;
    let variacaoSku = null;
    if (match.status_vinculo === 'vinculado') {
      const linked = match.matchedCandidate;
      produtoId = linked?.produto_id || null;
      variacaoId = linked?.id || null;
      produtoNome = linked?.produto_nome || null;
      variacaoSku = linked?.sku || null;
      if (!produtoNome && produtoId) {
        const produto = await getProdutoById(produtoId, { accountId }).catch(() => null);
        produtoNome = produto?.nome || null;
      }
    }
    itens.push({
      linha: row.rowNumber,
      codigo_produto_erp_original: row.codigo_produto_erp_original || null,
      nome_produto_original: row.nome_produto_original || null,
      cor_original: row.cor_original || null,
      tamanho_original: row.tamanho_original || null,
      ean_original: row.ean_original || null,
      quantidade: row.quantidade ?? null,
      valor_unitario: row.valor_unitario ?? null,
      valor_total: row.valor_total ?? null,
      sku_base_extraido: skuBase,
      sku_esperado: skuEsperado,
      status_vinculo: match.status_vinculo,
      motivo_vinculo: match.motivo_vinculo,
      produto_id: produtoId,
      variacao_id: variacaoId,
      produto_nome: produtoNome,
      variacao_sku: variacaoSku,
      erros: []
    });
  }

  const summary = buildSummary(itens);
  return {
    pedido: {
      id: pedido.id,
      numero: pedido.numero,
      cliente_nome: pedido.cliente_nome || null,
      status: pedido.status || null
    },
    resumo: summary,
    itens,
    erros
  };
}

async function deletePedidoItensByPedido(accountId, pedidoId) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { error } = await supabase.from('pedido_itens').delete().eq('account_id', accountId).eq('pedido_id', pedidoId);
    if (error) throw new DatabaseError('Falha ao limpar itens do pedido', { details: error });
    return;
  }

  const { __dumpMemoryPedidos, __loadMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  snapshot.pedidoItens = (snapshot.pedidoItens || []).filter((item) => String(item.account_id || '') !== String(accountId) || String(item.pedido_id || '') !== String(pedidoId));
  __loadMemoryPedidos(snapshot);
}

async function insertPedidoItens(accountId, pedidoId, rows = []) {
  const payload = rows.map((row) => buildPedidoItemRow({ accountId, pedidoId, row, match: row }));
  if (payload.length) {
    logger.debug('[pedidos-itens.repository] Primeiro payload final para insert', {
      account_id: accountId,
      pedido_id: pedidoId,
      payload: {
        status_vinculo: payload[0]?.status_vinculo ?? null,
        produto_nome: payload[0]?.produto_nome ?? null,
        nome_produto_original: payload[0]?.nome_produto_original ?? null,
        codigo_produto_erp_original: payload[0]?.codigo_produto_erp_original ?? null
      }
    });
  }
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    if (!payload.length) return [];
    const { data, error } = await supabase.from('pedido_itens').insert(payload).select('*');
    if (error) {
      logger.error('[pedidos-itens.repository] Falha ao salvar itens do pedido', {
        code: error?.code || null,
        message: error?.message || null,
        details: error?.details || null,
        hint: error?.hint || null,
        payloadSize: payload.length
      });
      throw new DatabaseError('Falha ao salvar itens do pedido', { details: { code: error?.code || null, message: error?.message || null, details: error?.details || null, hint: error?.hint || null } });
    }
    return data || [];
  }

  const { __dumpMemoryPedidos, __loadMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  const createdAt = new Date().toISOString();
  const items = payload.map((item, index) => ({ id: `pedido-item-${createdAt}-${index}`, ...item, createdAt }));
  snapshot.pedidoItens = [...(snapshot.pedidoItens || []).filter((item) => String(item.account_id || '') !== String(accountId) || String(item.pedido_id || '') !== String(pedidoId)), ...items];
  __loadMemoryPedidos(snapshot);
  return items;
}

export async function executePedidosItensImport({ accountId, fileName, buffer }) {
  assertAccountId(accountId);
  const pedidoNumero = normalizeFileNumber(fileName);
  const pedido = await findPedidoByNumero(accountId, pedidoNumero);
  const parsed = parsePedidosItensWorkbook(buffer);
  const itens = [];

  for (const row of parsed.dataRows) {
    const skuBase = extractSkuBase(row.codigo_produto_erp_original);
    const skuEsperado = buildExpectedSku(skuBase, row.tamanho_original);
    const candidates = await findVariationCandidates(accountId, skuEsperado);
    const match = classifyVariationMatch({ candidates, corOriginal: row.cor_original, tamanhoOriginal: row.tamanho_original });
    let produtoId = null;
    let variacaoId = null;
    if (match.status_vinculo === 'vinculado') {
      produtoId = match.matchedCandidate?.produto_id || null;
      variacaoId = match.matchedCandidate?.id || null;
    }
    if (itens.length < 3) {
      logger.debug('[pedidos-itens.repository] Item antes do insert', {
        account_id: accountId,
        pedido_id: pedido.id,
        item: {
          status_vinculo: match.status_vinculo || null,
          produto_nome: match.matchedCandidate?.produto_nome || null,
          nome_produto_original: row.nome_produto_original || null,
          codigo_produto_erp_original: row.codigo_produto_erp_original || null
        }
      });
    }
    itens.push({
      ...row,
      valor_total: normalizeSpreadsheetMoney(row.valor_total, { fallback: row.valor_total ?? null }),
      valor_unitario: normalizeSpreadsheetMoney(row.valor_unitario ?? row.preco_unitario, { fallback: row.valor_unitario ?? row.preco_unitario ?? null }),
      sku_base_extraido: skuBase,
      sku_esperado: skuEsperado,
      status_vinculo: match.status_vinculo,
      motivo_vinculo: match.motivo_vinculo,
      produto_id: produtoId,
      variacao_id: variacaoId
    });
  }

  await deletePedidoItensByPedido(accountId, pedido.id);
  const persisted = await insertPedidoItens(accountId, pedido.id, itens);
  const resumo = {
    importados: persisted.length,
    vinculados: itens.filter((item) => item.status_vinculo === 'vinculado').length,
    nao_encontrados: itens.filter((item) => item.status_vinculo === 'nao_encontrado').length,
    ambiguos: itens.filter((item) => item.status_vinculo === 'ambiguo').length
  };

  return {
    pedido: {
      id: pedido.id,
      numero: pedido.numero,
      cliente_nome: pedido.cliente_nome || null,
      status: pedido.status || null
    },
    resumo
  };
}

export function __setPedidosItensSupabaseModeForTests(configured = true) {
  supabaseConfiguredOverride = Boolean(configured);
}

export async function __testFindPedidoByNumero(accountId, numero) {
  return findPedidoByNumero(accountId, numero);
}

export function __setPedidosItensSupabaseClientForTests(client) {
  supabaseClientOverride = client;
}
