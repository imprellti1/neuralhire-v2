import { randomUUID } from 'node:crypto';
import xlsx from 'xlsx';
import { BadRequestError, DatabaseError } from '../../core/errors.js';
import { getClientesRepositoryMode, listClientes, createCliente, updateCliente } from '../clientes/clientes.repository.js';

const importSessions = new Map();

const HEADERS = {
  codigo: ['Código', 'Codigo', 'Cliente'],
  cnpj: ['CNPJ'],
  razaoSocial: ['Razão Social', 'Razao Social'],
  fantasia: ['Fantasia'],
  situacao: ['Situação', 'Situacao'],
  limiteCredito: ['Limite de Crédito', 'Limite de Credito'],
  limiteCreditoDisponivel: ['Limite de Crédito Disponível', 'Limite de Credito Disponivel'],
  cidade: ['Cidade'],
  bairro: ['Bairro'],
  uf: ['UF']
};

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeDigits(value) {
  return String(value ?? '').replace(/\D+/g, '');
}

function normalizeUf(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const raw = String(value).trim().replace(/\s+/g, '').replace(/^R\$/i, '').replace(/\./g, '').replace(/,/g, '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSituacao(value) {
  const situacao = normalizeText(value);
  const key = situacao.toLowerCase();
  if (key === 'ativo') return { ativo: true, original: situacao || null };
  if (key === 'inativo') return { ativo: false, original: situacao || null };
  return { ativo: true, original: situacao || null };
}

function pickHeaderIndex(headers, candidates) {
  const normalized = headers.map((header) => normalizeText(header).toLowerCase());
  for (const candidate of candidates) {
    const idx = normalized.indexOf(normalizeText(candidate).toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseWorkbook(buffer) {
  if (!buffer) throw new BadRequestError('Arquivo XLSX obrigatorio', { domain: 'clientes-import', code: 'INVALID_XLSX' });
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer', cellDates: false, raw: false });
  } catch (error) {
    throw new BadRequestError('Nao foi possivel ler a planilha.', { domain: 'clientes-import', code: 'INVALID_XLSX', details: { cause: error?.message || String(error) } });
  }
  const sheetName = workbook.SheetNames.find((name) => {
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', blankrows: false });
    return rows.some((row) => row.some((cell) => String(cell ?? '').trim()));
  });
  if (!sheetName) throw new BadRequestError('Nenhuma aba com dados foi encontrada.', { domain: 'clientes-import', code: 'NO_SHEET_WITH_DATA' });
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false });
  const headers = rows[0].map((cell) => String(cell ?? '').trim());
  const dataRows = rows.slice(1).map((row, index) => ({ rowNumber: index + 2, row })).filter((entry) => entry.row.some((cell) => String(cell ?? '').trim()));
  return { workbook, sheetName, headers, dataRows };
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

function normalizeValue(value) {
  return String(value ?? '').trim();
}

function findExistingByDocumento(clients, documento) {
  const normalized = normalizeDigits(documento);
  return clients.find((cliente) => normalizeDigits(cliente.documento) === normalized) || null;
}

function buildMetadata(row) {
  const metadata = {
    origem_importacao: 'clientes_fabrica'
  };
  if (row.fantasia) metadata.nome_fantasia = row.fantasia;
  if (row.situacaoOriginal) metadata.situacao_original = row.situacaoOriginal;
  if (row.limiteCredito !== null) metadata.limite_credito = row.limiteCredito;
  if (row.limiteCreditoDisponivel !== null) metadata.limite_credito_disponivel = row.limiteCreditoDisponivel;
  if (row.bairro) metadata.bairro = row.bairro;
  return metadata;
}

function normalizeImportMetadata(metadata) {
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
}

function normalizeImportTags(tags) {
  return Array.isArray(tags) ? tags : [];
}

function buildImportPayload(row) {
  return {
    account_id: row.accountId,
    nome: normalizeText(row.razaoSocial),
    codigo: normalizeValue(row.codigo) || null,
    documento: row.cnpj || null,
    cidade: row.cidade || null,
    estado: row.uf || null,
    ativo: typeof row.ativo === 'boolean' ? row.ativo : true,
    metadata: normalizeImportMetadata(row.metadata),
    tags: normalizeImportTags(row.tags)
  };
}

function extractErrorMessage(error) {
  const candidates = [
    error?.details?.message,
    error?.details?.error?.message,
    error?.details?.cause,
    error?.details?.hint,
    error?.details?.code,
    error?.message
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim()) || null;
}

function buildRowFromSheet(headers, row, rowNumber) {
  const get = (name) => {
    const index = pickHeaderIndex(headers, HEADERS[name]);
    return index >= 0 ? row[index] : '';
  };
  const razaoSocial = normalizeText(get('razaoSocial'));
  const cnpj = normalizeDigits(get('cnpj'));
  const codigo = normalizeText(get('codigo'));
  const cidade = normalizeText(get('cidade'));
  const uf = normalizeUf(get('uf'));
  const fantasia = normalizeText(get('fantasia'));
  const bairro = normalizeText(get('bairro'));
  const limiteCredito = normalizeMoney(get('limiteCredito'));
  const limiteCreditoDisponivel = normalizeMoney(get('limiteCreditoDisponivel'));
  const situacao = normalizeSituacao(get('situacao'));
  return {
    rowNumber,
    codigo,
    cnpj,
    razaoSocial,
    fantasia,
    cidade,
    bairro,
    uf,
    limiteCredito,
    limiteCreditoDisponivel,
    ativo: situacao.ativo,
    situacaoOriginal: situacao.original,
    ignored: {
      tempoSemCompra: row[pickHeaderIndex(headers, ['Tempo sem compra'])] ?? null,
      painelCliente: row[pickHeaderIndex(headers, ['Painel do Cliente'])] ?? null
    }
  };
}

function classifyRow(row, existingClientes, seenDocumento) {
  const errors = [];
  if (!row.cnpj) errors.push('CNPJ ausente.');
  if (row.cnpj && row.cnpj.length !== 14) errors.push('CNPJ inválido.');
  if (!row.cnpj || row.cnpj.length !== 14) {
    return { status: 'invalido', errors };
  }
  if (seenDocumento.has(row.cnpj) || findExistingByDocumento(existingClientes, row.cnpj)) {
    return { status: 'existente', errors: [] };
  }
  seenDocumento.add(row.cnpj);
  return { status: 'novo', errors: [] };
}

function buildPreviewRows(workbookRows, existingClientes) {
  const seenDocumento = new Set();
  const rows = [];
  const summary = { novos: 0, existentes: 0, invalidos: 0 };

  for (const entry of workbookRows) {
    const row = buildRowFromSheet(entry.headers, entry.row, entry.rowNumber);
    const classification = classifyRow(row, existingClientes, seenDocumento);
    if (classification.status === 'novo') summary.novos += 1;
    else if (classification.status === 'existente') summary.existentes += 1;
    else if (classification.status === 'invalido') summary.invalidos += 1;
    rows.push({
      ...row,
      status: classification.status,
      ativoLabel: row.ativo ? 'Sim' : 'Não',
      errors: classification.errors,
      metadata: buildMetadata(row)
    });
  }
  return { rows, summary };
}

export async function previewClientesImport({ accountId, fileName, buffer }) {
  if (!accountId) throw new BadRequestError('Contexto de tenant obrigatorio', { domain: 'clientes-import', code: 'TENANT_REQUIRED' });
  const workbook = parseWorkbook(buffer);
  const existingClientes = await listAllClientes(accountId);
  const workbookRows = workbook.dataRows.map((entry) => ({ ...entry, headers: workbook.headers }));
  const preview = buildPreviewRows(workbookRows, existingClientes);
  const token = randomUUID();
  importSessions.set(token, { accountId, fileName, rows: preview.rows, createdAt: new Date().toISOString() });
  return { ok: true, importToken: token, fileName: fileName || null, sheetName: workbook.sheetName, headers: workbook.headers, summary: preview.summary, rows: preview.rows, amostra: preview.rows.slice(0, 20) };
}

export async function executeClientesImport({ accountId, importToken }) {
  if (!accountId) throw new BadRequestError('Contexto de tenant obrigatorio', { domain: 'clientes-import', code: 'TENANT_REQUIRED' });
  const session = importSessions.get(String(importToken || ''));
  if (!session || session.accountId !== accountId) {
    throw new BadRequestError('Prévia da importação não encontrada.', { domain: 'clientes-import', code: 'IMPORT_TOKEN_INVALID' });
  }
  const existingClientes = await listAllClientes(accountId);
  const existingByDocumento = new Map(existingClientes.map((cliente) => [normalizeDigits(cliente.documento), cliente]).filter(([key]) => Boolean(key)));
  const inserted = [];
  const updated = [];
  const invalidos = [];

  for (const row of session.rows) {
    if (row.status === 'invalido') {
      invalidos.push(row);
      continue;
    }
    try {
      const current = existingByDocumento.get(row.cnpj) || null;
      if (current) {
        const updatedCliente = await updateCliente(current.id, { codigo: normalizeValue(row.codigo) || null }, { accountId });
        updated.push({ id: updatedCliente.id, nome: updatedCliente.nome, documento: updatedCliente.documento, codigo: updatedCliente.codigo ?? null });
        existingByDocumento.set(row.cnpj, updatedCliente);
        continue;
      }
      const created = await createCliente(buildImportPayload({ ...row, accountId }), { accountId });
      inserted.push({ id: created.id, nome: created.nome, documento: created.documento, codigo: created.codigo ?? null });
      existingByDocumento.set(row.cnpj, created);
    } catch (error) {
      const motivo = extractErrorMessage(error);
      throw new DatabaseError(`Falha ao criar cliente no repository na linha ${row.rowNumber}${motivo ? `: ${motivo}` : ''}`, {
        domain: 'clientes-import',
        details: {
          rowNumber: row.rowNumber,
          codigo: row.codigo || null,
          cnpj: row.cnpj || null,
          nome: row.razaoSocial || null,
          repository: 'clientes.repository',
          motivo: motivo || 'erro_desconhecido',
          cause: error?.details || error?.message || String(error)
        }
      });
    }
  }

  return {
    ok: true,
    inserted,
    updated,
    invalidos,
    summary: {
      inserted: inserted.length,
      updated: updated.length,
      invalidRows: invalidos.length
    }
  };
}

export function __resetClientesImportSessionsForTests() {
  importSessions.clear();
}

export function __getClientesImportSessionForTests(token) {
  return importSessions.get(token) || null;
}

export function __normalizeClientesImportMoneyForTests(value) {
  return normalizeMoney(value);
}

export function __normalizeClientesImportDigitsForTests(value) {
  return normalizeDigits(value);
}
