function injectStyles() {
  if (document.getElementById('nh-produto-categorias-style')) return;
  const style = document.createElement('style');
  style.id = 'nh-produto-categorias-style';
  style.textContent = `
    .nhpc-panel{background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(16,34,68,.06);width:100%}
    .nhpc-header{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}
    .nhpc-title{font-size:30px;font-weight:700;letter-spacing:-.02em}
    .nhpc-sub{margin-top:6px;color:#61708f;font-size:14px;max-width:68ch}
    .nhpc-state{padding:24px;text-align:center;color:#607091}
    .nhpc-btn{height:38px;border:1px solid #d4deee;border-radius:10px;padding:0 10px;background:#1f56dc;color:#fff;font-weight:600;cursor:pointer}
    .nhpc-list{display:grid;gap:10px;margin-top:8px}
    .nhpc-item{padding:12px 14px;border:1px solid #ebf0f8;border-radius:12px;background:#f8fbff}
    .nhpc-meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#61708f;font-size:13px;margin-bottom:10px}
  `;
  document.head.appendChild(style);
}

export async function renderProdutoCategoriasPage(container, { apiClient } = {}) {
  injectStyles();
  container.innerHTML = `
    <section class="nhpc-header">
      <div>
        <div class="nhpc-title">Categorias de Produto</div>
        <div class="nhpc-sub">Lista simples de categorias com fallback seguro para manter a navegação funcionando.</div>
      </div>
      <button id="nhpc-refresh" class="nhpc-btn">Atualizar</button>
    </section>
    <section class="nhpc-panel" id="nhpc-panel">
      <div class="nhpc-state">Carregando categorias...</div>
    </section>
  `;

  const panel = container.querySelector('#nhpc-panel');
  const refresh = container.querySelector('#nhpc-refresh');

  async function load() {
    panel.innerHTML = '<div class="nhpc-state">Carregando categorias...</div>';
    try {
      const response = apiClient?.get ? await apiClient.get('/produto-categorias') : { items: [] };
      const items = Array.isArray(response?.items) ? response.items : [];
      if (!items.length) {
        panel.innerHTML = '<div class="nhpc-state">Nenhuma categoria encontrada.</div>';
        return;
      }
      panel.innerHTML = `
        <div class="nhpc-meta"><div>${items.length} categoria(s)</div><div>Endpoint /produto-categorias</div></div>
        <div class="nhpc-list">
          ${items.map((item) => `<div class="nhpc-item"><strong>${item.nome || item.nome_categoria || 'Categoria'}</strong><div>${item.descricao || item.status || 'Sem detalhes'}</div></div>`).join('')}
        </div>
      `;
    } catch {
      panel.innerHTML = '<div class="nhpc-state">Não foi possível carregar as categorias no momento.</div>';
    }
  }

  refresh.onclick = () => load();
  await load();
}
