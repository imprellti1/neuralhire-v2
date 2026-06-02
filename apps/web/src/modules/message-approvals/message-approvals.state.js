export function createMessageApprovalsState() {
  return { loading: false, error: null, items: [], selected: null, actionLoading: false, actionError: null, modalOpen: false, comment: '' };
}
