import { createPromocoesState } from './promocoes.state.js';
import { calculatePrecoPromocional, mapPromocoesData } from './promocoes.mapper.js';
import { deletePromocao, fetchPromocoesData, savePromocao } from './promocoes.service.js';

function brl(value) { return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export function renderPromocoesPage(root, { apiClient } = {}) {
  const state = createPromocoesState();
  function render() {
    root.innerHTML = `<section class="nhp-wrap"><h1>Promoções</h1><button id="nhp-new">Nova promoção</button><div id="nhp-list">${state.loading ? 'Carregando...' : state.items.map((item) => `<article data-id="${item.id}"><strong>${item.nome}</strong><div>${item.percentual_desconto}%</div><button data-del="${item.id}">Inativar</button></article>`).join('')}</div><div id="nhp-form" style="display:${state.formOpen ? 'block' : 'none'}"><label>Nome<input id="nhp-nome" value="${state.form.nome || ''}"></label><label>Produto pai<input id="nhp-produto_id" value="${state.form.produto_id || ''}"></label><label>Percentual<input id="nhp-percentual_desconto" value="${state.form.percentual_desconto || ''}"></label><label>Aplicar em todas variações<input id="nhp-aplicar" type="checkbox" ${state.form.aplicar_em_todas_variacoes !== false ? 'checked' : ''}></label><div id="nhp-variacoes" style="display:${state.form.aplicar_em_todas_variacoes === false ? 'block' : 'none'}"><input id="nhp-variacao_ids" value="${(state.form.variacao_ids || []).join(',')}"></div><button id="nhp-save">Salvar</button></div></section>`;
    root.querySelector('#nhp-new')?.addEventListener('click', () => { state.formOpen = true; render(); });
    root.querySelectorAll('[data-del]').forEach((btn) => btn.onclick = async () => { await deletePromocao(apiClient, btn.getAttribute('data-del')); await load(); });
    root.querySelector('#nhp-aplicar')?.addEventListener('change', (e) => { state.form.aplicar_em_todas_variacoes = e.target.checked; render(); });
    root.querySelector('#nhp-save')?.addEventListener('click', async () => {
      const payload = { nome: root.querySelector('#nhp-nome').value, produto_id: root.querySelector('#nhp-produto_id').value, percentual_desconto: Number(root.querySelector('#nhp-percentual_desconto').value), aplicar_em_todas_variacoes: root.querySelector('#nhp-aplicar').checked, variacao_ids: root.querySelector('#nhp-variacao_ids')?.value.split(',').map((v) => v.trim()).filter(Boolean) || [] };
      await savePromocao(apiClient, payload);
      await load();
    });
  }
  async function load() { state.loading = true; render(); try { state.items = mapPromocoesData(await fetchPromocoesData(apiClient)).items; } finally { state.loading = false; render(); } }
  render(); load();
}

