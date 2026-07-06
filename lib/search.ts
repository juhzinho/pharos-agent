// Web search engine for the agent (server-side only).
//
// Layered strategy:
//  1. Tavily "advanced" search — best quality, LLM-ready summaries.
//     • Pharos-related queries get the query enriched with "Pharos Network"
//       context so results don't drift to the Egyptian lighthouse 🗼.
//     • Recency questions (news/announcements/price moves) switch to Tavily's
//       news topic with a 30-day window.
//  2. DuckDuckGo HTML fallback — no API key needed; used when Tavily is
//     missing/over quota/down, so the agent NEVER loses web access entirely.

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  answer: string;
  results: SearchResult[];
}

// Official + high-signal Pharos sources, boosted for ecosystem queries.
const PHAROS_DOMAINS = [
  "pharos.xyz", "docs.pharos.xyz", "port.pharos.xyz", "pharosfoundation.xyz",
  "pharos.socialscan.io", "faroswap.xyz", "app.faroo.xyz", "docs.faroo.xyz",
  "r25.xyz", "aquaflux.pro", "zona.finance", "bitverse.zone", "ember.so",
  "x.com", "twitter.com", "coinmarketcap.com", "coingecko.com",
];

const PHAROS_RE = /\bpharos|pros token|faroswap|faroo|stpros|aquaflux|bitverse|realfi|spn\b/i;
const NEWS_RE = /\b(news|not[ií]cia|announce|anunci|lately|recent|latest|hoje|today|this week|essa semana|price today|listing|airdrop|update)\b/i;

async function tavilySearch(query: string): Promise<SearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[pharos:tavily] TAVILY_API_KEY is not set");
    return null;
  }

  const isPharos = PHAROS_RE.test(query);
  const isNews = NEWS_RE.test(query);
  // Keep results anchored to the crypto Pharos, not unrelated homonyms.
  const finalQuery = isPharos && !/network|crypto|blockchain/i.test(query)
    ? `${query} (Pharos Network blockchain)`
    : query;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: finalQuery,
        search_depth: "advanced",
        include_answer: true,
        max_results: 8,
        ...(isNews ? { topic: "news", days: 30 } : {}),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[pharos:tavily] non-OK response:", res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    let results: SearchResult[] = (data.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
      title:   r.title   ?? "",
      url:     r.url     ?? "",
      content: r.content ?? "",
    }));

    // Rank official Pharos sources first for ecosystem questions.
    if (isPharos) {
      const officialFirst = (u: string) => (PHAROS_DOMAINS.some((d) => u.includes(d)) ? 0 : 1);
      results = [...results].sort((a, b) => officialFirst(a.url) - officialFirst(b.url));
    }

    const response: SearchResponse = { answer: data.answer ?? "", results };
    console.log("[pharos:tavily] success — answer length:", response.answer.length, "| results:", response.results.length);
    return response;
  } catch (err) {
    console.error("[pharos:tavily] fetch error:", err);
    return null;
  }
}

// Key-less fallback: DuckDuckGo's HTML endpoint. Coarser than Tavily but keeps
// the agent's web access alive if Tavily is down or the key hits its quota.
async function duckDuckGoSearch(query: string): Promise<SearchResponse | null> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PharosAgent/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const results: SearchResult[] = [];
    const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();

    const links = [...html.matchAll(linkRe)];
    const snippets = [...html.matchAll(snippetRe)];
    for (let i = 0; i < Math.min(links.length, 6); i++) {
      // DDG wraps URLs in a redirect (uddg param) — unwrap to the real URL.
      const raw = links[i][1];
      const m = raw.match(/uddg=([^&]+)/);
      const url = m ? decodeURIComponent(m[1]) : raw;
      results.push({ title: strip(links[i][2]), url, content: snippets[i] ? strip(snippets[i][1]) : "" });
    }
    if (results.length === 0) return null;
    console.log("[pharos:ddg] fallback success — results:", results.length);
    return { answer: "", results };
  } catch (err) {
    console.error("[pharos:ddg] fetch error:", err);
    return null;
  }
}

export async function webSearch(query: string): Promise<SearchResponse | null> {
  const tavily = await tavilySearch(query);
  if (tavily && (tavily.answer || tavily.results.length > 0)) return tavily;
  return duckDuckGoSearch(query);
}

export function formatSearchContext(sr: SearchResponse): string {
  const lines: string[] = [];
  if (sr.answer) lines.push(`Summary: ${sr.answer}`);
  for (const r of sr.results.slice(0, 5)) {
    if (!r.content && !r.title) continue;
    lines.push(`\nSource: ${r.title} — ${r.url}`);
    if (r.content) lines.push(r.content.slice(0, 500));
  }
  return lines.join("\n").trim();
}
