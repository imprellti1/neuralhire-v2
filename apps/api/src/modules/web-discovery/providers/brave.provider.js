export async function searchBraveWebDiscovery(query, { apiKey, fetchImpl = globalThis.fetch } = {}) {
  if (!String(apiKey || '').trim()) return { ok: false, skipped: true, reason: 'missing_api_key', provider: 'brave', items: [] };
  const url = new URL('https://api.search.brave.com/res/v1/web/search');
  url.searchParams.set('q', query);
  url.searchParams.set('count', '10');
  const response = await fetchImpl(url.toString(), {
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey }
  });
  if (!response.ok) throw new Error(`Brave Search HTTP ${response.status}`);
  const body = await response.json();
  const items = Array.isArray(body?.web?.results) ? body.web.results : [];
  return { ok: true, provider: 'brave', items: items.map((item) => ({ title: item.title, url: item.url, snippet: item.description, provider: 'brave' })) };
}
