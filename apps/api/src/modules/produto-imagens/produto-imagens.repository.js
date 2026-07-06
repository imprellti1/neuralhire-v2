import path from 'node:path';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { BaseRepository } from '../../database/base.repository.js';
import { database } from '../../database/database.adapter.js';
import { ProdutoImagensQueries } from '../../database/queries/produto-imagens.queries.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getProdutoById } from '../produtos/produtos.repository.js';
import { getProductEditorProduct } from '../product-editor/product-editor.repository.js';

const BUCKET = 'produtos-imagens';
const MAX_BYTES = Number(process.env.PRODUTOS_IMAGENS_MAX_BYTES || 5 * 1024 * 1024);
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const memoryProdutoImagens = [];
let databaseModeCache = null;

class ProdutoImagensRepository extends BaseRepository {
  constructor(adapter = database) {
    super(adapter, { logContext: 'produto-imagens' });
  }
}

const repository = new ProdutoImagensRepository();

function assertAccountId(accountId) { if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produto-imagens' }); }
function mode() { return isSupabaseConfigured() ? 'supabase' : 'memory'; }
function normalizeText(v) { return String(v || '').trim(); }
function normalizeUpload(input = {}) {
  const fileName = normalizeText(input.fileName || input.filename);
  const mimeType = normalizeText(input.mimeType || input.contentType).toLowerCase();
  const base64 = normalizeText(input.base64 || input.data);
  const size = Number(input.size || 0);
  if (!fileName || !mimeType || !base64) throw new BadRequestError('Arquivo invalido');
  if (!ALLOWED.has(mimeType)) throw new BadRequestError('Formato de imagem invalido');
  if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) throw new BadRequestError('Arquivo excede o limite permitido');
  return { fileName, mimeType, base64, size };
}
async function ensureBucket(supabase) {
  try {
    const { data } = await supabase.storage.listBuckets();
    if (!Array.isArray(data) || !data.find((bucket) => bucket.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES });
    }
  } catch {}
}
function safeName(name) { return path.basename(name, path.extname(name)).replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'imagem'; }
function storagePath(accountId, produtoId, variacaoId, fileName) { return `${accountId}/${produtoId}/${variacaoId || 'pai'}/${Date.now()}-${safeName(fileName)}.${EXT.get(normalizeText(fileName).toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')}`; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function isDatabaseMode() {
  if (databaseModeCache !== null) return databaseModeCache;
  try {
    await repository.one(ProdutoImagensQueries.ping(), []);
    databaseModeCache = true;
  } catch (error) {
    databaseModeCache = false;
    if (error?.code !== 'ECONNREFUSED' && error?.cause?.code !== 'ECONNREFUSED') {
      // Keep the existing fallback behavior silent.
    }
  }
  return databaseModeCache;
}

async function assertProdutoScope(accountId, produtoId, variacaoId = null) {
  const produto = await getProdutoById(produtoId, { accountId });
  if (variacaoId) {
    const editor = await getProductEditorProduct(produtoId, { accountId }).catch(() => null);
    const match = (editor?.variations || []).find((v) => String(v.id) === String(variacaoId));
    if (!match) throw new NotFoundError('Variacao nao encontrada');
  }
  return produto;
}

async function uploadToStorage({ accountId, produtoId, variacaoId, upload }) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new DatabaseError('Supabase indisponivel');
  await ensureBucket(supabase);
  const normalized = normalizeUpload(upload);
  const bytes = Buffer.from(normalized.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
  const ext = EXT.get(normalized.mimeType);
  const objectPath = `${accountId}/${produtoId}/${variacaoId || 'pai'}/${Date.now()}-${safeName(normalized.fileName)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, { upsert: true, contentType: normalized.mimeType });
  if (error) throw new DatabaseError('Falha ao enviar imagem', { details: error });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return { url: data?.publicUrl || null, storage_path: objectPath };
}

async function enforceSinglePrincipal(accountId, produtoId, variacaoId, keepId = null) {
  if (await isDatabaseMode()) {
    await repository.execute(ProdutoImagensQueries.unsetPrincipal(), [accountId, produtoId, variacaoId || null, keepId || null]);
    return;
  }
  for (let i = 0; i < memoryProdutoImagens.length; i += 1) {
    const row = memoryProdutoImagens[i];
    if (row.account_id === accountId && String(row.produto_id) === String(produtoId) && String(row.variacao_id || '') === String(variacaoId || '') && String(row.id) !== String(keepId || '')) {
      memoryProdutoImagens[i] = { ...row, principal: false };
    }
  }
}

function applyMemoryInsert(payload) {
  const item = { id: randomUUID(), ...payload };
  memoryProdutoImagens.push(item);
  return clone(item);
}

function applyMemoryUpdate(produtoId, imagemId, accountId, patch) {
  const idx = memoryProdutoImagens.findIndex((row) => row.account_id === accountId && String(row.produto_id) === String(produtoId) && String(row.id) === String(imagemId));
  if (idx < 0) throw new NotFoundError('Imagem nao encontrada');
  memoryProdutoImagens[idx] = { ...memoryProdutoImagens[idx], ...patch };
  return clone(memoryProdutoImagens[idx]);
}

function applyMemoryDelete(produtoId, imagemId, accountId) {
  const idx = memoryProdutoImagens.findIndex((row) => row.account_id === accountId && String(row.produto_id) === String(produtoId) && String(row.id) === String(imagemId));
  if (idx < 0) throw new NotFoundError('Imagem nao encontrada');
  const [removed] = memoryProdutoImagens.splice(idx, 1);
  return clone(removed);
}

export async function listProdutoImagens(produtoId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await assertProdutoScope(accountId, produtoId);
  if (await isDatabaseMode()) {
    const rows = await repository.many(ProdutoImagensQueries.list(), [accountId, produtoId]);
    return { items: rows || [], total: (rows || []).length };
  }
  const items = memoryProdutoImagens.filter((row) => row.account_id === accountId && String(row.produto_id) === String(produtoId)).sort((a, b) => Boolean(b.principal) - Boolean(a.principal) || Number(a.ordem || 0) - Number(b.ordem || 0) || new Date(a.created_at || 0) - new Date(b.created_at || 0)).map(clone);
  return { items, total: items.length };
}

export async function createProdutoImagem(produtoId, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await assertProdutoScope(accountId, produtoId, data.variacao_id || null);
  const supabase = getSupabaseClient();
  const uploaded = await uploadToStorage({ accountId, produtoId, variacaoId: data.variacao_id || null, upload: data.upload || data.file });
  const payload = {
    account_id: accountId,
    produto_id: produtoId,
    variacao_id: data.variacao_id || null,
    url: uploaded.url,
    storage_path: uploaded.storage_path,
    ordem: Number.isFinite(Number(data.ordem)) ? Number(data.ordem) : 0,
    principal: Boolean(data.principal),
    tipo: normalizeText(data.tipo) || 'image',
    metadata: data.metadata || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (await isDatabaseMode()) {
    if (payload.principal) await enforceSinglePrincipal(accountId, produtoId, payload.variacao_id, null);
    const inserted = await repository.one(ProdutoImagensQueries.insert(), [
      randomUUID(), payload.account_id, payload.produto_id, payload.variacao_id, payload.url, payload.storage_path, payload.ordem, payload.principal, payload.tipo, payload.metadata, payload.created_at, payload.updated_at
    ]);
    if (payload.principal) await enforceSinglePrincipal(accountId, produtoId, payload.variacao_id, inserted.id);
    return inserted;
  }
  if (payload.principal) await enforceSinglePrincipal(accountId, produtoId, payload.variacao_id, null);
  const inserted = applyMemoryInsert(payload);
  if (payload.principal) await enforceSinglePrincipal(accountId, produtoId, payload.variacao_id, inserted.id);
  return inserted;
}

export async function updateProdutoImagem(produtoId, imagemId, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await assertProdutoScope(accountId, produtoId, data.variacao_id || null);
  const supabase = getSupabaseClient();
  if (await isDatabaseMode()) {
    const patch = {};
    if (data.principal !== undefined) patch.principal = Boolean(data.principal);
    if (data.ordem !== undefined) patch.ordem = Number(data.ordem) || 0;
    if (data.tipo !== undefined) patch.tipo = normalizeText(data.tipo) || 'image';
    if (data.metadata !== undefined) patch.metadata = data.metadata || null;
    if (data.upload) {
      const uploaded = await uploadToStorage({ accountId, produtoId, variacaoId: data.variacao_id || null, upload: data.upload });
      patch.url = uploaded.url;
      patch.storage_path = uploaded.storage_path;
    }
    const current = await repository.one(ProdutoImagensQueries.getById(), [accountId, produtoId, imagemId]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw new DatabaseError('Falha ao localizar imagem', { details: error });
    });
    if (!current) throw new NotFoundError('Imagem nao encontrada');
    const scopeVariacao = current.variacao_id || null;
    if (patch.principal) await enforceSinglePrincipal(accountId, produtoId, scopeVariacao, imagemId);
    const updated = await repository.one(ProdutoImagensQueries.update(), [
      accountId,
      produtoId,
      imagemId,
      current.variacao_id || null,
      patch.url ?? current.url,
      patch.storage_path ?? current.storage_path,
      patch.ordem ?? current.ordem ?? 0,
      patch.principal ?? current.principal ?? false,
      (patch.tipo ?? current.tipo) || 'image',
      patch.metadata ?? current.metadata ?? null,
      new Date().toISOString()
    ]);
    if (patch.principal) await enforceSinglePrincipal(accountId, produtoId, scopeVariacao, imagemId);
    return updated;
  }

  const current = memoryProdutoImagens.find((row) => row.account_id === accountId && String(row.produto_id) === String(produtoId) && String(row.id) === String(imagemId));
  if (!current) throw new NotFoundError('Imagem nao encontrada');
  const patch = { updated_at: new Date().toISOString() };
  if (data.principal !== undefined) patch.principal = Boolean(data.principal);
  if (data.ordem !== undefined) patch.ordem = Number(data.ordem) || 0;
  if (data.tipo !== undefined) patch.tipo = normalizeText(data.tipo) || 'image';
  if (data.metadata !== undefined) patch.metadata = data.metadata || null;
  if (data.upload) {
    const uploaded = await uploadToStorage({ accountId, produtoId, variacaoId: data.variacao_id || current.variacao_id || null, upload: data.upload });
    patch.url = uploaded.url;
    patch.storage_path = uploaded.storage_path;
  }
  if (patch.principal) await enforceSinglePrincipal(accountId, produtoId, current.variacao_id || null, imagemId);
  const updated = applyMemoryUpdate(produtoId, imagemId, accountId, patch);
  if (patch.principal) await enforceSinglePrincipal(accountId, produtoId, current.variacao_id || null, imagemId);
  return updated;
}

export async function deleteProdutoImagem(produtoId, imagemId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const supabase = getSupabaseClient();
  if (await isDatabaseMode()) {
    const current = await repository.one(ProdutoImagensQueries.getById(), [accountId, produtoId, imagemId]).catch((error) => {
      if (error?.code === 'DATABASE_NOT_ONE') return null;
      throw new DatabaseError('Falha ao localizar imagem', { details: error });
    });
    if (!current) throw new NotFoundError('Imagem nao encontrada');
    const { rowCount } = await repository.execute(ProdutoImagensQueries.delete(), [accountId, produtoId, imagemId]);
    if (typeof rowCount !== 'number') throw new DatabaseError('Falha ao remover imagem');
    if (current.storage_path) await supabase.storage.from(BUCKET).remove([current.storage_path]).catch(() => null);
    return { removed: true };
  }
  const current = applyMemoryDelete(produtoId, imagemId, accountId);
  if (current.storage_path) await supabase.storage.from(BUCKET).remove([current.storage_path]).catch(() => null);
  return { removed: true };
}

export function __resetMemoryProdutoImagens() {
  memoryProdutoImagens.length = 0;
  databaseModeCache = null;
}
