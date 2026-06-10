import { withGlobalProcessing } from '../../core/global-processing.js';

function injectStyles() {
  if (document.getElementById('nh-price-table-import-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-price-table-import-style';
  style.textContent = `.pti{display:grid;gap:16px}.pti-card{background:#fff;border:1px solid #dbe4f2;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(16,34,68,.06)}.pti-title{font-size:30px;font-weight:800}.pti-sub{color:#61708f;margin-top:6px}.pti-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.pti-field{display:grid;gap:6px}.pti-field input,.pti-btn{height:40px;border:1px solid #d4deee;border-radius:10px;padding:0 12px}.pti-btn{background:#1f56dc;color:#fff;font-weight:700;cursor:pointer}.pti-btn.secondary{background:#fff;color:#1f56dc}.pti-kpi{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.pti-kpi>div{background:#f7fbff;border:1px solid #dce8fb;border-radius:14px;padding:12px}.pti-table{width:100%;border-collapse:collapse}.pti-table td,.pti-table th{padding:8px;border-bottom:1px solid #edf2f8;text-align:left;font-size:13px;vertical-align:top}.pti-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#61708f}.pti-state{padding:18px;text-align:center;color:#61708f}.pti-actions{display:flex;gap:8px;flex-wrap:wrap}.pti-chip{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;font-size:12px;font-weight:700;background:#eef4ff;color:#2444a8}.pti-chip.is-ok{background:#ecfdf3;color:#047857}.pti-chip.is-warn{background:#fff7ed;color:#b45309}.pti-chip.is-bad{background:#fef2f2;color:#b42318}.pti-compact{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pti-file{display:block;color:#61708f}.pti-summary{display:flex;justify-content:space-between;gap:12px;align-items:center}.pti-summary strong{font-size:22px}.pti-result{white-space:pre-wrap;background:#f7fbff;border:1px solid #dce8fb;border-radius:12px;padding:12px}@media (max-width:900px){.pti-grid,.pti-kpi{grid-template-columns:1fr}.pti-title{font-size:24px}}`;
  document.head.appendChild(style);
}

function fileToFormData(file) {
  const fd = new FormData();
  if (!file) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  const isBlobLike = typeof Blob !== 'undefined' && file instanceof Blob;
  const safeBlob = isBlobLike ? file : new Blob([file?.buffer || file?.contents || file || ''], { type: file?.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const fileName = String(file?.name || '').trim() || 'tabela-preco.xlsx';
  if (!String(fileName).toLowerCase().endsWith('.xlsx')) throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  fd.append('file', safeBlob, fileName);
  return fd;
}

function chipClass(status) {
  if (status === 'matched_changed') return 'pti-chip';
  if (status === 'matched_unchanged') return 'pti-chip is-ok';
  if (status === 'invalid_price' || status === 'duplicated_ref' || status === 'duplicated_product_ref' || status === 'invalid_ref') return 'pti-chip is-bad';
  return 'pti-chip is-warn';
}

function statusLabel(status) {
  if (status === 'matched_changed') return 'Atualizar';
  if (status === 'matched_unchanged') return 'Sem alteração';
  if (status === 'unmatched') return 'Não encontrado';
  if (status === 'duplicated_ref') return 'Duplicado';
  if (status === 'duplicated_product_ref') return 'Duplicado no cadastro';
  if (status === 'invalid_price') return 'Preço inválido';
  if (status === 'invalid_ref') return 'Referência inválida';
  return status || '-';
}

export function renderPriceTableImportPage(root, { apiClient }) {
  injectStyles();
  const state = { file: null, fileName: '', loading: false, error: '', preview: null, result: null };

  function render() {
    root.innerHTML = `<section class="pti"><div class="pti-card"><div class="pti-title">Importação de Tabela de Preço</div><div class="pti-sub">Upload de XLSX para atualizar preços por referência. Apenas itens com preço alterado serão aplicados.</div></div><div class="pti-grid"><div class="pti-card"><div class="pti-field"><label>Arquivo XLSX</label><input id="pti-file" type="file" accept=".xlsx"><small class="pti-file">${state.fileName ? `Arquivo selecionado: ${state.fileName}` : 'Nenhum arquivo escolhido'}</small></div><div class="pti-actions" style="margin-top:12px"><button id="pti-preview" class="pti-btn secondary" ${state.loading || !state.file ? 'disabled' : ''}>Preview</button><button id="pti-run" class="pti-btn" ${state.loading || !state.preview ? 'disabled' : ''}>Aplicar atualização</button></div>${state.error ? `<div class="pti-state" role="alert">${state.error}</div>` : ''}${state.result ? `<div class="pti-result">${JSON.stringify(state.result.summary || state.result, null, 2)}</div>` : ''}</div><div class="pti-card">${state.preview ? `<div class="pti-kpi"><div><strong>${state.preview.summary?.totalRows || 0}</strong><div>Linhas</div></div><div><strong>${state.preview.summary?.matchedRows || 0}</strong><div>Encontrados</div></div><div><strong>${state.preview.summary?.changedRows || 0}</strong><div>Alterados</div></div><div><strong>${state.preview.summary?.unchangedRows || 0}</strong><div>Iguais</div></div><div><strong>${state.preview.summary?.unmatchedRows || 0}</strong><div>Não encontrados</div></div><div><strong>${state.preview.summary?.invalidRows || 0}</strong><div>Inválidos</div></div></div><div class="pti-summary" style="margin:14px 0 10px"><div><strong>Prévia</strong><div class="pti-sub">Chips compactos com title/aria-label completo.</div></div><div>${state.preview.fileName || ''}</div></div><table class="pti-table"><thead><tr><th>Ref</th><th>Preço atual</th><th>Novo preço</th><th>Status</th><th>Mensagem</th><th>Matches</th></tr></thead><tbody>${(state.preview.items || []).map((item) => `<tr><td class="pti-compact">${item.ref || '-'}</td><td>${item.currentPrice ?? '-'}</td><td>${item.newPrice ?? '-'}</td><td><span class="${chipClass(item.status)}" title="${statusLabel(item.status)}" aria-label="${statusLabel(item.status)}">${statusLabel(item.status)}</span></td><td class="pti-compact" title="${item.message || ''}">${item.message || '-'}</td><td class="pti-compact" title="${[(item.matchedProductIds || []).join(', '), (item.matchedProductSkus || []).filter(Boolean).join(', '), (item.matchedProductNames || []).join(' | ')].filter(Boolean).join('\n')}">${(item.matchedProductIds || []).length ? `${(item.matchedProductIds || []).length} encontrado(s)` : '-'}</td></tr>`).join('')}</tbody></table>` : '<div class="pti-state">Faça o preview para validar a planilha.</div>'}</div></div></section>`;
    root.querySelector('#pti-file').onchange = (e) => {
      const selectedFile = e.target.files?.[0] || null;
      state.file = selectedFile;
      state.fileName = selectedFile?.name || '';
      state.error = '';
      render();
    };

    root.querySelector('#pti-preview').onclick = async () => {
      if (!state.file) return;
      state.loading = true; render();
      try {
        const fd = fileToFormData(state.file);
        state.preview = await withGlobalProcessing(() => apiClient.post('/produtos/importacao-tabela-preco/preview', fd), {
          title: 'Lendo planilha',
          message: 'Estamos analisando os preços antes de aplicar.',
          indeterminate: true
        });
      } catch (error) {
        state.error = error?.message || 'Não foi possível ler a planilha.';
      } finally {
        state.loading = false; render();
      }
    };

    root.querySelector('#pti-run').onclick = async () => {
      if (!state.preview?.importToken) return;
      state.loading = true; render();
      try {
        state.result = await withGlobalProcessing(() => apiClient.post('/produtos/importacao-tabela-preco', { importToken: state.preview.importToken }), {
          title: 'Atualizando preços',
          message: 'Aplicando apenas os preços que mudaram.',
          indeterminate: true
        });
      } catch (error) {
        state.error = error?.message || 'Não foi possível aplicar a atualização.';
      } finally {
        state.loading = false; render();
      }
    };
  }

  render();
}
