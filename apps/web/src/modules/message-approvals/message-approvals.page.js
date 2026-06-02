import { approveMessageDraft, getMessageApproval, listPendingMessageApprovals, rejectMessageDraft } from './message-approvals.service.js';
import { createMessageApprovalsState } from './message-approvals.state.js';

function esc(v) { return String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function statusStyle(status) { return status === 'approved' ? 'background:#dcfce7;color:#166534' : status === 'rejected' ? 'background:#fee2e2;color:#991b1b' : 'background:#fef3c7;color:#92400e'; }

export async function renderMessageApprovalsPage(container, { apiClient } = {}) {
  const state = createMessageApprovalsState();

  const render = () => {
    const selected = state.selected;
    container.innerHTML = `
      <section style="display:grid;gap:16px">
        <header><h1>Aprovação Humana</h1><p>Fila auditável de drafts antes de qualquer envio externo.</p></header>
        ${state.error ? `<p>${esc(state.error.message || 'Erro ao carregar')}</p>` : ''}
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start">
          <main style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
            <table style="width:100%;border-collapse:collapse">
              <thead><tr><th align="left">Cliente</th><th align="left">Empresa</th><th align="left">Tipo</th><th align="left">Status</th><th align="left">Criado em</th></tr></thead>
              <tbody>
                ${(state.items || []).map((row) => `<tr data-approval-id="${esc(row.id)}" style="cursor:pointer;border-top:1px solid #eef3fb"><td>${esc(row.cliente_id || '-')}</td><td>${esc(row.conversation_id || '-')}</td><td>${esc(row.draft_id || '-')}</td><td><span style="display:inline-block;padding:4px 10px;border-radius:999px;${statusStyle(row.status)}">${esc(row.status)}</span></td><td>${esc(row.created_at || '-')}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum item pendente</td></tr>'}
              </tbody>
            </table>
          </main>
          <aside style="background:#fff;border:1px solid #dbe4f2;border-radius:16px;padding:16px">
            <h2>Detalhe</h2>
            ${selected ? `<div style="display:grid;gap:10px"><div><strong>Mensagem sugerida</strong><div>${esc(selected.comment || '-')}</div></div><div><strong>Motivo</strong><div>${esc(selected.comment || '-')}</div></div><div><strong>Contexto</strong><div>${esc(selected.conversation_id || '-')}</div></div><div><strong>Customer Memory resumida</strong><div>${esc(selected.cliente_id || '-')}</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="approve-btn" type="button">Aprovar</button><button id="reject-btn" type="button">Rejeitar</button></div></div>` : '<p>Selecione um item</p>'}
            ${state.actionError ? `<p>${esc(state.actionError.message || 'Erro')}</p>` : ''}
            ${state.actionLoading ? '<p>Processando...</p>' : ''}
          </aside>
        </div>
        ${state.modalOpen ? `<div role="dialog" aria-modal="true" style="position:fixed;inset:0;background:rgba(15,23,42,.35);display:grid;place-items:center"><div style="background:#fff;padding:18px;border-radius:16px;min-width:320px;max-width:90vw"><h3>Rejeitar</h3><textarea id="reject-comment" rows="4" style="width:100%">${esc(state.comment)}</textarea><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="cancel-modal" type="button">Cancelar</button><button id="confirm-reject" type="button">Confirmar</button></div></div></div>` : ''}
      </section>
    `;

    container.querySelectorAll('[data-approval-id]').forEach((el) => el.addEventListener('click', async () => loadDetail(el.getAttribute('data-approval-id'))));
    container.querySelector('#approve-btn')?.addEventListener('click', async () => { if (!selected?.draft_id) return; await runAction(() => approveMessageDraft(apiClient, selected.draft_id, { comment: '' })); });
    container.querySelector('#reject-btn')?.addEventListener('click', () => { state.modalOpen = true; render(); });
    container.querySelector('#cancel-modal')?.addEventListener('click', () => { state.modalOpen = false; render(); });
    container.querySelector('#confirm-reject')?.addEventListener('click', async () => { if (!selected?.draft_id) return; const comment = container.querySelector('#reject-comment')?.value || ''; await runAction(() => rejectMessageDraft(apiClient, selected.draft_id, { comment })); state.modalOpen = false; });
  };

  const runAction = async (fn) => {
    state.actionLoading = true; state.actionError = null; render();
    try { await fn(); await load(); } catch (error) { state.actionError = error; } finally { state.actionLoading = false; render(); }
  };
  const loadDetail = async (approvalId) => { const detail = await getMessageApproval(apiClient, approvalId); state.selected = detail.item; render(); };
  const load = async () => {
    state.loading = true; render();
    try {
      const pending = await listPendingMessageApprovals(apiClient);
      state.items = pending.items || [];
      if (state.items[0]) await loadDetail(state.items[0].id);
    } catch (error) { state.error = error; }
    finally { state.loading = false; render(); }
  };
  await load();
}
