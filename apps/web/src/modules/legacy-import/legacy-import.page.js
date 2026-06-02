import { createLegacyImportState } from './legacy-import.state.js';
import {
  auditLegacyImportBatch,
  approveLegacyImportBatch,
  executeLegacyImport,
  getLegacyImportBatch,
  getLegacyImportBatchReport,
  getLegacyImportBatchIssues,
  getLegacyImportBatchRecords,
  getLegacyImportStatus,
  listLegacyImportBatches,
  promoteLegacyImportBatch,
  previewLegacyImport,
  rejectLegacyImportBatch,
  validateLegacyImport
} from './legacy-import.service.js';
import { mapLegacyImportBatchReport, mapLegacyImportBatchSummary, mapLegacyImportStatusResponse } from './legacy-import.mapper.js';

function renderSummaryCard(summary = {}) {
  return `<article id="legacy-summary-card"><h3>Resumo Executivo</h3><div>Total records: ${summary.total ?? 0}</div><div>Válidos: ${summary.valid ?? 0}</div><div>Inválidos: ${summary.invalid ?? 0}</div><div>Warnings: ${summary.warnings ?? 0}</div><div>Errors: ${summary.errors ?? 0}</div><div>Status final: ${summary.status ?? 'n/a'}</div></article>`;
}

function renderApprovalBadge(status = 'unknown') {
  const color = { approved: 'green', rejected: 'red', normalized: 'blue', validating: 'yellow' }[status] || 'gray';
  return `<span class="legacy-status-badge legacy-status-badge-${color}">${status}</span>`;
}

function renderBatchDetails(batch) {
  if (!batch) return '<p id="legacy-batch-empty">Selecione um lote</p>';
  const approval = batch.approval || {};
  const summary = batch.summary || {};
  return `<section><h3>Status da Aprovação</h3>${renderApprovalBadge(approval.status || batch.status)}<div>Status atual: ${approval.status || batch.status}</div><div>Criado em: ${batch.createdAt || ''}</div><div>Issues: ${(summary.errors ?? 0) + (summary.warnings ?? 0)}</div><div>Records: ${summary.total ?? 0}</div><button id="legacy-approve">Aprovar Lote</button><button id="legacy-reject">Rejeitar Lote</button><button id="legacy-promote">Promover para v2</button><p id="legacy-approval-blocked" hidden>Existem erros pendentes que impedem a aprovação.</p><p id="legacy-promote-feedback" hidden></p></section>`;
}

function renderRecords(records) {
  if (!records.length) return '<p id="legacy-records-empty">Sem records</p>';
  return `<ul>${records.map((record) => `<li>${record.entity} ${record.status} ${record.legacy_id || ''}</li>`).join('')}</ul>`;
}

function renderIssues(issues) {
  if (!issues.length) return '<p id="legacy-issues-empty">Sem issues</p>';
  return `<ul>${issues.map((issue) => `<li>${issue.entity} ${issue.severity || ''} ${issue.message || ''}</li>`).join('')}</ul>`;
}

function renderAuditCard(report) {
  if (!report) return '<p id="legacy-audit-empty">Sem auditoria executada</p>';
  const integrity = report.integrity || {};
  const errors = report.errors || [];
  const warnings = report.warnings || [];
  const severityClass = errors.length ? 'red' : warnings.length ? 'yellow' : 'green';
  const imported = (entity) => (report.summary?.created?.[entity] || 0) + (report.summary?.updated?.[entity] || 0);
  return `<article id="legacy-audit-card" class="legacy-audit-${severityClass}"><h3>Auditoria Pós-Promoção</h3><div>Clientes Importados: ${imported('clientes')}</div><div>Produtos Importados: ${imported('produtos')}</div><div>Pedidos Importados: ${imported('pedidos')}</div><div>Itens Importados: ${imported('pedidoItens')}</div><div>Warnings: ${warnings.length}</div><div>Errors: ${errors.length}</div><div>Pedidos órfãos: ${integrity.orphanOrders || 0}</div><div>Itens órfãos: ${integrity.orphanItems || 0}</div><div>Clientes ausentes: ${integrity.missingCustomers || 0}</div><div>Produtos ausentes: ${integrity.missingProducts || 0}</div><button id="legacy-run-audit">Executar Auditoria</button></article>`;
}

function renderRejectModal(showing) {
  return `<section id="legacy-reject-modal" ${showing ? '' : 'hidden'}><h3>Motivo da rejeição</h3><textarea id="legacy-reject-reason" required></textarea><button id="legacy-reject-cancel">Cancelar</button><button id="legacy-reject-confirm">Confirmar Rejeição</button></section>`;
}

export async function renderLegacyImportPage(container, { apiClient }) {
  const state = createLegacyImportState();
  state.rejectModalOpen = false;
  state.rejectReason = '';
  state.promoteFeedback = '';

  const readPayload = () => {
    try {
      return JSON.parse(state.payloadText || '{}');
    } catch {
      return {};
    }
  };

  const currentSummary = () => state.selectedBatch?.summary || { total: state.batchRecords.length, valid: state.batchRecords.filter((record) => record.status !== 'invalid').length, invalid: state.batchRecords.filter((record) => record.status === 'invalid').length, warnings: state.batchIssues.filter((issue) => issue.severity === 'warning').length, errors: state.batchIssues.filter((issue) => issue.severity === 'error').length, status: state.selectedBatch?.approval?.status || state.selectedBatch?.status };

  const loadAudit = async (batchId = state.selectedBatchId) => {
    if (!batchId) return;
    const [batchResponse, recordsResponse, issuesResponse, auditResponse, reportResponse] = await Promise.all([
      getLegacyImportBatch(apiClient, batchId),
      getLegacyImportBatchRecords(apiClient, batchId),
      getLegacyImportBatchIssues(apiClient, batchId),
      auditLegacyImportBatch(apiClient, batchId).catch(() => null),
      getLegacyImportBatchReport(apiClient, batchId).catch(() => null)
    ]);
    state.selectedBatch = mapLegacyImportBatchSummary(batchResponse.batch || batchResponse);
    state.batchRecords = recordsResponse.records || [];
    state.batchIssues = issuesResponse.issues || [];
    state.batchAudit = auditResponse?.report ? mapLegacyImportBatchReport(auditResponse.report) : null;
    state.batchReport = reportResponse?.report ? mapLegacyImportBatchReport(reportResponse.report) : null;
  };

  const loadStatus = async () => {
    state.loading = true;
    state.error = null;
    render();
    try {
      state.status = mapLegacyImportStatusResponse(await getLegacyImportStatus(apiClient));
      const batchesResponse = await listLegacyImportBatches(apiClient);
      state.batches = (batchesResponse.batches || []).map(mapLegacyImportBatchSummary);
      if (!state.selectedBatchId && state.batches[0]?.id) {
        state.selectedBatchId = state.batches[0].id;
        await loadAudit(state.selectedBatchId);
      }
    } catch (error) {
      state.error = error;
    } finally {
      state.loading = false;
      render();
    }
  };

  const render = () => {
    if (state.loading) {
      container.innerHTML = '<section><h1>Importacao Legado</h1><p>Carregando...</p></section>';
      return;
    }
    const blocked = state.batchIssues.some((issue) => issue.severity === 'error');
    const batch = state.selectedBatch;
    const canPromote = batch?.status === 'approved' && !blocked && batch?.status !== 'imported';
    container.innerHTML = `<section><header><h1>Importacao Legado</h1><p>Preparacao dos dados reais para a v2 e para o agente WhatsApp</p></header><section><h2>Status</h2><div>${state.status?.environment || 'unknown'}</div><div>${state.status?.enabled ? 'Habilitada' : 'Bloqueada'}</div><div>${state.status?.stagingEnabled ? 'Staging ativo' : 'Staging inativo'}</div></section><section><h2>Lotes de Importacao</h2>${state.batches.length ? `<table><tbody>${state.batches.map((item) => `<tr><td><button class="legacy-batch-select" data-batch-id="${item.id}">${item.id}</button></td><td>${item.status}</td><td>${item.source}</td></tr>`).join('')}</tbody></table>` : '<p>Sem lotes</p>'}</section><section><h2>Detalhe do Lote</h2>${renderBatchDetails(batch)}${blocked ? '<p id="legacy-approval-warning">Existem erros pendentes que impedem a aprovação.</p>' : ''}<section><h3>Resumo Executivo</h3>${renderSummaryCard(currentSummary())}</section><section><h3>Auditoria Pós-Promoção</h3>${renderAuditCard(state.batchAudit || state.batchReport)}</section><section><h3>Records</h3>${renderRecords(state.batchRecords)}</section><section><h3>Issues</h3>${renderIssues(state.batchIssues)}</section><section><p id="legacy-promote-feedback"${state.promoteFeedback ? '' : ' hidden'}>${state.promoteFeedback || ''}</p></section></section><section><textarea id="legacy-json">${state.payloadText}</textarea><button id="legacy-validate">Validar</button><button id="legacy-preview">Preview</button><button id="legacy-execute">Executar Importacao</button></section>${renderRejectModal(state.rejectModalOpen)}</section>`;
    container.querySelector('#legacy-validate')?.addEventListener('click', runValidate);
    container.querySelector('#legacy-preview')?.addEventListener('click', runPreview);
    container.querySelector('#legacy-execute')?.addEventListener('click', runExecute);
    const approveButton = container.querySelector('#legacy-approve');
    if (approveButton) approveButton.disabled = blocked;
    approveButton?.addEventListener('click', runApprove);
    const promoteButton = container.querySelector('#legacy-promote');
    if (promoteButton) promoteButton.disabled = !canPromote;
    promoteButton?.addEventListener('click', async () => {
      if (!canPromote) return;
      if (!globalThis.confirm?.('Esta ação promoverá os dados aprovados para as tabelas oficiais da v2. Deseja continuar?')) return;
      state.loading = true;
      render();
      try {
        const result = await promoteLegacyImportBatch(apiClient, state.selectedBatchId);
        state.promoteFeedback = result?.ok ? 'Promoção concluída com sucesso.' : String(result?.code || 'Falha na promoção');
        await loadStatus();
      } catch (error) {
        state.promoteFeedback = String(error?.message || error);
      } finally {
        state.loading = false;
        render();
      }
    });
    container.querySelector('#legacy-reject')?.addEventListener('click', () => {
      state.rejectModalOpen = true;
      render();
    });
    container.querySelector('#legacy-reject-cancel')?.addEventListener('click', () => {
      state.rejectModalOpen = false;
      render();
    });
    container.querySelector('#legacy-reject-reason')?.addEventListener('input', (event) => {
      state.rejectReason = event.target.value;
    });
    container.querySelector('#legacy-reject-confirm')?.addEventListener('click', runReject);
    container.querySelector('#legacy-run-audit')?.addEventListener('click', async () => {
      state.loading = true;
      render();
      try {
        const result = await auditLegacyImportBatch(apiClient, state.selectedBatchId);
        state.batchAudit = mapLegacyImportBatchReport(result.report);
        state.promoteFeedback = 'Auditoria executada com sucesso.';
        await loadStatus();
      } catch (error) {
        state.promoteFeedback = String(error?.message || error);
      } finally {
        state.loading = false;
        render();
      }
    });
    container.querySelector('#legacy-json')?.addEventListener('input', (event) => {
      state.payloadText = event.target.value;
    });
    container.querySelectorAll('.legacy-batch-select').forEach((button) => {
      button.addEventListener('click', async () => {
        state.selectedBatchId = button.dataset.batchId;
        await loadAudit(state.selectedBatchId);
        render();
      });
    });
  };

  const runValidate = async () => { state.loading = true; render(); try { state.result = await validateLegacyImport(apiClient, readPayload()); await loadStatus(); } finally { state.loading = false; render(); } };
  const runPreview = async () => { state.loading = true; render(); try { state.result = await previewLegacyImport(apiClient, readPayload()); await loadStatus(); } finally { state.loading = false; render(); } };
  const runExecute = async () => { state.loading = true; render(); try { state.result = await executeLegacyImport(apiClient, { ...readPayload(), dryRun: false }); await loadStatus(); } finally { state.loading = false; render(); } };
  const runApprove = async () => { state.loading = true; render(); try { await approveLegacyImportBatch(apiClient, state.selectedBatchId); await loadStatus(); } finally { state.loading = false; render(); } };
  const runReject = async () => { state.loading = true; render(); try { await rejectLegacyImportBatch(apiClient, state.selectedBatchId, { reason: state.rejectReason }); state.rejectModalOpen = false; await loadStatus(); } finally { state.loading = false; render(); } };

  await loadStatus();
}
