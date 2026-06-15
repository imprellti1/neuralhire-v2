import { randomUUID } from 'node:crypto';
import xlsx from 'xlsx';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { listClientes, recalculateClientsCommercialHistory } from '../clientes/clientes.repository.js';
import { getPedidosRepositoryMode } from '../pedidos/pedidos.repository.js';
import { createPedidoFromImport } from '../pedidos/pedidos.repository.js';
import { getSupabaseClient } from '../../database/supabase.client.js';

const sessions = new Map();
const IGNORED_COLUMNS = new Set(['lote gravacao', 'data prev fatur', 'razao social', 'qt pecas', 'valor total', 'valor do pedido', 'valor cancelado', 'origem', 'duplicar', 'imprimir']);
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
  const text = normalizeText(value);
  if (!text) return '';
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized
    .replace(/Ã¡|á/g, 'a')
    .replace(/Ã©|é/g, 'e')
    .replace(/Ã­|í/g, 'i')
    .replace(/Ã³|ó/g, 'o')
    .replace(/Ãº|ú/g, 'u')
    .replace(/Ã£|ã/g, 'a')
    .replace(/Ãµ|õ/g, 'o')
    .replace(/Ã§|ç/g, 'c')
    .replace(/â€™/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function pickHeaderIndex(headers, names) {
  const normalized = headers.map((header) => normalizeHeader(header));
  const compact = normalized.map((value) => value.replace(/\s+/g, ''));
  for (const name of names) {
    const target = normalizeHeader(name);
    const idx = normalized.indexOf(target);
    if (idx >= 0) return idx;
    const compactIdx = compact.indexOf(target.replace(/\s+/g, ''));
    if (compactIdx >= 0) return compactIdx;
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

function toIsoDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseBrDateText(value) {
  const text = normalizeText(value);
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? Number(`20${y}`) : Number(y);
  const day = Number(d);
  const month = Number(m);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeSnakeCase(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseExcelDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return toIsoDateOnly(value);
  if (typeof value === 'number') {
    const parsed = xlsx.SSF?.parse_date_code ? xlsx.SSF.parse_date_code(value) : null;
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
      return toIsoDateOnly(date);
    }
    const fallback = new Date(Math.round((value - 25569) * 86400 * 1000));
    return toIsoDateOnly(fallback);
  }
  const text = normalizeText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return parseBrDateText(text);
}

function normalizeSituacaoPedido(value) {
  const raw = normalizeText(value);
  if (!raw) return { status: 'rascunho', original: null };
  const mapped = {
    'faturado total': 'faturado_total',
    'faturado parcial': 'faturado_parcial',
    cancelado: 'cancelado',
    rejeitado: 'rejeitado',
    estornado: 'estornado'
  };
  const normalizedKey = normalizeHeader(raw);
  return { status: mapped[normalizedKey] || normalizeSnakeCase(raw) || 'rascunho', original: raw };
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
  if (!targetNumeros.length) return new Map();

  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data, error } = await supabase.from('pedidos').select('numero, data_emissao').eq('account_id', accountId).in('numero', targetNumeros);
    if (error) throw new DatabaseError('Falha ao consultar pedidos existentes', { details: error });
    return new Map((data || []).map((pedido) => [`${accountId}::${normalizeNumeroKey(pedido?.numero)}`, { numero: normalizeNumeroKey(pedido?.numero), data_emissao: pedido?.data_emissao || null }]).filter(([key]) => key !== `${accountId}::`));
  }

  const { __dumpMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  return new Map((snapshot.pedidos || []).filter((pedido) => pedido.account_id === accountId).map((pedido) => [`${accountId}::${normalizeNumeroKey(pedido?.numero)}`, { numero: normalizeNumeroKey(pedido?.numero), data_emissao: pedido?.data_emissao || null }]).filter(([key]) => key !== `${accountId}::`));
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
  const get = (...names) => {
    const idx = pickHeaderIndex(headers, names.flat());
    return idx >= 0 ? row[idx] : '';
  };
  const situacao = normalizeSituacaoPedido(get('Situação', 'Situacao', 'Status'));
  return {
    rowNumber,
    numero: normalizeText(get('Número ERP', 'Numero ERP', 'NÃºmero ERP', 'Número', 'Numero', 'Pedido')),
    clienteCodigo: normalizeText(get('Cliente')),
    status: situacao.status,
    situacaoOriginal: situacao.original,
    dataEmissaoRaw: get('Data Emissão', 'Data Emissao', 'Data de Emissão', 'Data de Emissao', 'Data Emissão ERP'),
    dataEmissao: parseExcelDate(get('Data Emissão', 'Data Emissao', 'Data de Emissão', 'Data de Emissao', 'Data Emissão ERP')),
    observacoes: normalizeText(get('Observações', 'Observacoes')) || null,
    total: parseMoney(get('Valor Total', 'Valor do pedido', 'Valor Cancelado')),
    metadata: {
      lote_gravacao: get('Lote Gravação', 'Lote Gravacao', 'Lote GravaÃ§Ã£o') || null,
      qt_pecas: get('Qt. Peças', 'Qt. Pecas', 'Qt. PeÃ§as') || null,
      valor_total_original: get('Valor Total') || null,
      origem_planilha: get('Origem') || null,
      duplicar: get('Duplicar') || null,
      imprimir: get('Imprimir') || null,
      situacao_original: situacao.original
    },
    ignored: buildIgnoredValues(headers, row)
  };
}

function normalizeRowForPreview(row, clientes) {
  const cliente = findClienteByCode(clientes, row.clienteCodigo);
  return {
    ...row,
    data_emissao_preview: row.dataEmissao || null,
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
      total: row.total ?? 0,
      data_emissao: row.dataEmissao || null,
      metadata: {
        ...row.metadata,
        situacao_original: row.situacaoOriginal || null,
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

async function updatePedidoImportRecord(row, accountId) {
  const repositoryMode = getPedidosRepositoryMode();
  if (repositoryMode.mode === 'supabase') {
    const supabase = getSupabaseClient();
    if (!supabase) throw new DatabaseError('Supabase indisponivel');
    const { data: existing, error: fetchError } = await supabase.from('pedidos').select('id, data_emissao').eq('account_id', accountId).eq('numero', row.numero).maybeSingle();
    if (fetchError) throw new DatabaseError(`Falha ao consultar pedido na linha ${row.rowNumber}`, { domain: 'pedidos-import', details: { rowNumber: row.rowNumber, clienteCodigo: row.clienteCodigo || null, cause: fetchError?.details || fetchError?.message || String(fetchError) } });
    const nextPayload = { total: row.total ?? 0 };
    if (!existing?.data_emissao && row.dataEmissao) nextPayload.data_emissao = row.dataEmissao;
    const { data: updated, error } = await supabase.from('pedidos').update(nextPayload).eq('account_id', accountId).eq('numero', row.numero).select('*').single();
    if (error) throw new DatabaseError(`Falha ao atualizar pedido na linha ${row.rowNumber}`, { domain: 'pedidos-import', details: { rowNumber: row.rowNumber, clienteCodigo: row.clienteCodigo || null, cause: error?.details || error?.message || String(error) } });
    return updated || null;
  }

  const { __dumpMemoryPedidos, __loadMemoryPedidos } = await import('../pedidos/pedidos.repository.js');
  const snapshot = __dumpMemoryPedidos();
  const idx = (snapshot.pedidos || []).findIndex((pedido) => pedido.account_id === accountId && normalizeNumeroKey(pedido.numero) === normalizeNumeroKey(row.numero));
  if (idx < 0) return null;
  const existing = snapshot.pedidos[idx];
  snapshot.pedidos[idx] = {
    ...existing,
    total: row.total ?? 0,
    data_emissao: !existing?.data_emissao && row.dataEmissao ? row.dataEmissao : existing?.data_emissao || null
  };
  __loadMemoryPedidos(snapshot);
  return snapshot.pedidos[idx];
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
  const pedidosAtualizados = [];
  const pedidosIgnorados = [];
  const pedidosDuplicados = [];
  const pedidosComErro = [];
  const pedidosSemCliente = [];
  const inconsistencias = [];
  const impactedClientIds = new Set();
  let pedidosComDataEmissaoLida = 0;
  let pedidosDataEmissaoAtualizada = 0;
  let pedidosDataEmissaoIgnoradasExistentes = 0;
  let pedidosDataEmissaoInvalidas = 0;

  for (const row of session.rows) {
    const dataEmissaoValida = row.dataEmissao || null;
    const dataEmissaoInformada = String(row.dataEmissaoRaw || '').trim();
    if (dataEmissaoInformada) pedidosComDataEmissaoLida += 1;
    const cliente = findClienteByCode(existingClientes, row.clienteCodigo);
    if (!cliente) {
      pedidosSemCliente.push(row);
      inconsistencias.push({ linha: row.rowNumber, pedido: row.numero || null, cliente: row.clienteCodigo || null, codigo: 'CLIENTE_NAO_ENCONTRADO', motivo: `Cliente com código ${row.clienteCodigo || ''} não encontrado no cadastro` });
      continue;
    }
    const duplicateKey = `${accountId}::${normalizeNumeroKey(row.numero)}`;
    const existingPedido = existingPedidoKeys.get(duplicateKey) || null;
    if (row.numero && existingPedido) {
      try {
        const pedidoAtualizado = await updatePedidoImportRecord(row, accountId);
        if (pedidoAtualizado) {
          pedidosAtualizados.push(pedidoAtualizado);
          if (dataEmissaoValida && !existingPedido.data_emissao) pedidosDataEmissaoAtualizada += 1;
          if (dataEmissaoValida && existingPedido.data_emissao) pedidosDataEmissaoIgnoradasExistentes += 1;
          if (dataEmissaoInformada && !dataEmissaoValida) pedidosDataEmissaoInvalidas += 1;
          existingPedidoKeys.set(duplicateKey, { numero: row.numero, data_emissao: pedidoAtualizado?.data_emissao || existingPedido.data_emissao || null });
          continue;
        }
      } catch (error) {
        pedidosComErro.push({ ...row, error: error?.message || String(error) });
        continue;
      }
      pedidosDuplicados.push(row);
      inconsistencias.push({ linha: row.rowNumber, codigo: 'PEDIDO_DUPLICADO_EXISTENTE', numero: row.numero || null });
      continue;
    }
    try {
      const pedido = await createPedidoImportRecord({ ...row, clienteId: cliente.id }, accountId);
      pedidosCriados.push(pedido);
      impactedClientIds.add(cliente.id);
      if (row.numero) {
          existingPedidoKeys.set(duplicateKey, { numero: row.numero, data_emissao: row.dataEmissao || null });
        }
      } catch (error) {
        pedidosComErro.push({ ...row, error: error?.message || String(error) });
      }
    }

  if (impactedClientIds.size > 0) {
    try {
      const recalcResults = await recalculateClientsCommercialHistory([...impactedClientIds], { accountId });
      if (Array.isArray(recalcResults?.warnings) && recalcResults.warnings.length) {
        inconsistencias.push(...recalcResults.warnings.map((item) => ({
          codigo: 'HISTORICO_COMERCIAL_NAO_RECALCULADO',
          cliente: item.clienteId,
          motivo: item.error
        })));
      }
    } catch (error) {
      inconsistencias.push({
        codigo: 'HISTORICO_COMERCIAL_NAO_RECALCULADO',
        motivo: error?.message || String(error)
      });
    }
  }

  const summary = {
    pedidos_criados: pedidosCriados.length,
    pedidos_atualizados: pedidosAtualizados.length,
    pedidos_ignorados: pedidosIgnorados.length,
    pedidos_duplicados: pedidosDuplicados.length,
    pedidos_com_erro: pedidosComErro.length,
    pedidos_sem_cliente: pedidosSemCliente.length,
    pedidos_com_data_emissao_lida: pedidosComDataEmissaoLida,
    pedidos_data_emissao_atualizada: pedidosDataEmissaoAtualizada,
    pedidos_data_emissao_ignoradas_existentes: pedidosDataEmissaoIgnoradasExistentes,
    pedidos_data_emissao_invalidas: pedidosDataEmissaoInvalidas,
    inconsistencias
  };

  return {
    ok: true,
    pedidos_criados: pedidosCriados,
    pedidos_atualizados: pedidosAtualizados,
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
