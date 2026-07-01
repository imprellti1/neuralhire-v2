export async function searchDdgsWebDiscovery(query, { fetchImpl = globalThis.fetch } = {}) {
  const url = new URL('https://duckduckgo.com/html/');
  url.searchParams.set('q', query);
  const response = await fetchImpl(url.toString(), {
    headers: {
      Accept: 'text/html,application/xhtml+xml'
    }
  });
  if (!response.ok) throw new Error(`DDGS HTTP ${response.status}`);
  const html = await response.text();
  const items = [];
  const resultRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(resultRe)) {
    const [, url, titleHtml, snippetHtml] = match;
    const strip = (value) => String(value || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
    items.push({
      title: strip(titleHtml),
      url: strip(url),
      snippet: strip(snippetHtml),
      provider: 'ddgs'
    });
  }
  return { ok: true, provider: 'ddgs', items };
}
