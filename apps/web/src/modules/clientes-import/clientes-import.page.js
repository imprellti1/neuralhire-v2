import { withGlobalProcessing } from '../../core/global-processing.js';
import { executeClientesImport, previewClientesImport } from './clientes-import.service.js';

function injectStyles() {
  if (document.getElementById('nci-style')) return;
  const style = document.createElement('style');
  style.id = 'nci-style';
  style.textContent = `.nci{display:grid;gap:16px}.nci-card{background:#fff;border:1px solid #dbe4f2;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(16,34,68,.06)}.nci-title{font-size:30px;font-weight:800}.nci-sub{color:#61708f;margin-top:6px}.nci-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.nci-kpi>div{background:#f7fbff;border:1px solid #dce8fb;border-radius:14px;padding:12px}.nci-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:16px}.nci-btn{height:40px;border:1px solid #d4deee;border-radius:10px;padding:0 12px;background:#1f56dc;color:#fff;font-weight:700;cursor:pointer}.nci-btn.secondary{background:#fff;color:#1f56dc}.nci-table{width:100%;border-collapse:collapse}.nci-table td,.nci-table th{padding:8px;border-bottom:1px solid #edf2f8;text-align:left;font-size:13px;vertical-align:top}.nci-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#61708f}.nci-chip{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700;background:#eef4ff;color:#2444a8}.nci-chip.ok{background:#ecfdf3;color:#047857}.nci-chip.bad{background:#fef2f2;color:#b42318}.nci-chip.warn{background:#fff7ed;color:#b45309}.nci-state{padding:18px;text-align:center;color:#61708f}.nci-actions{display:flex;gap:8px;flex-wrap:wrap}.nci-error{color:#b42318;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px}.nci-meta{font-size:12px;color:#61708f}.nci-file{display:block;margin-top:6px;color:#61708f}@media (max-width:900px){.nci-grid,.nci-kpi{grid-template-columns:1fr}.nci-title{font-size:24px}}`;
  document.head.appendChild(style);
}

function toFormData(file) {
  if (!file) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  const fileName = String(file?.name || '').trim() || 'Clientes_288.xlsx';
  if (!fileName.toLowerCase().endsWith('.xlsx')) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  const fd = new FormData();
  const blob = typeof Blob !== 'undefined' && file instanceof Blob ? file : new Blob([file?.buffer || file?.contents || file || ''], { type: file?.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  fd.append('file', blob, fileName);
  return fd;
}

function chipClass(status) {
  if (status === 'novo') return 'nci-chip ok';
  if (status === 'existente') return 'nci-chip';
  if (status === 'possivel_duplicado') return 'nci-chip warn';
  return 'nci-chip bad';
}

function label(status) {
  if (status === 'novo') return 'Novo';
  if (status === 'existente') return 'Existente';
  if (status === 'possivel_duplicado') return 'Possível duplicado';
  return 'Inválido';
}

export async function renderClientesImportPage(root, { apiClient }) {
  injectStyles();
  const state = { file: null, fileName: '', loading: false, error: '', preview: null, result: null };
  function render() {
    const previewRows = state.preview?.rows || [];
    root.innerHTML = `<section class="nci"><div class="nci-card"><div class="nci-title">Importação de Clientes</div><div class="nci-sub">Upload da planilha real de clientes com validação por CNPJ, código da fábrica e possível duplicidade.</div></div><div class="nci-grid"><div class="nci-card"><div><label>Arquivo XLSX</label><input id="nci-file" type="file" accept=".xlsx"><div class="nci-file">${state.fileName ? `Arquivo selecionado: ${state.fileName}` : 'Nenhum arquivo escolhido'}</div></div><div class="nci-actions" style="margin-top:12px"><button id="nci-preview" class="nci-btn secondary" ${state.loading || !state.file ? 'disabled' : ''}>Preview</button><button id="nci-run" class="nci-btn" ${state.loading || !state.preview?.importToken ? 'disabled' : ''}>Confirmar importação</button></div>${state.error ? `<div class="nci-error" role="alert">${state.error}</div>` : ''}${state.result ? `<div class="nci-card" style="margin-top:12px"><strong>Resultado final</strong><div class="nci-kpi" style="margin-top:12px"><div><strong>${state.result.summary?.inserted || 0}</strong><div>Inseridos</div></div><div><strong>${state.result.summary?.ignoredExisting || 0}</strong><div>Ignorados existentes</div></div><div><strong>${state.result.summary?.invalidRows || 0}</strong><div>Inválidos</div></div><div><strong>${state.result.summary?.possibleDuplicates || 0}</strong><div>Possíveis duplicados</div></div></div></div>` : ''}</div><div class="nci-card">${state.preview ? `<div class="nci-kpi"><div><strong>${state.preview.summary?.novos || 0}</strong><div>Novos</div></div><div><strong>${state.preview.summary?.existentes || 0}</strong><div>Existentes</div></div><div><strong>${state.preview.summary?.invalidos || 0}</strong><div>Inválidos</div></div><div><strong>${state.preview.summary?.possiveis_duplicados || 0}</strong><div>Possíveis duplicados</div></div></div><div class="nci-meta" style="margin:12px 0">${state.preview.fileName || ''} ${state.preview.sheetName ? `| Aba ${state.preview.sheetName}` : ''}</div><table class="nci-table"><thead><tr><th>Linha</th><th>Razão Social</th><th>CNPJ</th><th>Código</th><th>Status</th><th>Erros / Observações</th></tr></thead><tbody>${previewRows.map((row) => `<tr><td>${row.rowNumber}</td><td>${row.razaoSocial || '-'}</td><td>${row.cnpj || '-'}</td><td>${row.codigo || '-'}</td><td><span class="${chipClass(row.status)}">${label(row.status)}</span></td><td>${(row.errors || []).join(' | ') || (row.status === 'possivel_duplicado' ? 'Possível duplicidade por nome + cidade + estado' : '-')}</td></tr>`).join('')}</tbody></table>` : '<div class="nci-state">Faça o preview para validar a planilha.</div>'}</div></div></section>`;
    root.querySelector('#nci-file').onchange = (e) => {
      const selectedFile = e.target.files?.[0] || null;
      state.file = selectedFile;
      state.fileName = selectedFile?.name || '';
      state.error = '';
      render();
    };
    root.querySelector('#nci-preview').onclick = async () => {
      if (!state.file) return;
      state.loading = true; render();
      try {
        const fd = toFormData(state.file);
        state.preview = await withGlobalProcessing(() => previewClientesImport(apiClient, fd), { title: 'Lendo planilha', message: 'Estamos analisando os clientes da fábrica.', indeterminate: true });
      } catch (error) {
        state.error = error?.message || 'Não foi possível ler a planilha.';
      } finally {
        state.loading = false; render();
      }
    };
    root.querySelector('#nci-run').onclick = async () => {
      if (!state.preview?.importToken) return;
      state.loading = true; render();
      try {
        state.result = await withGlobalProcessing(() => executeClientesImport(apiClient, { importToken: state.preview.importToken }), { title: 'Importando clientes', message: 'Inserindo apenas clientes novos e válidos.', indeterminate: true });
      } catch (error) {
        state.error = error?.message || 'Não foi possível concluir a importação.';
      } finally {
        state.loading = false; render();
      }
    };
  }
  render();
}
