import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pageFile = path.join(__dirname, 'produto-details.page.js');
const source = fs.readFileSync(pageFile, 'utf8');

function has(fragment) {
  return source.includes(fragment);
}

function run() {
  assert.equal(has('id="nhpd-chart-tooltip"'), true, 'Tooltip container não encontrado');
  assert.equal(has("hit.addEventListener('mouseenter'"), true, 'Evento hover do tooltip não encontrado');
  assert.equal(has("hit.addEventListener('focus'"), true, 'Evento focus do tooltip não encontrado');
  assert.equal(has("hit.addEventListener('click'"), true, 'Evento click de drill-down não encontrado');
  assert.equal(has('id="nhpd-drill-clear"'), true, 'Botão limpar seleção não encontrado');
  assert.equal(has("usageExportLista.onclick = () => exportUsageCsv('lista')"), true, 'Fluxo CSV lista não encontrado');
  assert.equal(has("usageExportPeriodo.onclick = () => exportUsageCsv('periodo')"), true, 'Fluxo CSV período não encontrado');
  assert.equal(has("const blob = new Blob([`\\uFEFF${csv}`]"), true, 'Fluxo de exportação CSV não encontrado');
  assert.equal(has('Fábrica vinculada'), true, 'Card de fábrica vinculada não encontrado');
  assert.equal(has('nhpd-fabricante_id'), true, 'Select de fábrica não encontrado');
  assert.equal(has('Variações do Produto'), true, 'Seção de variações não encontrada');
  assert.equal(has('nhpd-variations-toggle'), true, 'Toggle de variações não encontrado');
  assert.equal(has('Estoque total (todas as variações)'), true, 'Resumo de estoque total não encontrado');
  assert.equal(has('SKU ${d.sku}'), false, 'SKU não deveria aparecer abaixo do título');
  assert.equal(has('Ativo/Inativo'), false, 'Status duplicado não deveria existir');
  assert.equal(has('Pendências de Auditoria'), true, 'Card de auditoria não encontrado');
}

run();
console.log('produto-details.page.contract.test.js: OK');
