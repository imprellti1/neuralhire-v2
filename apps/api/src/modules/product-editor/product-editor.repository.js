import { randomUUID } from 'node:crypto';
import { BadRequestError, NotFoundError } from '../../core/errors.js';
import { getProdutoById, listProdutos, updateProduto } from '../produtos/produtos.repository.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';

const memoryVariations = [];

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
  const preco = nonNegativeNumber(data.preco, 'Preco');
  if (preco !== undefined) payload.preco = preco;
  const precoUnitario = nonNegativeNumber(data.precoUnitario ?? data.preco_unitario, 'Preco unitario');
  if (precoUnitario !== undefined) payload.precoUnitario = precoUnitario;
  if (data.status !== undefined) {
    const status = String(data.status).trim().toLowerCase();
    if (!['ativo', 'inativo'].includes(status)) throw new BadRequestError('Status invalido');
    payload.status = status;
  }
  if (data.imagemUrl !== undefined && String(data.imagemUrl).trim()) payload.imagemUrl = String(data.imagemUrl).trim();
  return updateProduto(productId, payload, { accountId: options.accountId });
}

export async function updateProductEditorImages(productId, data = {}, options = {}) {
  assertAccount(options.accountId);
  return updateProduto(productId, {
    ...(data.imagemUrl !== undefined && String(data.imagemUrl).trim() ? { imagemUrl: String(data.imagemUrl).trim() } : {}),
    ...(Array.isArray(data.galeria) ? { galeria: data.galeria.map((value) => String(value).trim()).filter(Boolean) } : {})
  }, { accountId: options.accountId });
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
  const variation = {
    id: randomUUID(),
    account_id: options.accountId,
    product_id: productId,
    sku,
    cor: sanitizeText(data.cor) || '',
    tamanho: sanitizeText(data.tamanho) || '',
    estoque: nonNegativeNumber(data.estoque, 'Estoque') ?? 0,
    preco: nonNegativeNumber(data.preco, 'Preco') ?? 0,
    imagemUrl: sanitizeText(data.imagemUrl) || '',
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
  if (data.cor !== undefined) variation.cor = String(data.cor || '').trim();
  if (data.tamanho !== undefined) variation.tamanho = String(data.tamanho || '').trim();
  if (data.estoque !== undefined) variation.estoque = nonNegativeNumber(data.estoque, 'Estoque');
  if (data.preco !== undefined) variation.preco = nonNegativeNumber(data.preco, 'Preco');
  if (data.imagemUrl !== undefined) variation.imagemUrl = String(data.imagemUrl || '').trim();
  if (data.ativo !== undefined) variation.ativo = Boolean(data.ativo);
  return clone(variation);
}

export async function updateVariationImage(productId, variationId, data = {}, options = {}) {
  return updateVariation(productId, variationId, { imagemUrl: data.imagemUrl }, options);
}

export function __resetMemoryProductEditorForTests() {
  memoryVariations.length = 0;
}
