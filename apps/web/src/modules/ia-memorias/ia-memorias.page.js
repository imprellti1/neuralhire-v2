import { archiveIaMemoria, createIaMemoria, listIaMemorias, updateIaMemoria } from './ia-memorias.service.js';
import { mapIaMemoria } from './ia-memorias.mapper.js';
import { createIaMemoriasState } from './ia-memorias.state.js';

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
function snippet(text = '') { return String(text).slice(0, 140); }

export async function renderIaMemoriasPage(root, { apiClient } = {}) {
  const state = createIaMemoriasState();
  const renderForm = () => {
    if (!state.showForm) return '';
    const item = state.editing || {};
    return `<section class="ia-form"><h3>${state.editing ? 'Editar memória' : 'Nova memória'}</h3>
      <label>Tipo<input id="ia-tipo" value="${esc(item.tipo || '')}"></label>
      <label>Título<input id="ia-titulo" value="${esc(item.titulo || '')}"></label>
      <label>Conteúdo<textarea id="ia-conteudo">${esc(item.conteudo || '')}</textarea></label>
      <label>Módulo<input id="ia-modulo" value="${esc(item.modulo || '')}"></label>
      <label>Tags<input id="ia-tags" value="${esc((item.tags || []).join(', '))}"></label>
      <label>Prioridade<input id="ia-prioridade" type="number" value="${esc(item.prioridade ?? 0)}"></label>
      <label>Origem<input id="ia-origem" value="${esc(item.origem || '')}"></label>
      <label>Metadata JSON<textarea id="ia-metadata">${esc(JSON.stringify(item.metadata || {}, null, 2))}</textarea></label>
      <div class="ia-actions"><button id="ia-cancel">Cancelar</button><button id="ia-save">Salvar</button></div></section>`;
  };
  function stats() {
    const items = state.items || [];
    return [
      ['Memórias ativas', items.filter((i) => i.status === 'ativa').length],
      ['Pontos de retomada', items.filter((i) => i.tipo === 'ponto_retomada').length],
      ['Regras de negócio', items.filter((i) => i.tipo === 'regra_negocio').length],
      ['Bugs corrigidos', items.filter((i) => i.tipo === 'bug_corrigido').length]
    ];
  }
  function render() {
    const filtered = state.items || [];
    const cards = filtered.length ? filtered.map((item) => `<article class="ia-card" data-id="${item.id}"><div class="ia-card-top"><strong>${esc(item.titulo)}</strong><span>${esc(item.tipo)}</span></div><div class="ia-meta">${esc(item.modulo || '-') } • prioridade ${Number(item.prioridade || 0)}</div><p>${esc(snippet(item.conteudo))}${item.conteudo?.length > 140 ? '...' : ''}</p><div class="ia-tags">${(item.tags || []).map((t) => `<span>${esc(t)}</span>`).join('')}</div><div class="ia-actions"><button data-edit="${item.id}">Editar</button><button data-archive="${item.id}">Arquivar</button></div></article>`).join('') : '<div class="ia-empty">Nenhuma memória encontrada.</div>';
    root.innerHTML = `<section class="ia-page"><header class="ia-head"><div><h1>Memória IA</h1><p>Registre decisões, regras e pontos de retomada do NeuralHire.</p></div><button id="ia-new">Nova memória</button></header><section class="ia-kpis">${stats().map(([l,v]) => `<div><strong>${v}</strong><span>${l}</span></div>`).join('')}</section><section class="ia-filters"><input id="ia-filter-search" placeholder="Busca textual" value="${esc(state.filters.search)}"><input id="ia-filter-tipo" placeholder="Tipo" value="${esc(state.filters.tipo)}"><input id="ia-filter-modulo" placeholder="Módulo" value="${esc(state.filters.modulo)}"><input id="ia-filter-tag" placeholder="Tag" value="${esc(state.filters.tag)}"><select id="ia-filter-status"><option value="">Todos</option><option value="ativa" ${state.filters.status === 'ativa' ? 'selected' : ''}>ativa</option><option value="arquivada" ${state.filters.status === 'arquivada' ? 'selected' : ''}>arquivada</option></select></section><section class="ia-list">${state.loading ? '<div class="ia-empty">Carregando...</div>' : cards}</section>${renderForm()}</section>`;
    root.querySelector('#ia-new')?.addEventListener('click', () => { state.editing = null; state.showForm = true; render(); bindForm(); });
    root.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => { state.editing = filtered.find((x) => x.id === btn.getAttribute('data-edit')); state.showForm = true; render(); bindForm(); }));
    root.querySelectorAll('[data-archive]').forEach((btn) => btn.addEventListener('click', async () => { await archiveIaMemoria(apiClient, btn.getAttribute('data-archive')); await load(); }));
    root.querySelectorAll('#ia-filter-search,#ia-filter-tipo,#ia-filter-modulo,#ia-filter-tag,#ia-filter-status').forEach((el) => {
      el.addEventListener(el.id === 'ia-filter-status' ? 'change' : 'input', (e) => { state.filters[e.target.id.replace('ia-filter-','')] = e.target.value || ''; load(); });
    });
  }
  function bindForm() {
    root.querySelector('#ia-cancel')?.addEventListener('click', () => { state.showForm = false; state.editing = null; render(); });
    root.querySelector('#ia-save')?.addEventListener('click', async () => {
      const payload = { tipo: root.querySelector('#ia-tipo').value, titulo: root.querySelector('#ia-titulo').value, conteudo: root.querySelector('#ia-conteudo').value, modulo: root.querySelector('#ia-modulo').value, tags: root.querySelector('#ia-tags').value.split(',').map((s) => s.trim()).filter(Boolean), prioridade: Number(root.querySelector('#ia-prioridade').value || 0), origem: root.querySelector('#ia-origem').value, metadata: JSON.parse(root.querySelector('#ia-metadata').value || '{}') };
      if (state.editing?.id) await updateIaMemoria(apiClient, state.editing.id, payload); else await createIaMemoria(apiClient, payload);
      state.showForm = false; state.editing = null; await load();
    });
  }
  async function load() {
    state.loading = true; render();
    try {
      const response = await listIaMemorias(apiClient, state.filters);
      state.items = (response.items || []).map(mapIaMemoria);
    } catch (error) { state.error = error; }
    state.loading = false; render(); bindForm();
  }
  await load();
}
