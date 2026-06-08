import { Buffer } from 'node:buffer';
import { getAccountIdFromContext } from '../../core/tenant-context.js';
import { BadRequestError, ForbiddenError } from '../../core/errors.js';
import { createProduto, listProdutos, updateProduto } from './produtos.repository.js';
import { createVariation, listVariations, registerImportStockMovement, updateVariation } from '../product-editor/product-editor.repository.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';
import { env } from '../../config/env.js';
import { normalizeImportRows, parseXlsxAgGridBuffer, previewImportXlsx, splitDescricaoProduto, upsertProdutoImportBatch, upsertProdutoVariacaoEstoque } from './produtos-import.repository.js';

const GRADES = ['P', 'M', 'G', 'GG', '35-36', '37-38', '39-40', '41-42', '43-44', 'UNI'];

function assertContextAccount(context = {}) {
  const accountId = getAccountIdFromContext(context);
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produtos-import' });
  return accountId;
}

function cleanBody(body = {}) {
  const clone = { ...(body || {}) };
  delete clone.account_id; delete clone.accountId; delete clone.tenant_id; delete clone.tenantId; delete clone.owner_user_id; delete clone.ownerUserId;
  return clone;
}

function parseBase64File(file) {
  if (!file) return null;
  if (Buffer.isBuffer(file)) return file;
  if (file?.buffer && Buffer.isBuffer(file.buffer)) return file.buffer;
  if (file?.content && Buffer.isBuffer(file.content)) return file.content;
  if (file?.data && Buffer.isBuffer(file.data)) return file.data;
  if (Array.isArray(file)) {
    return parseBase64File(file[0] || null);
  }
  if (file?.base64) {
    return Buffer.from(String(file.base64).replace(/^data:[^;]+;base64,/, ''), 'base64');
  }
  if (typeof file === 'string') {
    return Buffer.from(String(file).replace(/^data:[^;]+;base64,/, ''), 'base64');
  }
  return null;
}

function shouldLogImportPreview() {
  return String(env?.APP_ENV || env?.NODE_ENV || '').toLowerCase() !== 'production';
}

function resolveFabricanteId(context = {}) {
  const body = cleanBody(context.body || {});
  const nestedBody = cleanBody(body.body || {});
  const merged = { ...nestedBody, ...body };
  return merged.fabricante_id || merged.fabricanteId || merged.fabricante?.id || null;
}

function resolveImportFile(context = {}) {
  const body = cleanBody(context.body || {});
  const nestedBody = cleanBody(body.body || {});
  const merged = { ...nestedBody, ...body };
  return merged.file || merged.arquivo || merged.xlsx || null;
}

async function ensureFabricante(accountId, fabricanteId) {
  const fabricante = await getFabricanteById(fabricanteId, { accountId }).catch(() => null);
  if (!fabricante) throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import' });
  return fabricante;
}

async function findProdutoByIdentity(accountId, fabricanteId, skuPai) {
  const result = await listProdutos({ search: skuPai, page: 1, limit: 100 }, { accountId });
  return (result.items || []).find((item) => String(item.fabricante_id || '') === String(fabricanteId) && String(item.codigo || item.sku || '') === String(skuPai)) || null;
}

async function upsertProdutoPai(accountId, fabricanteId, parsed) {
  const existing = await findProdutoByIdentity(accountId, fabricanteId, parsed.codigo_erp);
  const payload = {
    fabricante_id: fabricanteId,
    codigo: parsed.codigo_erp,
    sku: parsed.codigo_erp,
    nome: parsed.nome_produto,
    status: 'ativo'
  };
  if (existing) {
    return { item: await updateProduto(existing.id, payload, { accountId }), created: false };
  }
  return { item: await createProduto(payload, { accountId }), created: true };
}

async function upsertVariacao(accountId, produtoId, parsed, grade) {
  const nome = grade === 'UNI' ? parsed.variacao_nome || 'UNI' : `${parsed.variacao_nome || 'PADRAO'} / ${grade}`;
  const variations = await listVariations(produtoId, { accountId });
  const existing = variations.find((v) => String(v.nome) === String(nome) && String(v.grade || '') === String(grade));
  const payload = { sku: `${parsed.codigo_erp}-${grade}`, nome, valor: parsed.variacao_nome || '', cor: parsed.variacao_nome || '', preco: 0, ativo: true, multiplo_venda: 1, grade, tamanho: grade };
  if (existing) {
    return { item: await updateVariation(produtoId, existing.id, payload, { accountId }), created: false };
  }
  return { item: await createVariation(produtoId, payload, { accountId }), created: true };
}

function computeGradeTotals(row) {
  return GRADES.reduce((sum, grade) => {
    const quantity = Number(String(row[grade] ?? '').replace(',', '.'));
    return Number.isFinite(quantity) && quantity >= 0 ? sum + quantity : sum;
  }, 0);
}

export async function previewProdutosImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const body = cleanBody(context.body || {});
  const fabricanteId = resolveFabricanteId(context);
  const file = resolveImportFile(context);
  if (shouldLogImportPreview()) {
    console.log('[produtos-import] preview received', {
      requestId: context.requestId || null,
      fabricanteId,
      bodyKeys: Object.keys(body || {}),
      hasFile: Boolean(file),
      fileKeys: file && typeof file === 'object' ? Object.keys(file) : []
    });
  }
  if (!fabricanteId) throw new BadRequestError('fabricante_id obrigatorio', { domain: 'produtos-import' });
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'produtos-import' });
  await ensureFabricante(accountId, fabricanteId);
  return previewImportXlsx({ accountId, fabricanteId, fileName: file.fileName || file.filename || 'import.xlsx', buffer });
}

export async function executeProdutosImportHandler(context = {}) {
  const accountId = assertContextAccount(context);
  const fabricanteId = resolveFabricanteId(context);
  const file = resolveImportFile(context);
  if (!fabricanteId) throw new BadRequestError('fabricante_id obrigatorio', { domain: 'produtos-import' });
  const buffer = parseBase64File(file);
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'produtos-import' });
  await ensureFabricante(accountId, fabricanteId);

  const batchPreview = await previewImportXlsx({ accountId, fabricanteId, fileName: file.fileName || file.filename || 'import.xlsx', buffer });
  const rows = normalizeImportRows(parseXlsxAgGridBuffer(buffer)).dataRows;
  const batch = await upsertProdutoImportBatch({ id: batchPreview.batchId, status: 'processing', arquivo_nome: file.fileName || file.filename || 'import.xlsx', fabricante_id: fabricanteId, total_linhas: rows.length, linhas_processadas: 0, produtos_criados: 0, produtos_atualizados: 0, variacoes_criadas: 0, variacoes_atualizadas: 0, estoques_atualizados: 0, erros: 0 }, { accountId });

  const summary = {
    batchId: batch.id,
    arquivo_nome: file.fileName || file.filename || 'import.xlsx',
    fabricante_id: fabricanteId,
    status: 'processing',
    total_linhas: rows.length,
    linhas_processadas: 0,
    produtos_criados: 0,
    produtos_atualizados: 0,
    variacoes_criadas: 0,
    variacoes_atualizadas: 0,
    estoques_atualizados: 0,
    divergencias: batchPreview.divergences || 0,
    erros: []
  };

  try {
    for (const row of rows) {
      const parsed = splitDescricaoProduto(row['Descrição']);
      if (!parsed) continue;
      const productUpsert = await upsertProdutoPai(accountId, fabricanteId, parsed);
      summary[productUpsert.created ? 'produtos_criados' : 'produtos_atualizados'] += 1;
      for (const grade of GRADES) {
        const rawQty = row[grade];
        if (rawQty === undefined || rawQty === null || String(rawQty).trim() === '') continue;
        const quantity = Number(String(rawQty).replace(',', '.'));
        if (!Number.isFinite(quantity) || quantity < 0) {
          summary.erros.push({ linha: parsed.codigo_erp, grade, message: 'Quantidade invalida' });
          continue;
        }
        const variationUpsert = await upsertVariacao(accountId, productUpsert.item.id, parsed, grade);
        summary[variationUpsert.created ? 'variacoes_criadas' : 'variacoes_atualizadas'] += 1;
        const stock = await registerImportStockMovement(productUpsert.item.id, variationUpsert.item.id, {
          quantidade: quantity,
          origem: 'IMPORTACAO_XLSX',
          arquivo_origem: file.fileName || file.filename || 'import.xlsx',
          import_batch_id: batch.id
        }, { accountId, fabricanteId });
        if (stock?.movement) summary.estoques_atualizados += 1;
      }
      summary.linhas_processadas += 1;
    }
    const finalStatus = summary.erros.length || summary.divergencias ? 'completed_with_warnings' : 'completed';
    await upsertProdutoImportBatch({ id: batch.id, ...summary, status: finalStatus, erros: summary.erros.length, updated_at: new Date().toISOString() }, { accountId });
    return { ok: true, batch: { ...summary, status: finalStatus, erros: summary.erros } };
  } catch (error) {
    await upsertProdutoImportBatch({ id: batch.id, status: 'failed', erros: summary.erros.length + 1, updated_at: new Date().toISOString() }, { accountId }).catch(() => null);
    throw error;
  }
}
