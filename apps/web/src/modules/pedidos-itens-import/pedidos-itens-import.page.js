import { withGlobalProcessing } from '../../core/global-processing.js';
import { createPedidosItensImportState } from './pedidos-itens-import.state.js';
import { buildPreviewPayload, executePedidosItensImport, extractPedidoErpFromFileName, previewPedidosItensImport } from './pedidos-itens-import.service.js';

function injectStyles() {
  if (document.getElementById('npi3-style')) return;
  const style = document.createElement('style');
  style.id = 'npi3-style';
  style.textContent = `.npi3{display:grid;gap:16px}.npi3-card{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.22);min-width:0}.npi3-title{font-size:30px;font-weight:800}.npi3-sub{color:#91a4c4;margin-top:6px}.npi3-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px;align-items:start;min-width:0}.npi3-drop{border:1.5px dashed rgba(79,140,255,.42);border-radius:18px;padding:18px;background:rgba(79,140,255,.07);display:grid;gap:12px}.npi3-drop strong{font-size:16px}.npi3-field{display:grid;gap:6px}.npi3-field input,.npi3-btn{height:40px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 12px;background:#0b1628;color:#e7eefb}.npi3-btn{background:#4f8cff;color:#fff;font-weight:700;cursor:pointer}.npi3-btn.secondary{background:#0b1628;color:#bcd0ff}.npi3-btn:disabled{opacity:.5;cursor:not-allowed}.npi3-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.npi3-kpi>div,.npi3-result-grid>div{background:rgba(255,255,255,.03);border:1px solid rgba(148,163,184,.12);border-radius:14px;padding:12px;min-width:0}.npi3-preview{display:grid;gap:0;grid-template-columns:minmax(130px,150px) minmax(220px,1fr) minmax(80px,100px) 70px 80px 110px 120px;min-width:0;max-width:100%;overflow-x:hidden}.npi3-preview-head,.npi3-preview-row{display:grid;grid-template-columns:minmax(130px,150px) minmax(220px,1fr) minmax(80px,100px) 70px 80px 110px 120px;column-gap:0;align-items:center;min-width:0;max-width:100%;box-sizing:border-box}.npi3-preview-head{padding:0 0 8px;border-bottom:1px solid rgba(148,163,184,.14)}.npi3-preview-head .npi3-cell{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#a9bbd8;font-weight:700}.npi3-preview-row{padding:10px 0;border-bottom:1px solid rgba(148,163,184,.12)}.npi3-cell{padding:0 8px;min-width:0;max-width:100%;overflow:hidden;box-sizing:border-box}.npi3-cell.erp,.npi3-cell.product,.npi3-cell.unit{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.npi3-cell.product{min-width:0}.npi3-cell.qty,.npi3-cell.status{text-align:center}.npi3-cell.qty,.npi3-cell.status,.npi3-cell.cor,.npi3-cell.tamanho,.npi3-cell.unit{white-space:nowrap}.npi3-cell.status .npi3-chip{white-space:nowrap}.npi3-product{display:block;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%}.npi3-state{padding:18px;text-align:center;color:#91a4c4}.npi3-actions{display:flex;gap:8px;flex-wrap:wrap}.npi3-error{color:#fecaca;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.22);border-radius:12px;padding:10px}.npi3-chip{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.npi3-chip.ok{background:rgba(52,211,153,.16);color:#34d399}.npi3-chip.warn{background:rgba(251,191,36,.16);color:#fbbf24}.npi3-chip.bad{background:rgba(248,113,113,.16);color:#f87171}.npi3-muted{font-size:12px;color:#91a4c4}.npi3-summary{display:grid;gap:8px}.npi3-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.npi3-result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.npi3-result-grid>div{display:grid;gap:4px;align-content:start;min-height:92px}.npi3-result-grid strong{display:block;font-size:28px;line-height:1;font-weight:800}.npi3-result-grid div div{font-size:12px;line-height:1.25;min-width:0;overflow:hidden;word-break:normal;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.npi3-reason-row{grid-column:1 / -1;width:100%;max-width:100%;box-sizing:border-box;padding:4px 0 8px}.npi3-reason-row .npi3-reason{display:block;width:100%;max-width:100%;box-sizing:border-box;border-radius:10px;padding:6px 10px;font-size:12px;line-height:1.35}.npi3-reason.warn{background:rgba(251,191,36,.12);color:#fbbf24}.npi3-reason.ok{background:rgba(52,211,153,.12);color:#34d399}.npi3-reason .npi3-reason-icon{margin-right:6px}.npi3-reason .npi3-reason-text{word-break:break-word}@media (max-width:1080px){.npi3-grid,.npi3-summary-grid,.npi3-kpi,.npi3-result-grid{grid-template-columns:1fr}.npi3-title{font-size:24px}.npi3-preview,.npi3-preview-head,.npi3-preview-row{grid-template-columns:minmax(130px,150px) minmax(220px,1fr) minmax(80px,100px) 70px 80px 110px 120px}}`;
  document.head.appendChild(style);
}

function readText(value) {
  return String(value ?? '').trim() || '-';
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function badgeClass(status) {
  if (status === 'vinculado') return 'ok';
  if (status === 'nao_encontrado') return 'warn';
  return 'bad';
}

function friendlyStatus(status) {
  if (status === 'vinculado') return 'Vinculado';
  if (status === 'nao_encontrado') return 'Não encontrado';
  if (status === 'ambiguo') return 'Ambíguo';
  return status || 'Erro';
}

function summaryCount(summary, keys) {
  for (const key of keys) {
    const value = summary?.[key];
    if (value !== undefined) return num(value);
  }
  return 0;
}

function getPreviewResumo(preview) {
  return preview?.resumo || preview?.summary || {};
}

function getPreviewItens(preview) {
  return preview?.itens || preview?.rows || [];
}

function getPreviewResumoCount(resumo, keys) {
  for (const key of keys) {
    const value = resumo?.[key];
    if (value !== undefined && value !== null) return num(value);
  }
  return 0;
}

function readPreviewResumoNumber(resumo, key, fallbackKeys = []) {
  if (resumo?.[key] !== undefined && resumo?.[key] !== null) return num(resumo[key]);
  for (const fallbackKey of fallbackKeys) {
    if (resumo?.[fallbackKey] !== undefined && resumo?.[fallbackKey] !== null) return num(resumo[fallbackKey]);
  }
  return 0;
}

function formatCurrency(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
}

function getUnitCost(row) {
  if (row?.valor_unitario !== undefined && row?.valor_unitario !== null && row?.valor_unitario !== '') {
    const direct = Number(row.valor_unitario);
    if (Number.isFinite(direct)) return direct;
  }
  const total = Number(row?.valor_total);
  const quantity = Number(row?.quantidade);
  if (Number.isFinite(total) && Number.isFinite(quantity) && quantity !== 0) return total / 100 / quantity;
  return null;
}

function renderRows(rows = []) {
  if (!rows.length) return '<div class="npi3-state">Faça o preview para visualizar os itens importados.</div>';
  return `<div class="npi3-preview" data-testid="preview-table"><div class="npi3-preview-head"><div class="npi3-cell erp">Código ERP</div><div class="npi3-cell product">Produto</div><div class="npi3-cell cor">Cor</div><div class="npi3-cell tamanho">Tamanho</div><div class="npi3-cell qty">Quantidade</div><div class="npi3-cell unit">Custo Unitário</div><div class="npi3-cell status">Status de Vínculo</div></div>${rows.map((row) => {
    const status = row.status_vinculo ?? row.status;
    const reason = readText(row.motivo_vinculo ?? row.motivo);
    const reasonIcon = status === 'vinculado' ? '✓' : '⚠';
    const reasonClass = status === 'vinculado' ? 'ok' : 'warn';
    const unitCost = getUnitCost(row);
    const unitCostLabel = unitCost === null ? '-' : formatCurrency(unitCost);
    return `<div class="npi3-preview-row"><div class="npi3-cell erp" title="${readText(row.codigo_produto_erp_original ?? row.codigo_erp ?? row.codigoERP ?? row.codigo)}">${readText(row.codigo_produto_erp_original ?? row.codigo_erp ?? row.codigoERP ?? row.codigo)}</div><div class="npi3-cell product" title="${readText(row.nome_produto_original ?? row.produto)}"><span class="npi3-product">${readText(row.nome_produto_original ?? row.produto)}</span></div><div class="npi3-cell cor" title="${readText(row.cor_original ?? row.cor)}">${readText(row.cor_original ?? row.cor)}</div><div class="npi3-cell tamanho" title="${readText(row.tamanho_original ?? row.tamanho)}">${readText(row.tamanho_original ?? row.tamanho)}</div><div class="npi3-cell qty" title="${readText(row.quantidade)}">${readText(row.quantidade)}</div><div class="npi3-cell unit" title="${unitCostLabel}">${unitCostLabel}</div><div class="npi3-cell status"><span class="npi3-chip ${badgeClass(status)}">${friendlyStatus(status)}</span></div><div class="npi3-reason-row"><span class="npi3-reason ${reasonClass}"><span class="npi3-reason-icon">${reasonIcon}</span> <span class="npi3-reason-text">${status === 'vinculado' ? 'Produto vinculado com sucesso' : reason}</span></span></div></div>`;
  }).join('')}</div>`;
}

export async function renderPedidosItensImportPage(root, { apiClient }) {
  injectStyles();
  const state = createPedidosItensImportState();

  function render() {
    const previewSummary = getPreviewResumo(state.preview);
    const resultSummary = state.result?.resumo || state.result?.summary || state.result || {};
    const previewItens = state.previewItens || getPreviewItens(state.preview);
    const previewResumo = state.previewResumo || previewSummary;
    const previewTotal = readPreviewResumoNumber(previewResumo, 'total_linhas', ['totalRows', 'total_linhas_importadas']);
    const previewVinculados = readPreviewResumoNumber(previewResumo, 'vinculadas', ['vinculados']);
    const previewNaoEncontrados = readPreviewResumoNumber(previewResumo, 'nao_encontradas', ['nao_encontrados']);
    const previewAmbiguos = readPreviewResumoNumber(previewResumo, 'ambiguas', ['ambiguos']);
    const previewErros = readPreviewResumoNumber(previewResumo, 'erros');
    root.innerHTML = `<section class="npi3"><div class="npi3-card"><div class="npi3-title">Importação de Itens de Pedido</div><div class="npi3-sub">Envie o XLSX, confira o vínculo antes da gravação e só então confirme a importação.</div></div><div class="npi3-grid"><div class="npi3-card"><div class="npi3-drop" data-testid="dropzone"><strong>Arraste o arquivo XLSX aqui</strong><div class="npi3-muted">ou selecione manualmente pelo campo abaixo.</div><div class="npi3-field"><label for="npi3-file">Selecionar arquivo</label><input id="npi3-file" data-testid="file-input" type="file" accept=".xlsx"></div><div class="npi3-summary"><div><strong>Arquivo</strong></div><div data-testid="selected-file">${state.fileName ? state.fileName : 'Nenhum arquivo selecionado'}</div><div><strong>Pedido ERP detectado</strong></div><div data-testid="pedido-erp">${state.pedidoErp ? `Pedido ERP: ${state.pedidoErp}` : 'Nenhum pedido detectado'}</div></div><div class="npi3-actions"><button id="npi3-preview" data-testid="preview-button" class="npi3-btn secondary" ${state.loadingPreview || state.loadingImport || !state.file ? 'disabled' : ''}>Visualizar Importação</button><button id="npi3-run" data-testid="import-button" class="npi3-btn" ${state.loadingPreview || state.loadingImport || !(state.preview?.importToken || state.importToken) ? 'disabled' : ''}>Importar Itens</button></div>${state.error ? `<div class="npi3-error" role="alert">${state.error}</div>` : ''}</div>${state.result ? `<div class="npi3-card" style="margin-top:12px"><strong>Resultado da importação</strong><div class="npi3-result-grid" style="margin-top:12px"><div><strong data-testid="result-imported">${summaryCount(resultSummary, ['importados', 'itens_importados'])}</strong><div>Importados</div></div><div><strong>${summaryCount(resultSummary, ['vinculadas', 'vinculados'])}</strong><div>Vinculados</div></div><div><strong>${summaryCount(resultSummary, ['nao_encontradas', 'nao_encontrados'])}</strong><div>Não encontrados</div></div><div><strong>${summaryCount(resultSummary, ['ambiguas', 'ambiguos'])}</strong><div>Ambíguos</div></div><div><strong>${summaryCount(resultSummary, ['erros'])}</strong><div>Erros</div></div></div></div>` : ''}</div><div class="npi3-card">${state.preview ? `<div class="npi3-kpi" data-testid="preview-summary"><div><strong>${previewTotal}</strong><div>Total de linhas</div></div><div><strong>${previewVinculados}</strong><div>Vinculados</div></div><div><strong>${previewNaoEncontrados}</strong><div>Não encontrados</div></div><div><strong>${previewAmbiguos}</strong><div>Ambíguos</div></div><div><strong>${previewErros}</strong><div>Erros</div></div></div><div class="npi3-summary" style="margin-top:12px"><div class="npi3-muted">${state.preview.fileName || ''}${state.preview.pedidoErp ? ` | Pedido ERP: ${state.preview.pedidoErp}` : ''}</div>${renderRows(previewItens)}</div>` : '<div class="npi3-state">Faça o preview para validar o arquivo antes da gravação.</div>'}</div></div></section>`;

    const fileInput = root.querySelector('#npi3-file');
    const previewButton = root.querySelector('#npi3-preview');
    const importButton = root.querySelector('#npi3-run');

    fileInput.onchange = (event) => {
      const file = event.target.files?.[0] || null;
      state.file = file;
      state.fileName = file?.name || '';
      state.pedidoErp = extractPedidoErpFromFileName(state.fileName);
      state.preview = null;
      state.result = null;
      state.error = '';
      render();
    };

    const dropzone = root.querySelector('[data-testid="dropzone"]');
    dropzone.ondragover = (event) => {
      event.preventDefault();
    };
    dropzone.ondrop = (event) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0] || null;
      if (!file) return;
      state.file = file;
      state.fileName = file?.name || '';
      state.pedidoErp = extractPedidoErpFromFileName(state.fileName);
      state.preview = null;
      state.result = null;
      state.error = '';
      render();
    };

    previewButton.onclick = async () => {
      if (!state.file) {
        state.error = 'Selecione um arquivo XLSX antes de continuar.';
        render();
        return;
      }
      state.loadingPreview = true;
      state.error = '';
      render();
      try {
        const payload = await buildPreviewPayload(state.file);
        state.preview = await withGlobalProcessing(async () => {
          const preview = await previewPedidosItensImport(apiClient, payload);
          const resumo = preview?.resumo || preview?.summary || {};
          const itens = preview?.itens || preview?.rows || [];
          state.previewResumo = resumo;
          state.previewItens = itens;
          console.log('preview resumo', resumo);
          console.log('preview primeiro item', itens?.[0]);
          return preview;
        }, {
          title: 'Lendo planilha',
          message: 'Estamos analisando os itens e montando a pré-visualização.',
          indeterminate: true
        });
        state.importToken = state.preview?.importToken || '';
      } catch (error) {
        state.error = error?.message || 'Não foi possível visualizar a importação.';
      } finally {
        state.loadingPreview = false;
        render();
      }
    };

    importButton.onclick = async () => {
      if (!state.preview) {
        state.error = 'Execute o preview antes de importar os itens.';
        render();
        return;
      }
      state.loadingImport = true;
      state.error = '';
      render();
      try {
        const importToken = state.preview?.importToken || state.importToken;
        state.result = await withGlobalProcessing(() => executePedidosItensImport(apiClient, { importToken }), {
          title: 'Importando itens',
          message: 'Gravando itens vinculados e registrando inconsistências',
          indeterminate: true
        });
      } catch (error) {
        state.error = error?.message || 'Não foi possível concluir a importação.';
      } finally {
        state.loadingImport = false;
        render();
      }
    };
  }

  render();
}
