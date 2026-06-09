function injectStyles() {
  if (document.getElementById('nh-produtos-import-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-produtos-import-style';
  style.textContent = `.npi{display:grid;gap:16px}.npi-card{background:#fff;border:1px solid #dbe4f2;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(16,34,68,.06)}.npi-title{font-size:30px;font-weight:800}.npi-sub{color:#61708f;margin-top:6px}.npi-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.npi-field{display:grid;gap:6px}.npi-field input,.npi-field select,.npi-btn{height:40px;border:1px solid #d4deee;border-radius:10px;padding:0 12px}.npi-btn{background:#1f56dc;color:#fff;font-weight:700;cursor:pointer}.npi-btn.secondary{background:#fff;color:#1f56dc}.npi-list{margin:0;padding-left:18px}.npi-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.npi-kpi > div{background:#f7fbff;border:1px solid #dce8fb;border-radius:14px;padding:12px}.npi-table{width:100%;border-collapse:collapse}.npi-table td,.npi-table th{padding:8px;border-bottom:1px solid #edf2f8;text-align:left;font-size:13px;vertical-align:top}.npi-table th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#61708f}.npi-state{padding:20px;text-align:center;color:#61708f}.npi-actions{display:flex;gap:8px;flex-wrap:wrap}.npi-sku{font-variant-numeric:tabular-nums}.npi-stock{font-weight:700;text-align:right}@media (max-width:900px){.npi-grid,.npi-kpi{grid-template-columns:1fr}.npi-title{font-size:24px}}`;
  document.head.appendChild(style);
}

export async function fileToFormData(file, fabricanteId) {
  const fd = new FormData();
  if (typeof fd.append !== 'function') {
    throw new TypeError('FormData indisponivel');
  }

  const isBlobLike =
    file &&
    typeof file === 'object' &&
    typeof file.size === 'number' &&
    typeof file.type === 'string';
  const safeBlob =
    typeof Blob !== 'undefined' && file instanceof Blob
      ? file
      : new Blob(
          [file?.buffer || file?.contents || file || ''],
          {
            type:
              file?.type ||
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        );
  const fileName = String(file?.name || '').trim();
  const fallbackName = fileName || 'estoque.xlsx';

  if (!fabricanteId) {
    throw new TypeError('Selecione um fabricante antes de continuar.');
  }

  if (!file || (!isBlobLike && !(typeof Blob !== 'undefined' && file instanceof Blob))) {
    throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  }

  if (!String(fallbackName).toLowerCase().endsWith('.xlsx')) {
    throw new TypeError('Selecione um arquivo XLSX antes de continuar.');
  }

  fd.append('fabricante_id', String(fabricanteId || '').trim());
  fd.append('file', safeBlob, fallbackName);
  return fd;
}

export function renderProdutosImportPage(root, { apiClient }) {
  injectStyles();
  const state = {
    file: null,
    fileName: '',
    fabricanteId: '',
    preview: null,
    result: null,
    loading: false,
    error: '',
    fileError: 'Selecione um arquivo XLSX antes de continuar.'
  };
  const fabricantes = [];

  async function loadFabricantes() {
    try {
      const data = await apiClient.get('/fabricantes', { page: 1, limit: 100 });
      fabricantes.splice(0, fabricantes.length, ...(data.items || []));
      if (!state.fabricanteId) {
        const primeiraFabricaValida = fabricantes.find((f) => String(f?.id || '').trim());
        if (primeiraFabricaValida) {
          state.fabricanteId = String(primeiraFabricaValida.id);
        }
      }
    } catch {}
  }

  function render() {
    const selectedValue = String(state.fabricanteId || '');
    root.innerHTML = `<section class="npi"><div class="npi-card"><div class="npi-title">Importação de Produtos</div><div class="npi-sub">Upload de XLSX com produto pai, variações e estoque por grade.</div></div><div class="npi-grid"><div class="npi-card"><div class="npi-field"><label>Fábrica</label><select id="npi-fab"><option value="">Selecione</option>${fabricantes.map((f) => `<option value="${String(f.id)}" ${selectedValue === String(f.id) ? 'selected' : ''}>${f.nome}</option>`).join('')}</select></div><div class="npi-field"><label>Arquivo XLSX</label><input id="npi-file" type="file" accept=".xlsx"><div class="npi-sub">${state.fileName ? `Arquivo selecionado: ${state.fileName}` : 'Nenhum arquivo escolhido'}</div></div>${state.fileError ? `<div class="npi-state" role="alert">${state.fileError}</div>` : ''}<div class="npi-actions"><button id="npi-preview" class="npi-btn secondary" ${state.loading || !state.file || !state.fabricanteId ? 'disabled' : ''}>Preview</button><button id="npi-run" class="npi-btn" ${state.loading || !state.preview || !state.file || !state.fabricanteId ? 'disabled' : ''}>Importar</button></div>${state.error ? `<div class="npi-state" role="alert">${state.error}</div>` : ''}${state.result ? `<div class="npi-state">${JSON.stringify(state.result.summary || state.result, null, 2)}</div>` : ''}</div><div class="npi-card">${state.preview ? `<div class="npi-kpi"><div><strong>${state.preview.totalRows || 0}</strong><div>Linhas</div></div><div><strong>${state.preview.divergences || 0}</strong><div>Divergências</div></div><div><strong>${(state.preview.sampleRows || []).length}</strong><div>Amostra</div></div><div><strong>${(state.preview.headers || []).length}</strong><div>Colunas</div></div></div><h4>Primeiras linhas</h4><table class="npi-table"><thead><tr><th>SKU / Código</th><th>Nome / Produto</th><th>Cor</th><th>Grade / Tamanho</th><th style="text-align:right">Estoque</th></tr></thead><tbody>${(state.preview.items || state.preview.sampleRows || []).map((row) => `<tr><td class="npi-sku">${row.sku || row.codigo_erp || '-'}</td><td>${row.nome_produto || row.nome || '-'}</td><td>${row.cor || row.variacao_nome || '-'}</td><td>${row.grade || row.tamanho || row.variacao_nome || '-'}</td><td class="npi-stock">${Number(row.estoque ?? row.totalStock ?? row.total ?? 0)}</td></tr>`).join('')}</tbody></table>` : '<div class="npi-state">Faça o preview para validar a planilha.</div>'}</div></div></section>`;
    const fabricanteSelect = root.querySelector('#npi-fab');
    if (fabricanteSelect && String(fabricanteSelect.value || '') !== selectedValue) {
      fabricanteSelect.value = selectedValue;
    }
    fabricanteSelect.onchange = (e) => {
      state.fabricanteId = String(e.target.value || '');
      state.error = '';
      render();
    };
    root.querySelector('#npi-file').onchange = (e) => {
      const selectedFile = e.target.files?.[0] || null;
      state.file = selectedFile;
      state.fileName = selectedFile?.name || '';
      state.fileError = state.file ? '' : 'Selecione um arquivo XLSX antes de continuar.';
      state.error = '';
      render();
    };
    function requireValidInput() {
      const fabricanteId = String(state.fabricanteId || '').trim();
      if (!fabricanteId || fabricanteId === 'undefined' || fabricanteId === 'null') {
        state.error = 'Selecione uma fábrica antes de continuar.';
        state.fileError = '';
        return false;
      }
      const isFileLike = typeof File !== 'undefined' && state.file instanceof File;
      const isBlobLike = typeof Blob !== 'undefined' && state.file instanceof Blob;
      if (!state.file || (!isFileLike && !isBlobLike)) {
        state.fileError = 'Selecione um arquivo XLSX antes de continuar.';
        state.error = '';
        return false;
      }
      const fileName = String(state.file?.name || '').trim().toLowerCase();
      if (!fileName.endsWith('.xlsx')) {
        state.fileError = 'Selecione um arquivo XLSX antes de continuar.';
        state.error = '';
        return false;
      }
      state.fileError = '';
      state.fabricanteId = fabricanteId;
      return true;
    }
    root.querySelector('#npi-preview').onclick = async () => {
      if (!requireValidInput()) {
        render();
        return;
      }
      state.loading = true; render();
      state.error = '';
      try {
        const fd = await fileToFormData(state.file, state.fabricanteId);
        state.preview = await apiClient.post('/produtos/importar-estoque/preview', fd);
      } catch (err) {
        state.error = err?.message || 'Arquivo XLSX invalido. Selecione um arquivo compatível e tente novamente.';
      } finally {
        state.loading = false; render();
      }
    };
    const run = root.querySelector('#npi-run');
    if (run) run.onclick = async () => {
      if (!requireValidInput()) {
        render();
        return;
      }
      state.loading = true; render();
      state.error = '';
      try {
        const fd = await fileToFormData(state.file, state.fabricanteId);
        state.result = await apiClient.post('/produtos/importar-estoque', fd);
      } catch (err) {
        state.error = err?.message || 'Não foi possível importar o arquivo.';
      } finally {
        state.loading = false; render();
      }
    };
  }

  loadFabricantes().finally(render);
}
