function pad(value) {
  return String(value).padStart(2, '0');
}

export function dateToDateOnly(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function todayDateOnly() {
  return dateToDateOnly(new Date());
}

export function compareDateOnly(a, b) {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return 0;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}
