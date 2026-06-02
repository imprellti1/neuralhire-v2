import { ValidationError } from '../../core/errors.js';
import { supportedEntities } from './legacy-import.schemas.js';

function cleanText(value) {
  return String(value ?? '').trim();
}

function digitsOnly(value) {
  return cleanText(value).replace(/\D+/g, '');
}

function normalizeUf(value) {
  const uf = cleanText(value).toUpperCase();
  return uf.length === 2 ? uf : '';
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = Number(String(value).replace(',', '.'));
  return Number.isNaN(normalized) ? null : normalized;
}

function normalizeStatus(value, fallback = 'ativo') {
  const text = cleanText(value).toLowerCase();
  if (['inativo', 'inactive', 'false', '0', 'off', 'bloqueado'].includes(text)) return 'inativo';
  return text ? 'ativo' : fallback;
}

function normalizeNaturalKey(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, ' ');
}

function pushIssue(issues, entity, index, field, code, message) {
  issues.push({ entity, index, field, code, message });
}

function normalizeCliente(item, index, issues) {
  const nome = cleanText(item.nome) || cleanText(item.empresa) || cleanText(item.razao_social);
  const empresa = cleanText(item.empresa) || cleanText(item.razao_social) || nome;
  const razao_social = cleanText(item.razao_social) || empresa;
  const cnpj = digitsOnly(item.cnpj);
  const telefone = cleanText(item.telefone) || cleanText(item.celular) || cleanText(item.whatsapp);
  const email = cleanText(item.email);
  const cidade = cleanText(item.cidade);
  const uf = normalizeUf(item.uf || item.estado);
  const vendedor_id = cleanText(item.vendedor_id) || cleanText(item.vendedor);
  const codigo_cliente_fabricante = cleanText(item.codigo_cliente_fabricante);
  const status_comercial = normalizeStatus(item.status_comercial, 'ativo');
  const ultimo_pedido_em = parseDate(item.ultimo_pedido_em);

  if (!nome && !empresa) pushIssue(issues, 'clientes', index, 'nome', 'REQUIRED', 'Nome ou empresa obrigatorio');
  if (item.cnpj && !cnpj) pushIssue(issues, 'clientes', index, 'cnpj', 'INVALID', 'CNPJ deve conter apenas numeros');
  if (item.uf && !uf) pushIssue(issues, 'clientes', index, 'uf', 'INVALID', 'UF deve ter 2 letras');

  return { normalized: { nome, empresa, razao_social, cnpj, telefone, email, cidade, uf, vendedor_id, codigo_cliente_fabricante, status_comercial, ultimo_pedido_em }, keyParts: [cnpj || '', codigo_cliente_fabricante || '', normalizeNaturalKey(nome || empresa)] };
}

function normalizeProduto(item, index, issues) {
  const nome = cleanText(item.nome);
  const descricao = cleanText(item.descricao);
  const sku = cleanText(item.sku || item.codigo);
  const categoria = cleanText(item.categoria);
  const preco = parseNumber(item.preco ?? item.preco_unitario);
  const preco_unitario = parseNumber(item.preco_unitario ?? item.preco);
  const status = normalizeStatus(item.status, item.ativo);
  const ativo = status !== 'inativo';
  const fabricante_id = cleanText(item.fabricante_id || item.fabricante);

  if (!nome) pushIssue(issues, 'produtos', index, 'nome', 'REQUIRED', 'Nome obrigatorio');
  if (item.preco !== undefined || item.preco_unitario !== undefined) {
    const price = preco ?? preco_unitario;
    if (price === null || price < 0) pushIssue(issues, 'produtos', index, 'preco', 'INVALID', 'Preco deve ser maior ou igual a zero');
  }

  return { normalized: { nome, descricao, sku, categoria, preco, preco_unitario, status, ativo, fabricante_id }, keyParts: [sku || '', cleanText(item.codigo || item.referencia), normalizeNaturalKey(nome)] };
}

function normalizePedido(item, index, issues) {
  const numero = cleanText(item.numero || item.numero_erp || item.numero_pedido || item.id);
  const cliente_id = cleanText(item.cliente_id || item.cliente_codigo);
  const codigo_cliente_fabricante = cleanText(item.codigo_cliente_fabricante);
  const data_emissao = parseDate(item.data_emissao);
  const data_faturamento = parseDate(item.data_faturamento);
  const status = normalizeStatus(item.status || item.situacao, 'ativo');
  const valor_total = parseNumber(item.valor_total ?? item.total);
  const vendedor_id = cleanText(item.vendedor_id || item.representante_id);
  const fabricante_id = cleanText(item.fabricante_id);

  if (!numero) pushIssue(issues, 'pedidos', index, 'numero', 'REQUIRED', 'Numero ou id legado obrigatorio');
  if (valor_total !== null && valor_total < 0) pushIssue(issues, 'pedidos', index, 'valor_total', 'INVALID', 'Valor total deve ser maior ou igual a zero');
  if ((item.data_emissao && !data_emissao) || (item.data_faturamento && !data_faturamento)) pushIssue(issues, 'pedidos', index, 'data_emissao', 'INVALID', 'Data deve estar em formato ISO quando possivel');

  return { normalized: { numero, cliente_id, codigo_cliente_fabricante, data_emissao, data_faturamento, status, valor_total, vendedor_id, fabricante_id }, keyParts: [numero || '', cleanText(item.numero_erp), cleanText(item.numero_pedido)] };
}

function normalizePedidoItem(item, index, issues) {
  const pedido_id = cleanText(item.pedido_id);
  const numero_pedido = cleanText(item.numero_pedido || item.numero_erp);
  const produto_id = cleanText(item.produto_id);
  const sku = cleanText(item.sku || item.codigo_produto);
  const descricao = cleanText(item.descricao);
  const quantidade = parseNumber(item.quantidade);
  const preco_unitario = parseNumber(item.preco_unitario ?? item.valor_unitario);
  const total = parseNumber(item.total ?? item.valor_total);

  if (!pedido_id && !numero_pedido) pushIssue(issues, 'pedidoItens', index, 'pedido_id', 'REQUIRED', 'Pedido_id ou numero_pedido obrigatorio');
  if (!produto_id && !sku) pushIssue(issues, 'pedidoItens', index, 'produto_id', 'REQUIRED', 'Produto_id ou sku obrigatorio');
  if (quantidade === null || quantidade <= 0) pushIssue(issues, 'pedidoItens', index, 'quantidade', 'INVALID', 'Quantidade deve ser maior que zero');
  if (preco_unitario !== null && preco_unitario < 0) pushIssue(issues, 'pedidoItens', index, 'preco_unitario', 'INVALID', 'Preco deve ser maior ou igual a zero');

  return { normalized: { pedido_id, numero_pedido, produto_id, sku, descricao, quantidade, preco_unitario, total }, keyParts: [numero_pedido || '', sku || '', pedido_id || '', produto_id || ''] };
}

function normalizeFabricante(item, index, issues) {
  const nome = cleanText(item.nome);
  const razao_social = cleanText(item.razao_social) || nome;
  const cnpj = digitsOnly(item.cnpj);
  const status = normalizeStatus(item.status, item.ativo);
  const ativo = status !== 'inativo';
  if (!nome && !razao_social) pushIssue(issues, 'fabricantes', index, 'nome', 'REQUIRED', 'Nome ou razao social obrigatorio');
  return { normalized: { nome, razao_social, cnpj, status, ativo }, keyParts: [cnpj || '', normalizeNaturalKey(nome || razao_social)] };
}

function normalizeVendedor(item, index, issues) {
  const nome = cleanText(item.nome);
  const email = cleanText(item.email).toLowerCase();
  const telefone = cleanText(item.telefone);
  const status = normalizeStatus(item.status, item.ativo);
  const ativo = status !== 'inativo';
  if (!nome) pushIssue(issues, 'vendedores', index, 'nome', 'REQUIRED', 'Nome obrigatorio');
  return { normalized: { nome, email, telefone, status, ativo }, keyParts: [email || '', normalizeNaturalKey(nome)] };
}

const entityNormalizers = { clientes: normalizeCliente, produtos: normalizeProduto, pedidos: normalizePedido, pedidoItens: normalizePedidoItem, fabricantes: normalizeFabricante, vendedores: normalizeVendedor };

export function validateAndNormalizeLegacyPayload(payload = {}) {
  const issues = [];
  const data = payload?.data && typeof payload.data === 'object' ? payload.data : {};
  const normalized = {};
  const duplicates = {};

  for (const entity of supportedEntities) {
    const items = Array.isArray(data[entity]) ? data[entity] : [];
    const seen = new Set();
    normalized[entity] = [];
    duplicates[entity] = 0;

    items.forEach((item, index) => {
      const result = entityNormalizers[entity](item || {}, index, issues);
      const key = result.keyParts.map((part) => cleanText(part)).filter(Boolean).join('|') || JSON.stringify(result.normalized);
      if (seen.has(key)) {
        duplicates[entity] += 1;
        pushIssue(issues, entity, index, '_dedupe', 'DUPLICATE', 'Registro duplicado detectado');
      } else {
        seen.add(key);
      }
      normalized[entity].push(result.normalized);
    });
  }

  return { issues, normalized, duplicates };
}

export function ensureLegacyImportPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ValidationError('Payload invalido', { details: [{ field: 'payload', message: 'Payload invalido' }], domain: 'legacy-import' });
  }
  return payload;
}
