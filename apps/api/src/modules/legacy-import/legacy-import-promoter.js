import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../core/errors.js';
import { createCliente, getClienteById } from '../clientes/clientes.repository.js';
import { createProduto, getProdutoById } from '../produtos/produtos.repository.js';
import { addIssue, getBatch, getBatchIssues, getBatchRecords, updateBatchFields, updateBatchStatus, updateBatchSummary, updateRecordFields } from './legacy-import-staging.repository.js';

const entityOrder = ['vendedores', 'fabricantes', 'clientes', 'produtos', 'pedidos', 'pedidoItens'];

function assertAccountId(accountId) {
  if (!accountId) throw new ValidationError('Contexto de tenant obrigatorio', { domain: 'legacy-import' });
}

function emptySummary() {
  return Object.fromEntries(entityOrder.map((entity) => [entity, { created: 0, updated: 0, skipped: 0, failed: 0 }]));
}

function naturalKey(entity, payload = {}) {
  const norm = (value) => String(value || '').trim().toLowerCase();
  if (entity === 'vendedores') return [norm(payload.email), norm(payload.nome)].filter(Boolean).join('|');
  if (entity === 'fabricantes') return [norm(payload.cnpj), norm(payload.nome || payload.razao_social)].filter(Boolean).join('|');
  if (entity === 'clientes') return [norm(payload.cnpj), norm(payload.codigo_cliente_fabricante), norm(payload.nome || payload.empresa || payload.razao_social)].filter(Boolean).join('|');
  if (entity === 'produtos') return [norm(payload.sku), norm(payload.codigo || payload.referencia), norm(payload.nome)].filter(Boolean).join('|');
  if (entity === 'pedidos') return [norm(payload.numero), norm(payload.numero_erp), norm(payload.numero_pedido)].filter(Boolean).join('|');
  return [norm(payload.numero_pedido), norm(payload.sku), norm(payload.pedido_id), norm(payload.produto_id)].filter(Boolean).join('|');
}

function recordKey(record = {}) {
  return String(record.target_entity_id || record.id || record.natural_key || record.legacy_id || '');
}

function sanitizePayload(record = {}) {
  return JSON.parse(JSON.stringify(record.normalized_payload || {}));
}

export function mergeImportEntity(current = {}, incoming = {}) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value === null || value === undefined || value === '') continue;
    const currentValue = merged[key];
    if (typeof value === 'string') {
      merged[key] = String(value).trim();
      continue;
    }
    if (typeof value === 'number') {
      if (Number.isNaN(value)) continue;
      if (key === 'preco' && currentValue !== undefined && Number(currentValue) > 0 && value === 0) continue;
      merged[key] = value;
      continue;
    }
    if (typeof value === 'boolean') {
      merged[key] = value;
      continue;
    }
    if (value instanceof Date) {
      const currentDate = currentValue ? new Date(currentValue) : null;
      if (!currentDate || value > currentDate) merged[key] = value.toISOString();
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export function reconcileRelationships(record = {}, recordLookup = {}) {
  const payload = sanitizePayload(record);
  if (record.entity === 'pedidos') {
    payload.cliente_id = payload.cliente_id || recordLookup.clientesByKey?.get(String(payload.codigo_cliente_fabricante || payload.cnpj || '').toLowerCase())?.id || null;
  }
  if (record.entity === 'pedidoItens') {
    payload.pedido_id = payload.pedido_id || recordLookup.pedidosByKey?.get(String(payload.numero_pedido || payload.numero_erp || payload.pedido_id || '').toLowerCase())?.id || null;
    payload.produto_id = payload.produto_id || recordLookup.produtosByKey?.get(String(payload.sku || '').toLowerCase())?.id || null;
  }
  return payload;
}

async function resolveClienteId(payload, recordLookup, accountId) {
  if (payload.cliente_id) {
    try {
      const cliente = await getClienteById(payload.cliente_id, { accountId });
      return cliente.id;
    } catch {}
  }
  const keys = [payload.codigo_cliente_fabricante, payload.cnpj].filter(Boolean).map((value) => String(value).toLowerCase());
  for (const key of keys) {
    const found = recordLookup.clientesByKey.get(key);
    if (found) return found.id;
  }
  return null;
}

async function resolveProdutoId(payload, recordLookup, accountId) {
  if (payload.produto_id) {
    try {
      const produto = await getProdutoById(payload.produto_id, { accountId });
      return produto.id;
    } catch {}
  }
  const key = String(payload.sku || '').toLowerCase();
  return key ? (recordLookup.produtosByKey.get(key)?.id || null) : null;
}

async function createOrRemember(entity, payload, accountId, recordLookup) {
  const key = naturalKey(entity, payload);
  if (entity === 'clientes') {
    const cliente = await createCliente(payload, { accountId });
    if (key) recordLookup.clientesByKey.set(key, cliente);
    return cliente;
  }
  if (entity === 'produtos') {
    const produto = await createProduto(payload, { accountId });
    if (key) recordLookup.produtosByKey.set(key, produto);
    return produto;
  }
  if (entity === 'pedidos') {
    return { id: randomUUID(), account_id: accountId, ...payload, created_at: new Date().toISOString() };
  }
  if (entity === 'vendedores' || entity === 'fabricantes') {
    return { id: randomUUID(), account_id: accountId, ...payload };
  }
  return null;
}

export async function promoteLegacyImportBatch(batchId, context = {}) {
  const accountId = context.accountId || null;
  assertAccountId(accountId);

  const batch = await getBatch(batchId, { accountId });
  if (String(batch.status || '') === 'imported') {
    return { ok: true, code: 'BATCH_ALREADY_IMPORTED' };
  }
  if (String(batch.status || '') !== 'approved') {
    return { ok: false, code: 'BATCH_NOT_APPROVED' };
  }

  const issues = await getBatchIssues(batchId, { accountId });
  if (issues.some((issue) => issue.severity === 'error')) {
    return { ok: false, code: 'BATCH_HAS_ERRORS' };
  }

  const records = (await getBatchRecords(batchId, { accountId })).filter((record) => !['invalid', 'rejected', 'skipped'].includes(String(record.status || '')));
  const summary = emptySummary();
  const recordLookup = { clientesByKey: new Map(), produtosByKey: new Map(), pedidosByKey: new Map() };

  for (const entity of entityOrder) {
    for (const record of records.filter((item) => item.entity === entity)) {
      if (String(record.status || '') === 'imported' && record.target_entity_id) {
        summary[entity].skipped += 1;
        continue;
      }

      const payload = reconcileRelationships(record, recordLookup);
      try {
        let target = null;
        if (entity === 'clientes') {
          target = await createOrRemember(entity, mergeImportEntity(recordLookup.clientesByKey.get(naturalKey(entity, payload)) || {}, { ...payload, account_id: accountId }), accountId, recordLookup);
        } else if (entity === 'produtos') {
          target = await createOrRemember(entity, mergeImportEntity(recordLookup.produtosByKey.get(naturalKey(entity, payload)) || {}, { ...payload, account_id: accountId }), accountId, recordLookup);
        } else if (entity === 'pedidos') {
          const clienteId = await resolveClienteId(payload, recordLookup, accountId);
          if (!clienteId) {
            summary[entity].failed += 1;
            await addIssue({ batch_id: batchId, record_id: record.id, entity, field: 'cliente_id', code: 'CLIENTE_NOT_FOUND', message: 'Pedido sem cliente resolvido', severity: 'error' }, { accountId });
            await updateRecordFields(record.id, { status: 'failed', promotion_status: 'failed', promotion_notes: 'cliente ausente' }, { accountId });
            continue;
          }
          target = await createOrRemember(entity, { ...mergeImportEntity({}, { ...payload, cliente_id: clienteId, account_id: accountId }) }, accountId, recordLookup);
          const orderKey = naturalKey(entity, payload);
          if (orderKey) recordLookup.pedidosByKey.set(orderKey, target);
        } else if (entity === 'pedidoItens') {
          const orderKey = naturalKey('pedidos', { numero: payload.numero_pedido || payload.numero_erp || payload.pedido_id });
          const pedidoId = recordLookup.pedidosByKey.get(orderKey)?.id || payload.pedido_id || null;
          const produtoId = await resolveProdutoId(payload, recordLookup, accountId);
          if (!pedidoId || !produtoId) {
            summary[entity].failed += 1;
            await addIssue({ batch_id: batchId, record_id: record.id, entity, field: !pedidoId ? 'pedido_id' : 'produto_id', code: 'ORPHAN_RECORD', message: 'Item sem pedido ou produto resolvido', severity: 'error' }, { accountId });
            await updateRecordFields(record.id, { status: 'failed', promotion_status: 'failed', promotion_notes: 'relacionamento ausente' }, { accountId });
            continue;
          }
          target = { id: randomUUID(), account_id: accountId, pedido_id: pedidoId, produto_id: produtoId };
        } else {
          target = await createOrRemember(entity, { ...payload, account_id: accountId }, accountId, recordLookup);
        }

        summary[entity].created += 1;
        if (target?.id) {
          await updateRecordFields(record.id, { status: 'imported', promotion_status: 'imported', target_entity_id: target.id, promotion_notes: 'importado com sucesso' }, { accountId });
        }
      } catch (error) {
        summary[entity].failed += 1;
        await addIssue({ batch_id: batchId, record_id: record.id, entity, field: null, code: 'PROMOTION_FAILED', message: String(error?.message || error), severity: 'error' }, { accountId });
        await updateRecordFields(record.id, { status: 'failed', promotion_status: 'failed', promotion_notes: String(error?.message || error) }, { accountId });
      }
    }
  }

  await updateBatchFields(batchId, { promotion_summary: summary, promotion_report: { generatedAt: new Date().toISOString() } }, { accountId });
  await updateBatchSummary(batchId, summary, { accountId });
  await updateBatchStatus(batchId, 'imported', { accountId });
  return { ok: true, batchId, status: 'imported', summary, issues: await getBatchIssues(batchId, { accountId }) };
}
