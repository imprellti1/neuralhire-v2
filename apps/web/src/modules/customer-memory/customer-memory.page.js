import { getCustomerMemory, getCustomerMemorySummary, rebuildCustomerMemory } from './customer-memory.service.js';
import { mapCustomerMemoryResponse } from './customer-memory.mapper.js';
import { createCustomerMemoryState } from './customer-memory.state.js';

export async function renderCustomerMemoryPage(container, { apiClient, clienteId } = {}) {
  const state = createCustomerMemoryState();
  const acct = 'acc-demo';
  const id = clienteId || 'cliente-demo';

  const render = () => {
    if (state.loading) {
      container.innerHTML = '<section><h1>Customer Memory</h1><p>Carregando...</p></section>';
      return;
    }
    if (state.error) {
      container.innerHTML = '<section><h1>Customer Memory</h1><p>Erro ao carregar</p><button id="cm-retry">Tentar novamente</button></section>';
      container.querySelector('#cm-retry')?.addEventListener('click', load);
      return;
    }
    const d = state.data || {};
    container.innerHTML = `<section><h1>Customer Memory</h1><div>Total Comprado: ${d.commercial?.totalComprado ?? '-'}</div><div>Ticket Médio: ${d.commercial?.ticketMedio ?? '-'}</div><div>Dias Sem Compra: ${d.commercial?.diasSemCompra ?? '-'}</div><div>Risco: ${d.behavior?.risco || '-'}</div><div>Potencial: ${d.behavior?.potencial || '-'}</div><button id="cm-rebuild">Rebuild</button><h2>Produtos Recorrentes</h2><ul>${(d.products?.recorrentes || []).map((item) => `<li>${item}</li>`).join('') || '<li>Sem dados</li>'}</ul><h2>Fabricantes Favoritos</h2><ul>${(d.manufacturers?.favoritos || []).map((item) => `<li>${item.nome}</li>`).join('') || '<li>Sem dados</li>'}</ul><h2>Oportunidades</h2><ul>${(d.opportunities || []).map((item) => `<li>${item.title}: ${item.description}</li>`).join('') || '<li>Sem oportunidades</li>'}</ul><h2>Alertas</h2><ul>${(d.alerts || []).map((item) => `<li>${item.title}: ${item.description}</li>`).join('') || '<li>Sem alertas</li>'}</ul><h2>Resumo Comercial</h2><p>${d.summary || '-'}</p></section>`;
    container.querySelector('#cm-rebuild')?.addEventListener('click', async () => {
      state.loading = true;
      render();
      try {
        state.data = mapCustomerMemoryResponse(await rebuildCustomerMemory(apiClient, acct, id));
      } catch (e) {
        state.error = e;
      } finally {
        state.loading = false;
        render();
      }
    });
  };

  const load = async () => {
    state.loading = true;
    state.error = null;
    render();
    try {
      state.data = mapCustomerMemoryResponse(await getCustomerMemory(apiClient, acct, id));
      await getCustomerMemorySummary(apiClient, acct, id);
    } catch (e) {
      state.error = e;
    } finally {
      state.loading = false;
      render();
    }
  };

  await load();
}
