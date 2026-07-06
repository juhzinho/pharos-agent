// Web search engine for the agent (server-side only).
//
// Multi-engine cascade — each engine is tried in order until one returns
// usable results, so the agent never loses web access:
//  1. Tavily (advanced, LLM-ready summaries; news mode for recency questions)
//  2. Google Programmable Search — enabled when GOOGLE_SEARCH_KEY +
//     GOOGLE_SEARCH_CX are set (free tier: 100 queries/day)
//  3. Brave Search API — enabled when BRAVE_SEARCH_KEY is set (free tier)
//  4. DuckDuckGo HTML — no key needed, always available as the last resort
//
// ALL engines search the whole web; Pharos-related queries get "(Pharos
// Network blockchain)" appended so results anchor to the crypto Pharos, and
// official ecosystem domains are ranked first.

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

/** Anchor Pharos queries to the crypto project (not the Alexandria lighthouse). */
function anchorQuery(query: string): string {
  return PHAROS_RE.test(query) && !/network|crypto|blockchain/i.test(query)
    ? `${query} (Pharos Network blockchain)`
    : query;
}

/** Official Pharos sources first for ecosystem questions. */
function rankResults(query: string, results: SearchResult[]): SearchResult[] {
  if (!PHAROS_RE.test(query)) return results;
  const officialFirst = (u: string) => (PHAROS_DOMAINS.some((d) => u.includes(d)) ? 0 : 1);
  return [...results].sort((a, b) => officialFirst(a.url) - officialFirst(b.url));
}

// ── Engine 1: Tavily ─────────────────────────────────────────────────────────

async function tavilySearch(query: string): Promise<SearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: anchorQuery(query),
        search_depth: "advanced",
        include_answer: true,
        max_results: 8,
        ...(NEWS_RE.test(query) ? { topic: "news", days: 30 } : {}),
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) {
      console.warn("[pharos:tavily] non-OK response:", res.status);
      return null;
    }
    const data = await res.json();
    const results: SearchResult[] = (data.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
      title: r.title ?? "", url: r.url ?? "", content: r.content ?? "",
    }));
    console.log("[pharos:tavily] ok — results:", results.length);
    return { answer: data.answer ?? "", results: rankResults(query, results) };
  } catch (err) {
    console.error("[pharos:tavily] error:", err);
    return null;
  }
}

// ── Engine 2: Google Programmable Search (optional keys) ────────────────────
// Get free keys: https://developers.google.com/custom-search/v1/overview
//   GOOGLE_SEARCH_KEY = API key | GOOGLE_SEARCH_CX = search engine ID (cx)

async function googleSearch(query: string): Promise<SearchResponse | null> {
  const key = process.env.GOOGLE_SEARCH_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;
  if (!key || !cx) return null;

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&num=8&q=${encodeURIComponent(anchorQuery(query))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn("[pharos:google] non-OK response:", res.status);
      return null;
    }
    const data = await res.json();
    const results: SearchResult[] = (data.items ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
      title: r.title ?? "", url: r.link ?? "", content: r.snippet ?? "",
    }));
    if (results.length === 0) return null;
    console.log("[pharos:google] ok — results:", results.length);
    return { answer: "", results: rankResults(query, results) };
  } catch (err) {
    console.error("[pharos:google] error:", err);
    return null;
  }
}

// ── Engine 3: Brave Search API (optional key) ────────────────────────────────
// Get a free key: https://brave.com/search/api/  (BRAVE_SEARCH_KEY)

async function braveSearch(query: string): Promise<SearchResponse | null> {
  const key = process.env.BRAVE_SEARCH_KEY;
  if (!key) return null;

  try {
    const url = `https://api.search.brave.com/res/v1/web/search?count=8&q=${encodeURIComponent(anchorQuery(query))}`;
    const res = await fetch(url, {
      headers: { "X-Subscription-Token": key, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn("[pharos:brave] non-OK response:", res.status);
      return null;
    }
    const data = await res.json();
    const results: SearchResult[] = (data.web?.results ?? []).map((r: { title?: string; url?: string; description?: string }) => ({
      title: r.title ?? "", url: r.url ?? "", content: r.description ?? "",
    }));
    if (results.length === 0) return null;
    console.log("[pharos:brave] ok — results:", results.length);
    return { answer: "", results: rankResults(query, results) };
  } catch (err) {
    console.error("[pharos:brave] error:", err);
    return null;
  }
}

// ── Engine 4: DuckDuckGo HTML (no key — last resort) ─────────────────────────

async function duckDuckGoSearch(query: string): Promise<SearchResponse | null> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(anchorQuery(query))}`, {
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
    console.log("[pharos:ddg] ok — results:", results.length);
    return { answer: "", results: rankResults(query, results) };
  } catch (err) {
    console.error("[pharos:ddg] error:", err);
    return null;
  }
}

// ── Cascade ──────────────────────────────────────────────────────────────────

export async function webSearch(query: string): Promise<SearchResponse | null> {
  const engines = [tavilySearch, googleSearch, braveSearch, duckDuckGoSearch];
  for (const engine of engines) {
    const r = await engine(query);
    if (r && (r.answer || r.results.length > 0)) return r;
  }
  return null;
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
