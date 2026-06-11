function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDateOnlyPtBr(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function todayDateOnly() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function compareDateOnly(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return 0;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
