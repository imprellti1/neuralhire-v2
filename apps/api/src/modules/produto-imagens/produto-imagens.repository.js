import path from 'node:path';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { BadRequestError, DatabaseError, ForbiddenError, NotFoundError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getProdutoById } from '../produtos/produtos.repository.js';
import { getProductEditorProduct } from '../product-editor/product-editor.repository.js';
import { getProdutoCategoriaById } from '../produto-categorias/produto-categorias.repository.js';

const BUCKET = 'produtos-imagens';
const MAX_BYTES = Number(process.env.PRODUTOS_IMAGENS_MAX_BYTES || 5 * 1024 * 1024);
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXT = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);

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

async function assertProdutoScope(accountId, produtoId, variacaoId = null) {
  const produto = await getProdutoById(produtoId, { accountId });
  if (variacaoId) {
    const editor = await getProductEditorProduct(produtoId, { accountId }).catch(() => null);
    const match = (editor?.variations || []).find((v) => String(v.id) === String(variacaoId));
    if (!match) throw new NotFoundError('Variacao nao encontrada');
  }
  return produto;
}

export async function listProdutoImagens(produtoId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId); await assertProdutoScope(accountId, produtoId);
  const supabase = getSupabaseClient();
  if (mode() === 'supabase') {
    const { data, error } = await supabase.from('produto_imagens').select('*').eq('account_id', accountId).eq('produto_id', produtoId).order('principal', { ascending: false }).order('ordem', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw new DatabaseError('Falha ao listar imagens', { details: error });
    return { items: data || [], total: (data || []).length };
  }
  return { items: [], total: 0 };
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

async function enforceSinglePrincipal(supabase, accountId, produtoId, variacaoId, keepId = null) {
  const query = supabase.from('produto_imagens').update({ principal: false }).eq('account_id', accountId).eq('produto_id', produtoId);
  if (variacaoId) query.eq('variacao_id', variacaoId); else query.is('variacao_id', null);
  if (keepId) query.neq('id', keepId);
  await query;
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
    tipo: normalizeText(data.tipo) || 'image'
  };
  if (mode() === 'supabase') {
    if (payload.principal) await enforceSinglePrincipal(supabase, accountId, produtoId, payload.variacao_id, null);
    const { data: inserted, error } = await supabase.from('produto_imagens').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar imagem', { details: error });
    if (payload.principal) await enforceSinglePrincipal(supabase, accountId, produtoId, payload.variacao_id, inserted.id);
    return inserted;
  }
  return { id: randomUUID(), ...payload };
}

export async function updateProdutoImagem(produtoId, imagemId, data = {}, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  await assertProdutoScope(accountId, produtoId, data.variacao_id || null);
  const supabase = getSupabaseClient();
  if (mode() === 'supabase') {
    const patch = {};
    if (data.principal !== undefined) patch.principal = Boolean(data.principal);
    if (data.ordem !== undefined) patch.ordem = Number(data.ordem) || 0;
    if (data.tipo !== undefined) patch.tipo = normalizeText(data.tipo) || 'image';
    if (data.upload) {
      const uploaded = await uploadToStorage({ accountId, produtoId, variacaoId: data.variacao_id || null, upload: data.upload });
      patch.url = uploaded.url;
      patch.storage_path = uploaded.storage_path;
    }
    const { data: current, error: currentError } = await supabase.from('produto_imagens').select('*').eq('account_id', accountId).eq('produto_id', produtoId).eq('id', imagemId).maybeSingle();
    if (currentError) throw new DatabaseError('Falha ao localizar imagem', { details: currentError });
    if (!current) throw new NotFoundError('Imagem nao encontrada');
    const scopeVariacao = current.variacao_id || null;
    if (patch.principal) await enforceSinglePrincipal(supabase, accountId, produtoId, scopeVariacao, imagemId);
    const { data: updated, error } = await supabase.from('produto_imagens').update(patch).eq('account_id', accountId).eq('produto_id', produtoId).eq('id', imagemId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar imagem', { details: error });
    if (patch.principal) await enforceSinglePrincipal(supabase, accountId, produtoId, scopeVariacao, imagemId);
    return updated;
  }
  throw new DatabaseError('Modo memory nao implementa imagens');
}

export async function deleteProdutoImagem(produtoId, imagemId, options = {}) {
  const accountId = options.accountId || null; assertAccountId(accountId);
  const supabase = getSupabaseClient();
  if (mode() === 'supabase') {
    const { data: current } = await supabase.from('produto_imagens').select('*').eq('account_id', accountId).eq('produto_id', produtoId).eq('id', imagemId).maybeSingle();
    if (!current) throw new NotFoundError('Imagem nao encontrada');
    const { error } = await supabase.from('produto_imagens').delete().eq('account_id', accountId).eq('produto_id', produtoId).eq('id', imagemId);
    if (error) throw new DatabaseError('Falha ao remover imagem', { details: error });
    if (current.storage_path) await supabase.storage.from(BUCKET).remove([current.storage_path]).catch(() => null);
    return { removed: true };
  }
  return { removed: true };
}
