import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BadRequestError, DatabaseError, ForbiddenError } from '../../core/errors.js';
import { getSupabaseClient, isSupabaseConfigured } from '../../database/supabase.client.js';
import { getFabricanteById } from '../fabricantes/fabricantes.repository.js';

const memoryBatches = [];
const memoryStocks = [];

function assertAccountId(accountId) {
  if (!accountId) throw new ForbiddenError('Contexto de tenant obrigatorio', { code: 'TENANT_REQUIRED', domain: 'produtos-import' });
}

function mode() {
  return isSupabaseConfigured() ? 'supabase' : 'memory';
}

function toQuantity(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function splitDescricaoProduto(descricao = '') {
  const raw = String(descricao || '').trim();
  const parts = raw.split(' - ').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const codigo = parts[0];
  const variacao = parts.length >= 3 ? parts.slice(2).join(' - ') : '';
  const nome = parts.length >= 3 ? parts[1] : parts[parts.length - 1];
  return { codigo_erp: codigo, nome_produto: nome, variacao_nome: variacao || null };
}

export function parseXlsxAgGridBuffer(buffer) {
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'nh-produtos-'));
  const xlsxPath = path.join(tmpDir, 'import.xlsx');
  console.log('[produtos-import][xlsx] buffer info', {
    size: buffer?.length ?? 0,
    firstBytesHex: Buffer.isBuffer(buffer) ? buffer.subarray(0, 32).toString('hex') : null
  });
  writeFileSync(xlsxPath, buffer);
  const script = String.raw`
import json, sys, zipfile, xml.etree.ElementTree as ET

path = sys.argv[1]
with zipfile.ZipFile(path) as z:
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ns = {'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', 'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}
    sheet_names = [sheet.attrib.get('name') for sheet in wb.findall('.//a:sheets/a:sheet', ns)]
    print(json.dumps({'sheetNames': sheet_names}))
    sheet_target = None
    for sheet in wb.findall('.//a:sheets/a:sheet', ns):
        if sheet.attrib.get('name') == 'ag-grid':
            sheet_target = rel_map.get(sheet.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'))
            break
    if not sheet_target:
        print(json.dumps({'error': 'SHEET_NOT_FOUND'}))
        sys.exit(0)
    if not sheet_target.startswith('xl/'):
        sheet_target = 'xl/' + sheet_target.lstrip('/')
    shared = []
    try:
        sst = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in sst.findall('.//a:si', ns):
            shared.append(''.join(t.text or '' for t in si.findall('.//a:t', ns)))
    except KeyError:
        pass
    sheet = ET.fromstring(z.read(sheet_target))
    rows = []
    for row in sheet.findall('.//a:sheetData/a:row', ns):
        values = {}
        for c in row.findall('a:c', ns):
            ref = c.attrib.get('r', '')
            col = ''.join(ch for ch in ref if ch.isalpha())
            t = c.attrib.get('t')
            v = c.find('a:v', ns)
            is_node = c.find('a:is', ns)
            value = ''
            if t == 's' and v is not None:
                idx = int(v.text or '0')
                value = shared[idx] if idx < len(shared) else ''
            elif t == 'inlineStr' and is_node is not None:
                value = ''.join(tn.text or '' for tn in is_node.findall('.//a:t', ns))
            elif v is not None:
                value = v.text or ''
            values[col] = value
        rows.append(values)
    print(json.dumps({'rows': rows}))
`;
  const result = spawnSync('python', ['-c', script, xlsxPath], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  rmSync(tmpDir, { recursive: true, force: true });
  if (result.status !== 0) {
    console.error('[produtos-import][xlsx] leitura falhou', {
      status: result.status,
      signal: result.signal,
      stdout: result.stdout,
      stderr: result.stderr
    });
    console.error('[produtos-import][xlsx] stack completa', result.stderr || result.stdout || 'sem stack');
    throw new DatabaseError('Falha ao ler XLSX', { details: result.stderr || result.stdout });
  }
  const parsed = JSON.parse(result.stdout || '{}');
  console.log('[produtos-import][xlsx] workbook info', {
    sheetNames: parsed.sheetNames || null
  });
  if (parsed.error === 'SHEET_NOT_FOUND') throw new BadRequestError('Aba ag-grid nao encontrada', { domain: 'produtos-import' });
  return parsed.rows || [];
}

export function normalizeImportRows(rows = []) {
  if (!rows.length) return { headers: [], dataRows: [] };
  const headers = getHeaders(rows[0]);
  ensureRequiredColumns(headers);
  const dataRows = [];
  for (const row of rows.slice(1)) {
    const obj = rowToObject(headers, row);
    if (!Object.values(obj).some((v) => String(v || '').trim())) continue;
    dataRows.push(obj);
  }
  return { headers, dataRows };
}

function getHeaders(row = {}) {
  return Object.values(row).map((value) => String(value || '').trim());
}

function rowToObject(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i += 1) {
    obj[headers[i]] = row[String.fromCharCode(65 + i)] ?? '';
  }
  return obj;
}

function ensureRequiredColumns(headers) {
  const required = ['Descrição', 'P', 'M', 'G', 'GG', '35-36', '37-38', '39-40', '41-42', '43-44', 'UNI', 'Total'];
  const missing = required.filter((name) => !headers.includes(name));
  if (missing.length) throw new BadRequestError(`Colunas obrigatorias ausentes: ${missing.join(', ')}`, { domain: 'produtos-import', code: 'VALIDATION_ERROR' });
}

function buildVariationsFromRow(parsed, row) {
  const grades = ['P', 'M', 'G', 'GG', '35-36', '37-38', '39-40', '41-42', '43-44', 'UNI'];
  const variations = [];
  const totals = [];
  for (const grade of grades) {
    const quantity = toQuantity(row[grade]);
    if (quantity === null) continue;
    if (quantity < 0) continue;
    totals.push(quantity);
    if (quantity === 0) continue;
    const baseName = parsed.variacao_nome || 'PADRAO';
    const variationName = grade === 'UNI' ? baseName : `${baseName} / ${grade}`;
    variations.push({ nome: variationName, grade, quantidade: quantity });
  }
  return { variations, totalGrades: totals.reduce((sum, qty) => sum + qty, 0) };
}

async function createBatchRecord(payload, options) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('produto_import_batches').insert(payload).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar batch', { details: error });
    return data;
  }
  const item = { id: randomUUID(), ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryBatches.push(item);
  return item;
}

async function updateBatchRecord(batchId, patch = {}) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('produto_import_batches').update(patch).eq('id', batchId).select('*').single();
    if (error) throw new DatabaseError('Falha ao atualizar batch', { details: error });
    return data;
  }
  const idx = memoryBatches.findIndex((batch) => batch.id === batchId);
  if (idx < 0) return null;
  memoryBatches[idx] = { ...memoryBatches[idx], ...patch, updated_at: new Date().toISOString() };
  return memoryBatches[idx];
}

async function findBatchById(batchId) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('produto_import_batches').select('*').eq('id', batchId).maybeSingle();
    if (error) throw new DatabaseError('Falha ao buscar batch', { details: error });
    return data;
  }
  return memoryBatches.find((batch) => batch.id === batchId) || null;
}

function makeStockKey(record) {
  return [record.account_id, record.produto_id, record.variacao_id, record.fabricante_id].join('::');
}

async function upsertStockRecord(record) {
  if (mode() === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: existing, error: findError } = await supabase.from('produto_variacao_estoques').select('*').eq('account_id', record.account_id).eq('produto_id', record.produto_id).eq('variacao_id', record.variacao_id).eq('fabricante_id', record.fabricante_id).maybeSingle();
    if (findError) throw new DatabaseError('Falha ao consultar estoque', { details: findError });
    if (existing) {
      const { data, error } = await supabase.from('produto_variacao_estoques').update(record).eq('id', existing.id).select('*').single();
      if (error) throw new DatabaseError('Falha ao atualizar estoque', { details: error });
      return { row: data, created: false };
    }
    const { data, error } = await supabase.from('produto_variacao_estoques').insert(record).select('*').single();
    if (error) throw new DatabaseError('Falha ao criar estoque', { details: error });
    return { row: data, created: true };
  }
  const key = makeStockKey(record);
  const idx = memoryStocks.findIndex((stock) => makeStockKey(stock) === key);
  if (idx >= 0) {
    memoryStocks[idx] = { ...memoryStocks[idx], ...record, updated_at: new Date().toISOString() };
    return { row: memoryStocks[idx], created: false };
  }
  const row = { id: randomUUID(), ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  memoryStocks.push(row);
  return { row, created: true };
}

export async function previewImportXlsx({ accountId, fabricanteId, fileName, buffer }) {
  assertAccountId(accountId);
  const fabricante = await getFabricanteById(fabricanteId, { accountId }).catch(() => null);
  if (!fabricante) throw new BadRequestError('Fabricante invalido para o tenant', { domain: 'produtos-import' });
  const rows = parseXlsxAgGridBuffer(buffer);
  if (!rows.length) throw new BadRequestError('Planilha vazia', { domain: 'produtos-import' });
  const { headers, dataRows } = normalizeImportRows(rows);
  const items = [];
  let divergences = 0;
  for (const obj of dataRows) {
    const parsed = splitDescricaoProduto(obj['Descrição']);
    if (!parsed) continue;
    const { variations, totalGrades } = buildVariationsFromRow(parsed, obj);
    const total = toQuantity(obj.Total);
    if (total !== null && total !== totalGrades) divergences += 1;
    items.push({ ...parsed, total, totalGrades, variationsCount: variations.length, hasStock: variations.some((v) => v.quantidade > 0), raw: obj });
  }
  const batch = await createBatchRecord({ account_id: accountId, fabricante_id: fabricanteId, arquivo_nome: fileName || null, status: 'preview', total_linhas: items.length, linhas_processadas: 0, produtos_criados: 0, produtos_atualizados: 0, variacoes_criadas: 0, variacoes_atualizadas: 0, estoques_atualizados: 0, erros: divergences, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { accountId });
  return { batchId: batch.id, totalRows: items.length, divergences, sampleRows: items.slice(0, 5), headers };
}

export async function __dumpImportMemory() {
  return { batches: memoryBatches.map((x) => ({ ...x })), stocks: memoryStocks.map((x) => ({ ...x })) };
}

export async function upsertProdutoImportBatch(patch, options = {}) {
  if (!patch?.id) return null;
  return updateBatchRecord(patch.id, patch);
}

export async function getProdutoImportBatch(batchId) {
  return findBatchById(batchId);
}

export async function upsertProdutoVariacaoEstoque(record) {
  return upsertStockRecord(record);
}
