export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  answer: string;
  results: SearchResult[];
}

export async function webSearch(query: string): Promise<SearchResponse | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  console.log("[pharos:tavily] key present:", !!apiKey);

  if (!apiKey) {
    console.warn("[pharos:tavily] TAVILY_API_KEY is not set");
    return null;
  }

  console.log("[pharos:tavily] fetching query:", query);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true,
        max_results: 5,
      }),
    });

    console.log("[pharos:tavily] response status:", res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.warn("[pharos:tavily] non-OK response:", res.status, errText.slice(0, 200));
      return null;
    }

    const data = await res.json();
    const response: SearchResponse = {
      answer: data.answer ?? "",
      results: (data.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
        title:   r.title   ?? "",
        url:     r.url     ?? "",
        content: r.content ?? "",
      })),
    };
    console.log("[pharos:tavily] success — answer length:", response.answer.length, "| results:", response.results.length);
    return response;
  } catch (err) {
    console.error("[pharos:tavily] fetch error:", err);
    return null;
  }
}

export function formatSearchContext(sr: SearchResponse): string {
  const lines: string[] = [];
  if (sr.answer) lines.push(`Summary: ${sr.answer}`);
  for (const r of sr.results.slice(0, 4)) {
    if (!r.content) continue;
    lines.push(`\nSource: ${r.title} — ${r.url}`);
    lines.push(r.content.slice(0, 500));
  }
  return lines.join("\n").trim();
}
