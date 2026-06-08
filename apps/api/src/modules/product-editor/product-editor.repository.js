import { randomUUID } from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import { getProdutoById, listProdutos, updateProduto } from '../produtos/produtos.repository.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';

const memoryVariations = [];
const memoryStockMovements = [];

function assertAccount(accountId) {
  if (!accountId) throw new BadRequestError('accountId obrigatorio');
}

function clone(item) {
  return JSON.parse(JSON.stringify(item));
}

function sanitizeText(value) {
  return value === undefined ? undefined : String(value).trim();
}

function nonNegativeNumber(value, label) {
  if (value === undefined) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) throw new BadRequestError(`${label} invalido`);
  return num;
}

function normalizeVariationPayload(data = {}) {
  return {
    ...(data.cor !== undefined ? { nome: String(data.cor || '').trim(), grade: String(data.tamanho || data.grade || data.cor || '').trim() || null } : {}),
    ...(data.tamanho !== undefined ? { grade: String(data.tamanho || '').trim() || null } : {}),
    ...(data.imagemUrl !== undefined ? { imagemUrl: String(data.imagemUrl || '').trim() || null } : {}),
    ...(data.imagem_url !== undefined ? { imagemUrl: String(data.imagem_url || '').trim() || null } : {})
  };
}

function makeMovement(tipo, variation, options, data, saldoAnterior, saldoPosterior, observacao = null) {
  return {
    id: randomUUID(),
    account_id: options.accountId,
    produto_id: variation.product_id,
    variacao_id: variation.id,
    fabricante_id: options.fabricanteId || null,
    tipo,
    quantidade: saldoPosterior - saldoAnterior,
    saldo_anterior: saldoAnterior,
    saldo_posterior: saldoPosterior,
    origem: data.origem || tipo,
    arquivo_origem: data.arquivo_origem || null,
    import_batch_id: data.import_batch_id || null,
    observacao: observacao || String(data.observacao || '').trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function buildFabricanteSummary(fabricante) {
  if (!fabricante) return null;
  return {
    id: fabricante.id || null,
    nome: fabricante.nome || '',
    logoUrl: fabricante.logo_url || fabricante.logoUrl || '',
    pedidoMinimo: Number(fabricante.pedido_minimo || fabricante.pedidoMinimo || 0),
    boletoMinimo: Number(fabricante.boleto_minimo || fabricante.boletoMinimo || 0),
    comissaoPadraoPercentual: Number(fabricante.comissao_padrao_percentual || fabricante.comissaoPadraoPercentual || 0),
    prazoMaximoDias: Number(fabricante.prazo_maximo_dias || fabricante.prazoMaximoDias || 0)
  };
}

export async function listProductEditorProducts(filters = {}, options = {}) {
  assertAccount(options.accountId);
  const result = await listProdutos(filters, { accountId: options.accountId });
  const items = [];
  for (const item of result.items || []) {
    const fabricante = item.fabricanteId ? await getFabricanteById(item.fabricanteId, { accountId: options.accountId }).catch(() => null) : null;
    items.push({ ...item, fabricante: buildFabricanteSummary(fabricante) });
  }
  return { ...result, items };
}

export async function getProductEditorProduct(productId, options = {}) {
  assertAccount(options.accountId);
  const item = await getProdutoById(productId, { accountId: options.accountId });
  const fabricante = item.fabricanteId ? await getFabricanteById(item.fabricanteId, { accountId: options.accountId }).catch(() => null) : null;
  return { ...clone(item), fabricante: buildFabricanteSummary(fabricante), variations: await listVariations(productId, options) };
}

export async function updateProductEditorProduct(productId, data = {}, options = {}) {
  assertAccount(options.accountId);
  const payload = {};
  const nome = sanitizeText(data.nome);
  if (nome !== undefined) {
    if (!nome) throw new BadRequestError('Nome invalido');
    payload.nome = nome;
  }
  const sku = sanitizeText(data.sku);
  if (sku !== undefined && sku) payload.sku = sku;
  if (data.descricao !== undefined && String(data.descricao).trim()) payload.descricao = String(data.descricao).trim();
  if (data.fabricanteId !== undefined) payload.fabricanteId = data.fabricanteId || null;
  if (data.categoria !== undefined && String(data.categoria).trim()) payload.categoria = String(data.categoria).trim();
  if (data.subcategoria !== undefined && String(data.subcategoria).trim()) payload.subcategoria = String(data.subcategoria).trim();
  if (data.familia !== undefined && String(data.familia).trim()) payload.familia = String(data.familia).trim();
  if (data.colecao !== undefined && String(data.colecao).trim()) payload.colecao = String(data.colecao).trim();
  if (data.imagemUrl !== undefined) payload.imagemUrl = String(data.imagemUrl || '').trim() || null;
  if (data.imagem_url !== undefined) payload.imagemUrl = String(data.imagem_url || '').trim() || null;
  const preco = nonNegativeNumber(data.preco, 'Preco');
  if (preco !== undefined) payload.preco = preco;
  const precoUnitario = nonNegativeNumber(data.precoUnitario ?? data.preco_unitario, 'Preco unitario');
  if (precoUnitario !== undefined) payload.precoUnitario = precoUnitario;
  if (data.status !== undefined) {
    const status = String(data.status).trim().toLowerCase();
    if (!['ativo', 'inativo'].includes(status)) throw new BadRequestError('Status invalido');
    payload.status = status;
  }
  return updateProduto(productId, payload, { accountId: options.accountId });
}

export async function updateProductEditorImages(productId, data = {}, options = {}) {
  assertAccount(options.accountId);
  return updateProduto(productId, {}, { accountId: options.accountId });
}

export async function listVariations(productId, options = {}) {
  assertAccount(options.accountId);
  await getProdutoById(productId, { accountId: options.accountId });
  return memoryVariations.filter((variation) => variation.account_id === options.accountId && variation.product_id === productId).map(clone);
}

export async function createVariation(productId, data = {}, options = {}) {
  assertAccount(options.accountId);
  await getProdutoById(productId, { accountId: options.accountId });
  const sku = sanitizeText(data.sku);
  if (!sku) throw new BadRequestError('SKU obrigatorio');
  const estoque = nonNegativeNumber(data.estoque, 'Estoque');
  if (estoque !== undefined && estoque < 0) throw new BadRequestError('Estoque invalido');
  const normalized = normalizeVariationPayload(data);
  const variation = {
    id: randomUUID(),
    account_id: options.accountId,
    product_id: productId,
    sku,
    nome: sanitizeText(data.nome) || sku,
    grade: sanitizeText(data.grade) || sanitizeText(data.valor) || null,
    tamanho: sanitizeText(data.tamanho) || sanitizeText(data.grade) || sanitizeText(data.valor) || null,
    valor: sanitizeText(data.valor) || '',
    cor: sanitizeText(data.cor) || null,
    imagemUrl: normalized.imagemUrl || null,
    imagem_principal_url: normalized.imagemUrl || null,
    preco: nonNegativeNumber(data.preco, 'Preco') ?? 0,
    preco_promocional: nonNegativeNumber(data.preco_promocional, 'Preco promocional') ?? null,
    multiplo_venda: nonNegativeNumber(data.multiplo_venda, 'Multiplo venda') ?? 1,
    estoque_atual: nonNegativeNumber(data.estoque ?? data.estoque_atual, 'Estoque') ?? 0,
    ativo: typeof data.ativo === 'boolean' ? data.ativo : true
  };
  memoryVariations.push(variation);
  return clone(variation);
}

function getVariationOrThrow(productId, variationId, options) {
  const variation = memoryVariations.find((item) => item.account_id === options.accountId && item.product_id === productId && item.id === variationId);
  if (!variation) throw new NotFoundError('Variacao nao encontrada');
  return variation;
}

export async function updateVariation(productId, variationId, data = {}, options = {}) {
  assertAccount(options.accountId);
  const variation = getVariationOrThrow(productId, variationId, options);
  if (data.sku !== undefined && String(data.sku).trim()) variation.sku = String(data.sku).trim();
  if (data.nome !== undefined) variation.nome = String(data.nome || '').trim();
  if (data.grade !== undefined) variation.grade = String(data.grade || '').trim();
  if (data.tamanho !== undefined) variation.tamanho = String(data.tamanho || '').trim();
  if (data.valor !== undefined) variation.valor = String(data.valor || '').trim();
  if (data.cor !== undefined) variation.cor = String(data.cor || '').trim() || null;
  if (data.preco !== undefined) variation.preco = nonNegativeNumber(data.preco, 'Preco');
  if (data.preco_promocional !== undefined) variation.preco_promocional = nonNegativeNumber(data.preco_promocional, 'Preco promocional');
  if (data.multiplo_venda !== undefined) variation.multiplo_venda = nonNegativeNumber(data.multiplo_venda, 'Multiplo venda');
  if (data.ativo !== undefined) variation.ativo = Boolean(data.ativo);
  if (data.imagemUrl !== undefined) variation.imagemUrl = String(data.imagemUrl || '').trim() || null;
  if (data.imagem_url !== undefined) variation.imagemUrl = String(data.imagem_url || '').trim() || null;
  if (data.estoque_atual !== undefined || data.estoque !== undefined) variation.estoque_atual = nonNegativeNumber(data.estoque_atual ?? data.estoque, 'Estoque');
  return clone(variation);
}

export async function updateVariationImage(productId, variationId, data = {}, options = {}) {
  return updateVariation(productId, variationId, { imagemUrl: data.imagemUrl }, options);
}

export async function adjustVariationStock(productId, variationId, data = {}, options = {}) {
  assertAccount(options.accountId);
  const variation = getVariationOrThrow(productId, variationId, options);
  const prev = Number(variation.estoque_atual || 0);
  const next = Number(nonNegativeNumber(data.quantidade, 'Estoque'));
  const delta = next - prev;
  variation.estoque_atual = next;
  const movement = makeMovement('AJUSTE_MANUAL', variation, options, data, prev, next);
  memoryStockMovements.push(movement);
  return { variation: clone(variation), movement: clone(movement) };
}

export async function registerImportStockMovement(productId, variationId, data = {}, options = {}) {
  assertAccount(options.accountId);
  const variation = getVariationOrThrow(productId, variationId, options);
  const prev = Number(variation.estoque_atual || 0);
  const next = Number(nonNegativeNumber(data.estoque_atual ?? data.quantidade, 'Estoque'));
  if (prev === next) return { variation: clone(variation), movement: null };
  variation.estoque_atual = next;
  if (data.imagemUrl !== undefined) variation.imagemUrl = data.imagemUrl;
  const movement = makeMovement('IMPORTACAO_ESTOQUE', variation, options, { ...data, origem: 'IMPORTACAO_XLSX' }, prev, next);
  memoryStockMovements.push(movement);
  return { variation: clone(variation), movement: clone(movement) };
}

export async function listVariationMovements(productId, variationId, options = {}) {
  assertAccount(options.accountId);
  getVariationOrThrow(productId, variationId, options);
  return memoryStockMovements.filter((m) => m.account_id === options.accountId && m.produto_id === productId && m.variacao_id === variationId).map(clone);
}

export async function getVariationById(productId, variationId, options = {}) {
  assertAccount(options.accountId);
  return clone(getVariationOrThrow(productId, variationId, options));
}

export function __resetMemoryProductEditorForTests() {
  memoryVariations.length = 0;
  memoryStockMovements.length = 0;
}
