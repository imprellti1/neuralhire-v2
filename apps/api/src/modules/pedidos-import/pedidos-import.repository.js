import { randomUUID } from 'node:crypto';
import xlsx from 'xlsx';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { listClientes, recalculateClientsCommercialHistory } from '../clientes/clientes.repository.js';
import { getPedidosRepositoryMode } from '../pedidos/pedidos.repository.js';
import { createPedidoFromImport } from '../pedidos/pedidos.repository.js';
import { getSupabaseClient } from '../../database/supabase.client.js';

const sessions = new Map();
const IGNORED_COLUMNS = new Set(['lote gravação', 'data prev.fatur.', 'razão social', 'qt. peças', 'valor total', 'valor cancelado', 'origem', 'duplicar', 'imprimir']);
const MATCH_KEYS = ['codigo_cliente_fabricante', 'codigo_cliente', 'codigo', 'cliente'];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'pedidos-import' });
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeNumeroKey(numero) {
  return normalizeText(numero);
}

function normalizeHeader(value) {
  return normalizeText(value).toLowerCase();
}

function pickHeaderIndex(headers, names) {
  const normalized = headers.map((header) => normalizeHeader(header));
  for (const name of names) {
    const idx = normalized.indexOf(normalizeHeader(name));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s+/g, '').replace(/^R\$/i, '').replace(/\./g, '').replace(/,/g, '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWorkbook(buffer) {
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'pedidos-import', code: 'INVALID_XLSX' });
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  } catch (error) {
    throw new BadRequestError('Nao foi possivel ler a planilha.', { domain: 'pedidos-import', code: 'INVALID_XLSX', details: { cause: error?.message || String(error) } });
  }
  const sheetName = workbook.SheetNames.find((name) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: false });
    return rows.some((row) => row.some((cell) => String(cell ?? '').trim()));
  });
  if (!sheetName) throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'pedidos-import', code: 'NO_SHEET_WITH_DATA' });
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false });
  const headers = rows[0].map((cell) => String(cell ?? '').trim());
  const dataRows = rows.slice(1).map((row, index) => ({ rowNumber: index + 2, row })).filter((entry) => entry.row.some((cell) => String(cell ?? '').trim()));
  return { sheetName, headers, dataRows };
}

async function listAllClientes(accountId) {
  const items = [];
  let page = 1;
  while (true) {
    const result = await listClientes({ page, limit: 100 }, { accountId });
    items.push(...(result.items || []));
    if (!result.items?.length || page >= (result.totalPages || 1)) break;
    page += 1;
  }
  return items;
}

async function loadExistingPedidoNumeroKeys(accountId, numeros = []) {
  const targetNumeros = [...new Set((numeros || []).map((numero) => normalizeNumeroKey(numero)).filter(Boolean))];
  if (!targetNumeros.length) return new Set();

  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('pedidos').select('numero').eq('account_id', accountId).in('numero', targetNumeros);
    if (error) throw new DatabaseError('Falha ao consultar pedidos existentes', { details: error });
    return new Set((data || []).map((pedido) => `${accountId}::${normalizeNumeroKey(pedido?.numero)}`).filter((key) => key !== `${accountId}::`));
  }

  const { __dumpMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  return new Set((snapshot.pedidos || []).filter((pedido) => pedido.account_id === accountId).map((pedido) => `${accountId}::${normalizeNumeroKey(pedido?.numero)}`).filter((key) => key !== `${accountId}::`));
}

function getClienteCode(cliente = {}) {
  return normalizeText(cliente.codigo || '');
}

function findClienteByCode(clientes, codigo) {
  const target = normalizeText(codigo);
  if (!target) return null;
  return clientes.find((cliente) => getClienteCode(cliente) === target) || null;
}

function buildIgnoredValues(headers, row) {
  const ignored = {};
  headers.forEach((header, index) => {
    if (IGNORED_COLUMNS.has(normalizeHeader(header))) {
      ignored[header] = row[index] ?? null;
    }
  });
  return ignored;
}

function buildRow(headers, row, rowNumber) {
  const get = (name) => {
    const idx = pickHeaderIndex(headers, [name]);
    return idx >= 0 ? row[idx] : '';
  };
  return {
    rowNumber,
    numero: normalizeText(get('Número ERP') || get('Número') || get('Numero') || get('Pedido')),
    clienteCodigo: normalizeText(get('Cliente')),
    status: normalizeText(get('Status')) || 'rascunho',
    observacoes: normalizeText(get('Observações') || get('Observacoes')) || null,
    subtotal: parseMoney(get('Subtotal')),
    desconto: parseMoney(get('Desconto')),
    total: parseMoney(get('Total')),
    metadata: {
      lote_gravacao: get('Lote Gravação') || null,
      data_prev_fatur: get('Data Prev.Fatur.') || null,
      qt_pecas: get('Qt. Peças') || null,
      valor_total: get('Valor Total') || null,
      valor_cancelado: get('Valor cancelado') || null,
      origem_planilha: get('Origem') || null,
      duplicar: get('Duplicar') || null,
      imprimir: get('Imprimir') || null
    },
    ignored: buildIgnoredValues(headers, row)
  };
}

function normalizeRowForPreview(row, clientes) {
  const cliente = findClienteByCode(clientes, row.clienteCodigo);
  return {
    ...row,
    pedido: row.numero,
    cliente: row.clienteCodigo,
    clienteId: cliente?.id || null,
    clienteEncontrado: Boolean(cliente),
    statusImportacao: cliente ? 'ok' : 'CLIENTE_NAO_ENCONTRADO',
    erros: cliente ? [] : ['CLIENTE_NAO_ENCONTRADO']
  };
}

async function createPedidoImportRecord(row, accountId) {
  try {
    const result = await createPedidoFromImport({
      cliente_id: row.clienteId,
      numero: row.numero || null,
      status: row.status || 'rascunho',
      origem: 'importacao',
      observacoes: row.observacoes || null,
      subtotal: row.subtotal ?? 0,
      desconto: row.desconto ?? 0,
      total: row.total ?? 0,
      metadata: {
        ...row.metadata,
        importacao: {
          origem: 'planilha',
          linha: row.rowNumber,
          cliente_codigo: row.clienteCodigo
        }
      }
    }, { accountId });
    return result?.pedido || null;
  } catch (error) {
    throw new DatabaseError(`Falha ao criar pedido na linha ${row.rowNumber}`, { domain: 'pedidos-import', details: { rowNumber: row.rowNumber, clienteCodigo: row.clienteCodigo || null, cause: error?.details || error?.message || String(error) } });
  }
}

export async function previewPedidosImport({ accountId, fileName, buffer }) {
  assertAccountId(accountId);
  const parsed = parseWorkbook(buffer);
  const clientes = await listAllClientes(accountId);
  const rows = parsed.dataRows.map((entry) => normalizeRowForPreview(buildRow(parsed.headers, entry.row, entry.rowNumber), clientes));
  const summary = {
    pedidos_criados: 0,
    pedidos_ignorados: rows.filter((row) => row.clienteEncontrado).length,
    pedidos_duplicados: 0,
    pedidos_com_erro: 0,
    pedidos_sem_cliente: rows.filter((row) => !row.clienteEncontrado).length,
    inconsistencias: rows.filter((row) => !row.clienteEncontrado).map((row) => ({ linha: row.rowNumber, pedido: row.numero, cliente: row.clienteCodigo, codigo: 'CLIENTE_NAO_ENCONTRADO', motivo: `Cliente com código ${row.clienteCodigo || ''} não encontrado no cadastro` }))
  };
  const token = randomUUID();
  sessions.set(token, { accountId, fileName, rows, createdAt: new Date().toISOString() });
  return { ok: true, importToken: token, fileName: fileName || null, sheetName: parsed.sheetName, headers: parsed.headers, summary, rows, sampleRows: rows.slice(0, 20) };
}

export async function executePedidosImport({ accountId, importToken }) {
  assertAccountId(accountId);
  const session = sessions.get(String(importToken || ''));
  if (!session || session.accountId !== accountId) throw new BadRequestError('Prévia da importação não encontrada.', { domain: 'pedidos-import', code: 'IMPORT_TOKEN_INVALID' });

  const existingClientes = await listAllClientes(accountId);
  const existingPedidoKeys = await loadExistingPedidoNumeroKeys(accountId, session.rows.map((row) => row.numero));
  const pedidosCriados = [];
  const pedidosIgnorados = [];
  const pedidosDuplicados = [];
  const pedidosComErro = [];
  const pedidosSemCliente = [];
  const inconsistencias = [];
  const impactedClientIds = new Set();

  for (const row of session.rows) {
    const cliente = findClienteByCode(existingClientes, row.clienteCodigo);
    if (!cliente) {
      pedidosSemCliente.push(row);
      inconsistencias.push({ linha: row.rowNumber, pedido: row.numero || null, cliente: row.clienteCodigo || null, codigo: 'CLIENTE_NAO_ENCONTRADO', motivo: `Cliente com código ${row.clienteCodigo || ''} não encontrado no cadastro` });
      continue;
    }
    const duplicateKey = `${accountId}::${normalizeNumeroKey(row.numero)}`;
    if (row.numero && existingPedidoKeys.has(duplicateKey)) {
      pedidosDuplicados.push(row);
      inconsistencias.push({ linha: row.rowNumber, codigo: 'PEDIDO_DUPLICADO_EXISTENTE', numero: row.numero || null });
      continue;
    }
    try {
      const pedido = await createPedidoImportRecord({ ...row, clienteId: cliente.id }, accountId);
      pedidosCriados.push(pedido);
      impactedClientIds.add(cliente.id);
      if (row.numero) existingPedidoKeys.add(duplicateKey);
    } catch (error) {
      pedidosComErro.push({ ...row, error: error?.message || String(error) });
    }
  }

  if (impactedClientIds.size > 0) {
    await recalculateClientsCommercialHistory([...impactedClientIds], { accountId });
  }

  const summary = {
    pedidos_criados: pedidosCriados.length,
    pedidos_ignorados: pedidosIgnorados.length,
    pedidos_duplicados: pedidosDuplicados.length,
    pedidos_com_erro: pedidosComErro.length,
    pedidos_sem_cliente: pedidosSemCliente.length,
    inconsistencias
  };

  return {
    ok: true,
    pedidos_criados: pedidosCriados,
    pedidos_ignorados: pedidosIgnorados,
    pedidos_duplicados: pedidosDuplicados,
    pedidos_com_erro: pedidosComErro,
    pedidos_sem_cliente: pedidosSemCliente,
    inconsistencias,
    summary
  };
}

export function __resetPedidosImportSessionsForTests() {
  sessions.clear();
}
