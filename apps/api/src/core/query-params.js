export function parseQueryParams(url) {
  const parsed = new URL(String(url || '/'), 'http://localhost');
  const result = {};

  for (const [key, value] of parsed.searchParams.entries()) {
    result[key] = value;
  }

  return result;
}

export function parsePathname(url) {
  const parsed = new URL(String(url || '/'), 'http://localhost');
  return parsed.pathname || '/';
}