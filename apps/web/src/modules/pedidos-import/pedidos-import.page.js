import { withGlobalProcessing } from '../../core/global-processing.js';
import { createPedidosImportState } from './pedidos-import.state.js';
import { executePedidosImport, previewPedidosImport } from './pedidos-import.service.js';

function injectStyles() {
  if (document.getElementById('npi2-style')) return;
  const style = document.createElement('style');
  style.id = 'npi2-style';
  style.textContent = `.npi2{display:grid;gap:16px}.npi2-card{background:#0f1b2f;border:1px solid rgba(148,163,184,.18);border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(0,0,0,.22)}.npi2-title{font-size:30px;font-weight:800}.npi2-sub{color:#91a4c4;margin-top:6px}.npi2-grid{display:grid;grid-template-columns:1fr 1.1fr;gap:16px}.npi2-field{display:grid;gap:6px}.npi2-field input,.npi2-btn{height:40px;border:1px solid rgba(148,163,184,.22);border-radius:10px;padding:0 12px;background:#0b1628;color:#e7eefb}.npi2-btn{background:#4f8cff;color:#fff;font-weight:700;cursor:pointer}.npi2-btn.secondary{background:#0b1628;color:#bcd0ff}.npi2-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.npi2-kpi>div{background:rgba(255,255,255,.03);border:1px solid rgba(148,163,184,.12);border-radius:14px;padding:12px}.npi2-table{width:100%;border-collapse:collapse}.npi2-table td,.npi2-table th{padding:8px;border-bottom:1px solid rgba(148,163,184,.12);text-align:left;font-size:13px;vertical-align:top}.npi2-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#a9bbd8}.npi2-state{padding:18px;text-align:center;color:#91a4c4}.npi2-actions{display:flex;gap:8px;flex-wrap:wrap}.npi2-error{color:#fca5a5;background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.22);border-radius:12px;padding:10px}.npi2-note{background:rgba(79,140,255,.08);border:1px solid rgba(79,140,255,.12);border-radius:12px;padding:10px;color:#cfe0ff}.npi2-chip{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(79,140,255,.16);color:#bcd0ff}.npi2-chip.ok{background:rgba(52,211,153,.16);color:#34d399}.npi2-chip.warn{background:rgba(251,191,36,.16);color:#fbbf24}.npi2-chip.bad{background:rgba(248,113,113,.16);color:#f87171}.npi2-meta{font-size:12px;color:#91a4c4;margin:10px 0}@media (max-width:900px){.npi2-grid,.npi2-kpi{grid-template-columns:1fr}.npi2-title{font-size:24px}}`;
  document.head.appendChild(style);
}

function toFormData(file) {
  if (!file) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  const fileName = String(file?.name || '').trim() || 'Pedidos.xlsx';
  if (!fileName.toLowerCase().endsWith('.xlsx')) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  const fd = new FormData();
  const blob = typeof Blob !== 'undefined' && file instanceof Blob ? file : new Blob([file?.buffer || file?.contents || file || ''], { type: file?.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  fd.append('file', blob, fileName);
  return fd;
}

function renderInconsistencias(items = []) {
  if (!items.length) return '<div class="npi2-state">Nenhuma inconsistência informada.</div>';
  return `<table class="npi2-table"><thead><tr><th>Linha</th><th>Código</th><th>Cliente</th><th>Pedido</th><th>Motivo</th></tr></thead><tbody>${items.map((item) => `<tr><td>${item.linha ?? item.rowNumber ?? '-'}</td><td>${item.codigo ?? '-'}</td><td>${item.cliente ?? item.clienteCodigo ?? '-'}</td><td>${item.numero ?? '-'}</td><td>${item.motivo ?? item.message ?? item.erro ?? item.reason ?? '-'}</td></tr>`).join('')}</tbody></table>`;
}

export async function renderPedidosImportPage(root, { apiClient }) {
  injectStyles();
  const state = createPedidosImportState();

  function summaryValue(summary, keys) {
    for (const key of keys) {
      const value = summary?.[key];
      if (value !== undefined) return value;
    }
    return 0;
  }

  function render() {
    const summary = state.preview?.summary || {};
    const resultSummary = state.result?.summary || state.result || {};
    root.innerHTML = `<section class="npi2"><div class="npi2-card"><div class="npi2-title">Importação de Pedidos</div><div class="npi2-sub">Upload de XLSX com pré-visualização antes da execução. A coluna <strong>Cliente</strong> é usada como código do cliente e <strong>Razão Social</strong> é ignorada para vínculo.</div></div><div class="npi2-grid"><div class="npi2-card"><div class="npi2-field"><label>Arquivo XLSX</label><input id="npi2-file" type="file" accept=".xlsx"><small class="npi2-muted">${state.fileName ? `Arquivo selecionado: ${state.fileName}` : 'Nenhum arquivo escolhido'}</small></div><div class="npi2-note" style="margin-top:12px">Não criamos cliente automaticamente. O vínculo só ocorre quando o código do cliente existir no cadastro.</div><div class="npi2-actions" style="margin-top:12px"><button id="npi2-preview" class="npi2-btn secondary" ${state.loading || !state.file ? 'disabled' : ''}>Pré-visualizar</button><button id="npi2-run" class="npi2-btn" ${!state.preview?.importToken || state.loading ? 'disabled' : ''}>Importar pedidos</button></div>${state.error ? `<div class="npi2-error" role="alert">${state.error}</div>` : ''}${state.result ? `<div class="npi2-card" style="margin-top:12px"><strong>Resultado final</strong><div class="npi2-kpi" style="margin-top:12px"><div><strong>${summaryValue(resultSummary, ['pedidos_criados'])}</strong><div>Pedidos criados</div></div><div><strong>${summaryValue(resultSummary, ['pedidos_ignorados'])}</strong><div>Pedidos ignorados</div></div><div><strong>${summaryValue(resultSummary, ['pedidos_duplicados'])}</strong><div>Pedidos duplicados</div></div><div><strong>${summaryValue(resultSummary, ['pedidos_com_erro'])}</strong><div>Pedidos com erro</div></div><div><strong>${summaryValue(resultSummary, ['pedidos_sem_cliente'])}</strong><div>Pedidos sem cliente</div></div></div></div>` : ''}</div><div class="npi2-card">${state.preview ? `<div class="npi2-kpi"><div><strong>${summaryValue(summary, ['pedidos_encontrados', 'total_pedidos', 'totalRows'])}</strong><div>Pedidos encontrados</div></div><div><strong>${summaryValue(summary, ['pedidos_validos', 'validos'])}</strong><div>Pedidos válidos</div></div><div><strong>${summaryValue(summary, ['pedidos_sem_cliente'])}</strong><div>Pedidos sem cliente</div></div><div><strong>${summaryValue(summary, ['pedidos_duplicados', 'duplicados'])}</strong><div>Duplicados</div></div><div><strong>${(summary.inconsistencias || []).length || summaryValue(summary, ['inconsistencias'])}</strong><div>Inconsistências</div></div></div><div class="npi2-meta">${state.preview.fileName || ''}${state.preview.sheetName ? ` | Aba ${state.preview.sheetName}` : ''}</div><h3>Inconsistências</h3>${renderInconsistencias(summary.inconsistencias || state.preview.inconsistencias || [])}<h3 style="margin-top:14px">Linhas analisadas</h3><table class="npi2-table"><thead><tr><th>Linha</th><th>Pedido</th><th>Cliente</th><th>Status</th><th>Observações</th></tr></thead><tbody>${(state.preview.rows || []).map((row) => `<tr><td>${row.rowNumber ?? row.linha ?? '-'}</td><td>${row.numero || row.pedido || '-'}</td><td>${row.clienteCodigo || row.cliente || '-'}</td><td><span class="${row.clienteEncontrado ? 'npi2-chip ok' : row.status === 'duplicado' ? 'npi2-chip warn' : 'npi2-chip bad'}">${row.clienteEncontrado ? 'Válido' : row.status === 'duplicado' ? 'Duplicado' : 'Sem cliente'}</span></td><td>${(row.erros || row.errors || row.observacoes || []).join ? (row.erros || row.errors || row.observacoes || []).join(' | ') : (row.erros || row.errors || row.observacoes || '-')}</td></tr>`).join('')}</tbody></table>` : '<div class="npi2-state">Faça a pré-visualização para validar a planilha.</div>'}</div></div></section>`;

    root.querySelector('#npi2-file').onchange = (e) => {
      const selectedFile = e.target.files?.[0] || null;
      state.file = selectedFile;
      state.fileName = selectedFile?.name || '';
      state.error = '';
      render();
    };

    root.querySelector('#npi2-preview').onclick = async () => {
      if (!state.file) return;
      state.loading = true;
      state.error = '';
      render();
      try {
        const payload = toFormData(state.file);
        state.preview = await withGlobalProcessing(() => previewPedidosImport(apiClient, payload), {
          title: 'Lendo planilha',
          message: 'Estamos analisando os pedidos e preparando a prévia.',
          indeterminate: true
        });
      } catch (error) {
        state.error = error?.message || 'Não foi possível ler a planilha.';
      } finally {
        state.loading = false;
        render();
      }
    };

    root.querySelector('#npi2-run').onclick = async () => {
      if (!state.preview?.importToken) {
        state.error = 'Execute a pré-visualização antes de importar os pedidos.';
        render();
        return;
      }
      state.loading = true;
      state.error = '';
      render();
      try {
        state.result = await withGlobalProcessing(() => executePedidosImport(apiClient, { importToken: state.preview.importToken }), {
          title: 'Importando pedidos',
          message: 'Criando apenas os pedidos válidos e vinculados a clientes existentes.',
          indeterminate: true
        });
      } catch (error) {
        state.error = error?.message || 'Não foi possível concluir a importação.';
      } finally {
        state.loading = false;
        render();
      }
    };
  }

  render();
}
