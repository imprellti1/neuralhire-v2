function injectStyles() {
  if (document.getElementById('nh-produtos-import-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-produtos-import-style';
  style.textContent = `.npi{display:grid;gap:16px}.npi-card{background:#fff;border:1px solid #dbe4f2;border-radius:18px;padding:18px;box-shadow:0 10px 30px rgba(16,34,68,.06)}.npi-title{font-size:30px;font-weight:800}.npi-sub{color:#61708f;margin-top:6px}.npi-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.npi-field{display:grid;gap:6px}.npi-field input,.npi-field select,.npi-btn{height:40px;border:1px solid #d4deee;border-radius:10px;padding:0 12px}.npi-btn{background:#1f56dc;color:#fff;font-weight:700;cursor:pointer}.npi-btn.secondary{background:#fff;color:#1f56dc}.npi-list{margin:0;padding-left:18px}.npi-kpi{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.npi-kpi > div{background:#f7fbff;border:1px solid #dce8fb;border-radius:14px;padding:12px}.npi-table{width:100%;border-collapse:collapse}.npi-table td,.npi-table th{padding:8px;border-bottom:1px solid #edf2f8;text-align:left;font-size:13px}.npi-state{padding:20px;text-align:center;color:#61708f}.npi-actions{display:flex;gap:8px;flex-wrap:wrap}@media (max-width:900px){.npi-grid,.npi-kpi{grid-template-columns:1fr}.npi-title{font-size:24px}}`;
  document.head.appendChild(style);
}

async function fileToFormData(file, fabricanteId) {
  const fd = new FormData();
  fd.append('fabricante_id', fabricanteId);
  const upload = typeof file?.arrayBuffer === 'function'
    ? new Blob([await file.arrayBuffer()], { type: file.type || 'application/octet-stream' })
    : file;
  fd.append('arquivo', upload, file.name || 'import.xlsx');
  return fd;
}

export function renderProdutosImportPage(root, { apiClient }) {
  injectStyles();
  let file = null;
  let fabricanteId = '';
  let preview = null;
  let result = null;
  let loading = false;
  const fabricantes = [];

  async function loadFabricantes() {
    try {
      const data = await apiClient.get('/fabricantes', { page: 1, limit: 100 });
      fabricantes.splice(0, fabricantes.length, ...(data.items || []));
    } catch {}
  }

  function render() {
    root.innerHTML = `<section class="npi"><div class="npi-card"><div class="npi-title">Importação de Produtos</div><div class="npi-sub">Upload de XLSX com produto pai, variações e estoque por grade.</div></div><div class="npi-grid"><div class="npi-card"><div class="npi-field"><label>Fábrica</label><select id="npi-fab"><option value="">Selecione</option>${fabricantes.map((f) => `<option value="${f.id}" ${String(fabricanteId) === String(f.id) ? 'selected' : ''}>${f.nome}</option>`).join('')}</select></div><div class="npi-field"><label>Arquivo XLSX</label><input id="npi-file" type="file" accept=".xlsx"></div><div class="npi-actions"><button id="npi-preview" class="npi-btn secondary" ${loading ? 'disabled' : ''}>Preview</button><button id="npi-run" class="npi-btn" ${loading || !preview ? 'disabled' : ''}>Importar</button></div>${result ? `<div class="npi-state">${JSON.stringify(result.summary || result, null, 2)}</div>` : ''}</div><div class="npi-card">${preview ? `<div class="npi-kpi"><div><strong>${preview.totalRows || 0}</strong><div>Linhas</div></div><div><strong>${preview.divergences || 0}</strong><div>Divergências</div></div><div><strong>${(preview.sampleRows || []).length}</strong><div>Amostra</div></div><div><strong>${(preview.headers || []).length}</strong><div>Colunas</div></div></div><h4>Primeiras linhas</h4><table class="npi-table">${(preview.sampleRows || []).map((row) => `<tr><td>${row.codigo_erp}</td><td>${row.nome_produto}</td><td>${row.variacao_nome || '-'}</td><td>${row.variationsCount || 0}</td></tr>`).join('')}</table>` : '<div class="npi-state">Faça o preview para validar a planilha.</div>'}</div></div></section>`;
    root.querySelector('#npi-fab').onchange = (e) => { fabricanteId = e.target.value; };
    root.querySelector('#npi-file').onchange = (e) => { file = e.target.files?.[0] || null; };
    root.querySelector('#npi-preview').onclick = async () => {
      if (!fabricanteId || !file) return;
      loading = true; render();
      const fd = await fileToFormData(file, fabricanteId);
      preview = await apiClient.post('/produtos/importar-estoque/preview', fd);
      loading = false; render();
    };
    const run = root.querySelector('#npi-run');
    if (run) run.onclick = async () => {
      if (!fabricanteId || !file) return;
      loading = true; render();
      const fd = await fileToFormData(file, fabricanteId);
      result = await apiClient.post('/produtos/importar-estoque', fd);
      loading = false; render();
    };
  }

  loadFabricantes().finally(render);
}
