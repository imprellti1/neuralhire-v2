import { addWhatsappConversationMessage, createWhatsappConversation, getWhatsappConversationContext, listWhatsappConversations, rebuildWhatsappConversationMemory, updateWhatsappConversationStatus } from './whatsapp-conversations.service.js';
import { getWhatsappConversationDraftState } from './whatsapp-conversations.service.js';
import { analyzeCommercialAgent, getCommercialAgentConversation } from './commercial-agent.service.js';
import { sendWhatsappDelivery } from './whatsapp-delivery.service.js';
import { generateMessageDraft } from './message-drafts.service.js';
import { approveMessageDraft, rejectMessageDraft } from '../message-approvals/message-approvals.service.js';
import { mapWhatsappConversationResponse } from './whatsapp-conversations.mapper.js';
import { createWhatsappConversationsState } from './whatsapp-conversations.state.js';
import { createCommercialAgentState } from './commercial-agent.state.js';

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function badgeStyle(risk) { return risk === 'alto' ? 'background:#fee2e2;color:#991b1b' : risk === 'medio' ? 'background:#fef3c7;color:#92400e' : 'background:#dcfce7;color:#166534'; }
function listMarkup(items, emptyLabel) {
  if (!items?.length) return `<p>${emptyLabel}</p>`;
  return `<ul>${items.map((item) => `<li>${esc(item.title || item.nome || item.description || item)}</li>`).join('')}</ul>`;
}

function memoryMarkup(memory) {
  if (!memory) return '<p>Memória comercial ainda não disponível.</p>';
  const commercial = memory.commercial || {};
  const behavior = memory.behavior || {};
  const products = memory.products || {};
  const manufacturers = memory.manufacturers || {};
  return `
    <div style="margin-top:12px">
      <div>Total Comprado: ${esc(commercial.totalComprado)}</div>
      <div>Ticket Médio: ${esc(commercial.ticketMedio)}</div>
      <div>Dias Sem Compra: ${esc(commercial.diasSemCompra)}</div>
      <div style="margin-top:8px"><span style="display:inline-block;padding:4px 10px;border-radius:999px;${badgeStyle(behavior.risco)}">Risco ${esc(behavior.risco)}</span></div>
      <div>Potencial: ${esc(behavior.potencial)}</div>
      <h3>Produtos Recorrentes</h3>
      ${listMarkup(products.recorrentes, 'Sem produtos recorrentes.')}
      <h3>Fabricantes Favoritos</h3>
      ${listMarkup(manufacturers.favoritos, 'Sem fabricantes favoritos.')}
      <h3>Oportunidades</h3>
      ${listMarkup(memory.opportunities, 'Sem oportunidades.')}
      <h3>Alertas</h3>
      ${listMarkup(memory.alerts, 'Sem alertas.')}
      <h3>Resumo Comercial</h3>
      <p>${esc(memory.summary || 'Memória comercial ainda não disponível.')}</p>
      <button id="rebuild-memory" type="button">Recalcular Memória</button>
    </div>
  `;
}

function draftMarkup(draft) {
  if (!draft) return '<p>Nenhuma sugestão gerada ainda.</p>';
  const action = draft.action || {};
  return `
    <div style="display:grid;gap:10px">
      <div style="padding:10px;border:1px solid #dbe4f2;border-radius:12px;background:#f8fbff">
        <div><strong>Baseado na Ação</strong></div>
        <div><strong>Tipo:</strong> ${esc(action.type || draft.draftType || '-')}</div>
        <div><strong>Motivo:</strong> ${esc(action.reason || draft.reason || '-')}</div>
        <div><strong>Confiança da ação:</strong> ${esc(action.confidence ?? draft.confidence ?? draft.confidenceScore ?? 0)}%</div>
      </div>
      <div><strong>Tipo:</strong> ${esc(draft.draftType || '-')}</div>
      <div><strong>Confiança:</strong> ${esc(draft.confidence ?? draft.confidenceScore ?? 0)}</div>
      <div><strong>Motivo:</strong> ${esc(draft.reason || '-')}</div>
      <div style="white-space:pre-wrap"><strong>Mensagem sugerida:</strong><br>${esc(draft.draft || draft.draftText || '')}</div>
    </div>
  `;
}

function agentMarkup(item) {
  if (!item) return '<p>Nenhuma análise comercial ainda disponível.</p>';
  return `
    <div style="display:grid;gap:10px">
      <div><strong>Tipo:</strong> ${esc(item.action_type || item.actionType || '-')}</div>
      <div><strong>Confiança:</strong> ${esc(item.confidence_score ?? item.confidence ?? 0)}</div>
      <div><strong>Motivo:</strong> ${esc(item.reason || item.recommendation?.reason || '-')}</div>
      <div><strong>Resumo:</strong> ${esc(item.recommendation?.summary || '-')}</div>
      <div><strong>Produtos sugeridos:</strong> ${Array.isArray(item.recommendation?.recommendedProducts) && item.recommendation.recommendedProducts.length ? `<ul>${item.recommendation.recommendedProducts.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p>Sem produtos sugeridos.</p>'}</div>
      <div><strong>Fabricantes sugeridos:</strong> ${Array.isArray(item.recommendation?.recommendedManufacturers) && item.recommendation.recommendedManufacturers.length ? `<ul>${item.recommendation.recommendedManufacturers.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p>Sem fabricantes sugeridos.</p>'}</div>
    </div>
  `;
}

function workflowBadge(label, value, active = false) {
  return `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 10px;border-radius:10px;background:${active ? '#eaf2ff' : '#f8fbff'};border:1px solid #dbe4f2"><span>${esc(label)}</span><strong>${esc(value || '-')}</strong></div>`;
}

function renderWorkflow(state) {
  const draft = state.workflow?.draft || state.draft || null;
  const approval = state.workflow?.approval || null;
  const delivery = state.workflow?.delivery || null;
  const canApprove = ['manager', 'admin', 'super_admin'].includes(String(state.viewerRole || 'manager'));
  const approvalState = String(approval?.status || 'pending');
  return `
    <section style="margin-top:20px;padding-top:16px;border-top:1px solid #e8eef7">
      <h2>Workflow Comercial</h2>
      <div style="display:grid;gap:8px">
        ${workflowBadge('Draft', String(draft?.status || 'none'))}
        ${workflowBadge('Approval', String(approvalState))}
        ${workflowBadge('Delivery', String(delivery?.status || 'not_sent'))}
      </div>
      ${draft?.status === 'generated' ? `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          ${canApprove ? '<button id="approve-draft" type="button">Aprovar</button><button id="reject-draft" type="button">Rejeitar</button>' : '<p style="margin:0">Apenas visualização para este perfil.</p>'}
        </div>
      ` : ''}
      ${state.workflowError ? `<p>${esc(state.workflowError.message || 'Erro ao carregar workflow')}</p>` : ''}
    </section>
  `;
}

export async function renderWhatsappConversationsPage(container, { apiClient } = {}) {
  const state = createWhatsappConversationsState();
  const agentState = createCommercialAgentState();
  state.workflow = null;
  state.workflowLoading = false;
  state.workflowError = null;
  state.viewerRole = 'manager';
  state.agent = agentState.item;
  state.agentLoading = agentState.loading;
  state.agentError = agentState.error;

  const render = () => {
    const selectedConversation = state.selected?.conversation || null;
    const customer = state.context?.customer || null;
    container.innerHTML = `
      <section style="display:grid;gap:16px">
        <header>
          <h1>WhatsApp Inbox</h1>
          <p>Central comercial contextual com memória de cliente.</p>
        </header>
        ${state.error ? `<p>${esc(state.error.message || 'Erro ao carregar')}</p>` : ''}
        ${state.loading ? '<p>Carregando contexto...</p>' : ''}
        <div style="display:grid;grid-template-columns:280px minmax(0,1fr) 360px;gap:16px;align-items:start">
          <aside style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:12px">
            ${state.items.map((item) => `
              <button type="button" data-conversation-id="${esc(item.id)}" style="display:block;width:100%;text-align:left;margin:0 0 8px;padding:10px 12px;border:1px solid #dbe4f2;border-radius:12px;background:${selectedConversation?.id === item.id ? '#eaf2ff' : '#fff'}">
                <strong>${esc(item.contact_name || item.phone || 'Contato')}</strong>
                <div style="font-size:12px;color:#61708f">${esc(item.status)}</div>
                <div style="font-size:12px;color:#61708f">${esc(item.phone)}</div>
              </button>
            `).join('') || '<p>Sem conversas</p>'}
            <button id="new-conv" type="button">Nova Conversa</button>
          </aside>
          <main style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px;min-height:520px">
            ${selectedConversation ? `
              <h2>${esc(selectedConversation.contactName || selectedConversation.phone)}</h2>
              <div id="msg-list">
                ${(state.messages || []).map((m) => `
                  <article style="padding:10px 0;border-bottom:1px solid #eef3fb">
                    <strong>${esc(m.direction)}</strong>
                    <p>${esc(m.body)}</p>
                  </article>
                `).join('') || '<p>Sem mensagens</p>'}
              </div>
              <textarea id="message-body" rows="4" style="width:100%;margin-top:12px"></textarea>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                <button id="save-message" type="button">Salvar Mensagem</button>
                <button id="close-conv" type="button">Fechar</button>
                <button id="reopen-conv" type="button">Reabrir</button>
              </div>
            ` : '<p>Selecione uma conversa</p>'}
          </main>
          <aside style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
            <h2>Customer Memory</h2>
            ${customer ? `
              <div>
                <div><strong>${esc(customer.nome || '-')}</strong></div>
                <div>${esc(customer.empresa || '-')}</div>
                <div>${esc(customer.cidade || '-')}/${esc(customer.uf || '-')}</div>
              </div>
            ` : '<p>Conversa ainda não vinculada a um cliente.</p>'}
            ${memoryMarkup(state.context?.memory)}
              <section style="margin-top:20px;padding-top:16px;border-top:1px solid #e8eef7">
                <h2>Agente Comercial</h2>
                ${state.agentError ? `<p>${esc(state.agentError.message || 'Erro ao carregar agente comercial')}</p>` : ''}
                ${state.agentLoading ? '<p>Gerando próxima melhor ação...</p>' : ''}
                ${state.agent ? agentMarkup(state.agent) : '<p>Nenhuma ação sugerida ainda.</p>'}
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                  <button id="analyze-commercial-agent" type="button">Analisar</button>
                  <button id="reanalyze-commercial-agent" type="button">Reanalisar</button>
                </div>
              </section>
              <section style="margin-top:20px;padding-top:16px;border-top:1px solid #e8eef7">
                <h2>Sugestão Comercial</h2>
                ${state.draft ? draftMarkup(state.draft) : '<p>Nenhuma sugestão comercial gerada.</p>'}
                ${state.draftError ? `<p>${esc(state.draftError.message || 'Erro ao gerar sugestão')}</p>` : ''}
                ${state.draftLoading ? '<p>Gerando sugestão...</p>' : ''}
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                  ${state.draft?.draftId ? '<button id="send-whatsapp" type="button">Enviar via WhatsApp</button>' : ''}
                  <button id="generate-draft" type="button">Gerar Sugestão</button>
                  <button id="regenerate-draft" type="button">Regerar Draft</button>
                  <button id="copy-draft" type="button">Copiar</button>
                </div>
                ${renderWorkflow(state)}
              </section>
            </aside>
          </div>
        </section>
    `;

    container.querySelectorAll('[data-conversation-id]').forEach((el) => el.addEventListener('click', () => load(el.getAttribute('data-conversation-id'))));
    container.querySelector('#new-conv')?.addEventListener('click', async () => { await createWhatsappConversation(apiClient, { phone: '5511999999999', contactName: 'Novo contato' }); await load(); });
    container.querySelector('#save-message')?.addEventListener('click', async () => {
      const body = container.querySelector('#message-body')?.value || '';
      if (!selectedConversation?.id || !body) return;
      await addWhatsappConversationMessage(apiClient, selectedConversation.id, { direction: 'outbound', body, senderType: 'agent', status: 'draft' });
      await load(selectedConversation.id);
    });
    container.querySelector('#close-conv')?.addEventListener('click', async () => { if (!selectedConversation?.id) return; await updateWhatsappConversationStatus(apiClient, selectedConversation.id, { status: 'closed' }); await load(selectedConversation.id); });
    container.querySelector('#reopen-conv')?.addEventListener('click', async () => { if (!selectedConversation?.id) return; await updateWhatsappConversationStatus(apiClient, selectedConversation.id, { status: 'open' }); await load(selectedConversation.id); });
    container.querySelector('#rebuild-memory')?.addEventListener('click', async () => { if (!state.context?.customer?.clienteId) return; await rebuildWhatsappConversationMemory(apiClient, state.context.customer.clienteId); await load(selectedConversation.id); });
    container.querySelector('#generate-draft')?.addEventListener('click', async () => { if (!selectedConversation?.id) return; await loadDraft(selectedConversation.id); });
    container.querySelector('#regenerate-draft')?.addEventListener('click', async () => { if (!selectedConversation?.id) return; await loadDraft(selectedConversation.id); });
    container.querySelector('#copy-draft')?.addEventListener('click', async () => {
      const text = state.draft?.draft || state.draft?.draftText || '';
      if (!text) return;
      await navigator.clipboard?.writeText?.(text);
    });
    container.querySelector('#send-whatsapp')?.addEventListener('click', async () => {
      if (!state.draft?.draftId) return;
      await sendWhatsappDelivery(apiClient, { draftId: state.draft.draftId });
      await load(selectedConversation.id);
    });
    container.querySelector('#analyze-commercial-agent')?.addEventListener('click', async () => {
      if (!selectedConversation?.id) return;
      await loadCommercialAgent(selectedConversation.id, false);
    });
    container.querySelector('#reanalyze-commercial-agent')?.addEventListener('click', async () => {
      if (!selectedConversation?.id) return;
      await loadCommercialAgent(selectedConversation.id, true);
    });
    container.querySelector('#approve-draft')?.addEventListener('click', async () => {
      const draftId = state.workflow?.draft?.id || state.workflow?.draft?.draftId || state.draft?.draftId;
      if (!draftId) return;
      await approveMessageDraft(apiClient, draftId, {});
      await refreshWorkflow(selectedConversation.id);
    });
    container.querySelector('#reject-draft')?.addEventListener('click', async () => {
      const draftId = state.workflow?.draft?.id || state.workflow?.draft?.draftId || state.draft?.draftId;
      if (!draftId) return;
      const comment = window.prompt('Motivo da rejeição');
      if (!comment) return;
      await rejectMessageDraft(apiClient, draftId, { comment });
      await refreshWorkflow(selectedConversation.id);
    });
  };

  const refreshWorkflow = async (conversationId) => {
    state.workflowLoading = true;
    state.workflowError = null;
    render();
    try {
      state.workflow = await getWhatsappConversationDraftState(apiClient, conversationId);
      state.draft = state.workflow.draft || state.draft;
    } catch (error) {
      state.workflowError = error;
    } finally {
      state.workflowLoading = false;
      render();
    }
  };

  const loadCommercialAgent = async (conversationId, force = false) => {
    state.agentLoading = true;
    state.agentError = null;
    render();
    try {
      state.agent = force ? await analyzeCommercialAgent(apiClient, conversationId) : await getCommercialAgentConversation(apiClient, conversationId);
    } catch (error) {
      if (!force && error?.code === 'COMMERCIAL_AGENT_NOT_FOUND') {
        state.agent = await analyzeCommercialAgent(apiClient, conversationId);
      } else {
        state.agentError = error;
      }
    } finally {
      state.agentLoading = false;
      render();
    }
  };

  const loadDraft = async (conversationId) => {
    state.draftLoading = true;
    state.draftError = null;
    render();
    try {
      state.draft = await generateMessageDraft(apiClient, conversationId);
    } catch (error) {
      state.draftError = error;
    } finally {
      state.draftLoading = false;
      render();
    }
  };

  const load = async (selectedId = null) => {
    state.loading = true;
    state.error = null;
    render();
    try {
      const list = await listWhatsappConversations(apiClient, {});
      state.items = list.items || [];
      const targetId = selectedId || state.items[0]?.id || null;
      if (targetId) {
        const context = mapWhatsappConversationResponse(await getWhatsappConversationContext(apiClient, targetId));
        state.selected = context;
        state.context = context;
        await loadCommercialAgent(targetId, false);
        await loadDraft(targetId);
        await refreshWorkflow(targetId);
      } else {
        state.selected = null;
        state.context = null;
        state.draft = null;
        state.workflow = null;
        state.agent = null;
      }
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      render();
    }
  };

  await load();
}
