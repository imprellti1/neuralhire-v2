export async function searchTavilyWebDiscovery(query, { apiKey, fetchImpl = globalThis.fetch } = {}) {
  if (!String(apiKey || '').trim()) return { ok: false, skipped: true, reason: 'missing_api_key', provider: 'tavily', items: [] };
  const response = await fetchImpl('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, search_depth: 'basic', max_results: 10, include_answer: false, include_images: false, include_raw_content: false })
  });
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
  const body = await response.json();
  const items = Array.isArray(body?.results) ? body.results : [];
  return { ok: true, provider: 'tavily', items: items.map((item) => ({ title: item.title, url: item.url, snippet: item.content || item.snippet, provider: 'tavily' })) };
}
