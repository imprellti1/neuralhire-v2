import { withGlobalProcessing } from '../../core/global-processing.js';
import { createPedidosItensImportState } from './pedidos-itens-import.state.js';
import { buildPreviewPayload, executePedidosItensImport, extractPedidoErpFromFileName, previewPedidosItensImport } from './pedidos-itens-import.service.js';

function injectStyles() {
  if (document.getElementById('npi3-style')) return;
  const style = document.createElement('style');
  style.id = 'npi3-style';
  style.textContent = `.npi3{display:grid;gap:16px}.npi3-card{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.22)}.npi3-title{font-size:30px;font-weight:800}.npi3-sub{color:#91a4c4;margin-top:6px}.npi3-grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px;align-items:start}.npi3-drop{border:1.5px dashed rgba(79,140,255,.42);border-radius:18px;padding:18px;background:rgba(79,140,255,.07);display:grid;gap:12px}.npi3-drop strong{font-size:16px}.npi3-field{display:grid;gap:6px}.npi3-field input,.npi3-btn{height:40px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 12px;background:#0b1628;color:#e7eefb}.npi3-btn{background:#4f8cff;color:#fff;font-weight:700;cursor:pointer}.npi3-btn.secondary{background:#0b1628;color:#bcd0ff}.npi3-btn:disabled{opacity:.5;cursor:not-allowed}.npi3-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.npi3-kpi>div,.npi3-result-grid>div{background:rgba(255,255,255,.03);border:1px solid rgba(148,163,184,.12);border-radius:14px;padding:12px;min-width:0}.npi3-table{width:100%;border-collapse:collapse;table-layout:fixed}.npi3-table td,.npi3-table th{padding:6px 8px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;font-size:13px;vertical-align:top;min-width:0;overflow:hidden}.npi3-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#a9bbd8}.npi3-table th.npi3-col-qty,.npi3-table td.npi3-col-qty,.npi3-table th.npi3-col-status,.npi3-table td.npi3-col-status{text-align:center}.npi3-table th.npi3-col-qty,.npi3-table td.npi3-col-qty{white-space:nowrap}.npi3-table .npi3-col-erp{white-space:nowrap;width:128px;max-width:128px}.npi3-table .npi3-col-product{min-width:0;width:auto}.npi3-table .npi3-col-unit{white-space:nowrap;text-align:right;width:112px;max-width:112px}.npi3-table .npi3-product{display:block;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%}.npi3-state{padding:18px;text-align:center;color:#91a4c4}.npi3-actions{display:flex;gap:8px;flex-wrap:wrap}.npi3-error{color:#fecaca;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.22);border-radius:12px;padding:10px}.npi3-chip{display:inline-flex;align-items:center;justify-content:center;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}.npi3-chip.ok{background:rgba(52,211,153,.16);color:#34d399}.npi3-chip.warn{background:rgba(251,191,36,.16);color:#fbbf24}.npi3-chip.bad{background:rgba(248,113,113,.16);color:#f87171}.npi3-muted{font-size:12px;color:#91a4c4}.npi3-summary{display:grid;gap:8px}.npi3-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.npi3-result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.npi3-result-grid>div{display:grid;gap:4px;align-content:start;min-height:92px}.npi3-result-grid strong{display:block;font-size:28px;line-height:1;font-weight:800}.npi3-result-grid div div{font-size:12px;line-height:1.25;min-width:0;overflow:hidden;word-break:normal;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.npi3-table .npi3-reason-row td{padding:4px 8px 8px;border-bottom:1px solid rgba(148,163,184,.12)}.npi3-reason{display:block;border-radius:10px;padding:6px 10px;font-size:12px;line-height:1.35}.npi3-reason.warn{background:rgba(251,191,36,.12);color:#fbbf24}.npi3-reason.ok{background:rgba(52,211,153,.12);color:#34d399}.npi3-reason .npi3-reason-icon{margin-right:6px}.npi3-reason .npi3-reason-text{word-break:break-word}@media (max-width:1080px){.npi3-grid,.npi3-summary-grid,.npi3-kpi,.npi3-result-grid{grid-template-columns:1fr}.npi3-title{font-size:24px}}`;
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

function renderRows(rows = []) {
  if (!rows.length) return '<div class="npi3-state">Faça o preview para visualizar os itens importados.</div>';
  return `<table class="npi3-table" data-testid="preview-table"><colgroup><col style="width:128px"><col style="width:auto"><col style="width:130px"><col style="width:88px"><col style="width:112px"><col style="width:88px"><col style="width:150px"></colgroup><thead><tr><th class="npi3-col-erp">Código ERP</th><th class="npi3-col-product">Produto</th><th>Cor</th><th>Tamanho</th><th class="npi3-col-unit">Custo Unitário</th><th class="npi3-col-qty">Quantidade</th><th class="npi3-col-status">Status de Vínculo</th></tr></thead><tbody>${rows.map((row) => {
    const status = row.status_vinculo ?? row.status;
    const reason = readText(row.motivo_vinculo ?? row.motivo);
    const reasonIcon = status === 'vinculado' ? '✓' : '⚠';
    const reasonClass = status === 'vinculado' ? 'ok' : 'warn';
    return `<tr><td class="npi3-col-erp">${readText(row.codigo_produto_erp_original ?? row.codigo_erp ?? row.codigoERP ?? row.codigo)}</td><td class="npi3-col-product"><span class="npi3-product" title="${readText(row.nome_produto_original ?? row.produto)}">${readText(row.nome_produto_original ?? row.produto)}</span></td><td>${readText(row.cor_original ?? row.cor)}</td><td>${readText(row.tamanho_original ?? row.tamanho)}</td><td class="npi3-col-unit">${readText(row.valor_unitario ?? row.custo_unitario ?? row.custoUnitario)}</td><td class="npi3-col-qty">${readText(row.quantidade)}</td><td class="npi3-col-status"><span class="npi3-chip ${badgeClass(status)}">${friendlyStatus(status)}</span></td></tr><tr class="npi3-reason-row"><td colspan="7"><span class="npi3-reason ${reasonClass}"><span class="npi3-reason-icon">${reasonIcon}</span> <span class="npi3-reason-text">${status === 'vinculado' ? 'Produto vinculado com sucesso' : reason}</span></span></td></tr>`;
  }).join('')}</tbody></table>`;
}

export async function renderPedidosItensImportPage(root, { apiClient }) {
  injectStyles();
  const state = createPedidosItensImportState();

  function render() {
    const previewSummary = getPreviewResumo(state.preview);
    const resultSummary = state.result?.resumo || state.result?.summary || state.result || {};
    const previewItens = getPreviewItens(state.preview);
    root.innerHTML = `<section class="npi3"><div class="npi3-card"><div class="npi3-title">Importação de Itens de Pedido</div><div class="npi3-sub">Envie o XLSX, confira o vínculo antes da gravação e só então confirme a importação.</div></div><div class="npi3-grid"><div class="npi3-card"><div class="npi3-drop" data-testid="dropzone"><strong>Arraste o arquivo XLSX aqui</strong><div class="npi3-muted">ou selecione manualmente pelo campo abaixo.</div><div class="npi3-field"><label for="npi3-file">Selecionar arquivo</label><input id="npi3-file" data-testid="file-input" type="file" accept=".xlsx"></div><div class="npi3-summary"><div><strong>Arquivo</strong></div><div data-testid="selected-file">${state.fileName ? state.fileName : 'Nenhum arquivo selecionado'}</div><div><strong>Pedido ERP detectado</strong></div><div data-testid="pedido-erp">${state.pedidoErp ? `Pedido ERP: ${state.pedidoErp}` : 'Nenhum pedido detectado'}</div></div><div class="npi3-actions"><button id="npi3-preview" data-testid="preview-button" class="npi3-btn secondary" ${state.loadingPreview || state.loadingImport || !state.file ? 'disabled' : ''}>Visualizar Importação</button><button id="npi3-run" data-testid="import-button" class="npi3-btn" ${state.loadingPreview || state.loadingImport || !(state.preview?.importToken || state.importToken) ? 'disabled' : ''}>Importar Itens</button></div>${state.error ? `<div class="npi3-error" role="alert">${state.error}</div>` : ''}</div>${state.result ? `<div class="npi3-card" style="margin-top:12px"><strong>Resultado da importação</strong><div class="npi3-result-grid" style="margin-top:12px"><div><strong data-testid="result-imported">${summaryCount(resultSummary, ['importados', 'itens_importados'])}</strong><div>Importados</div></div><div><strong>${summaryCount(resultSummary, ['vinculados'])}</strong><div>Vinculados</div></div><div><strong>${summaryCount(resultSummary, ['nao_encontrados'])}</strong><div>Não encontrados</div></div><div><strong>${summaryCount(resultSummary, ['ambiguos'])}</strong><div>Ambíguos</div></div><div><strong>${summaryCount(resultSummary, ['erros'])}</strong><div>Erros</div></div></div></div>` : ''}</div><div class="npi3-card">${state.preview ? `<div class="npi3-kpi" data-testid="preview-summary"><div><strong>${summaryCount(previewSummary, ['total_linhas', 'totalRows', 'total_linhas_importadas'])}</strong><div>Total de linhas</div></div><div><strong>${summaryCount(previewSummary, ['vinculados'])}</strong><div>Vinculados</div></div><div><strong>${summaryCount(previewSummary, ['nao_encontrados'])}</strong><div>Não encontrados</div></div><div><strong>${summaryCount(previewSummary, ['ambiguos'])}</strong><div>Ambíguos</div></div><div><strong>${summaryCount(previewSummary, ['erros'])}</strong><div>Erros</div></div></div><div class="npi3-summary" style="margin-top:12px"><div class="npi3-muted">${state.preview.fileName || ''}${state.preview.pedidoErp ? ` | Pedido ERP: ${state.preview.pedidoErp}` : ''}</div>${renderRows(previewItens)}</div>` : '<div class="npi3-state">Faça o preview para validar o arquivo antes da gravação.</div>'}</div></div></section>`;

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
        state.preview = await withGlobalProcessing(() => previewPedidosItensImport(apiClient, payload), {
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
