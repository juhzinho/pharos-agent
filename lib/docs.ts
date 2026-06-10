export interface DocsResult {
  answer: string;
  source: string;
  dapp: string;
}

// Docs endpoints that support ?ask= querying
const DOCS_ENDPOINTS: Record<string, string> = {
  pharos:   "https://docs.pharosnetwork.xyz",
  faroo:    "https://docs.faroo.xyz/welcome-to-faroo.md",
  aquaflux: "https://docs.aquaflux.pro/readme.md",
  bitverse: "https://wiki.bitverse.zone",
  zona:     "https://docs.zona.finance",
};

export function supportedDapps(): string[] {
  return Object.keys(DOCS_ENDPOINTS);
}

// Query a dapp's documentation using the ?ask= endpoint.
// Returns the answer text, or null on failure (network error, CORS, empty response).
export async function queryDocs(dapp: string, question: string): Promise<DocsResult | null> {
  const key = dapp.toLowerCase();
  const baseUrl = DOCS_ENDPOINTS[key];
  if (!baseUrl) return null;

  const url = `${baseUrl}?ask=${encodeURIComponent(question)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    return { answer: text.trim(), source: baseUrl, dapp: key };
  } catch (err) {
    console.warn(`[pharos:docs] queryDocs(${dapp}) failed:`, err);
    return null;
  }
}

export function formatDocsContext(result: DocsResult): string {
  const lines: string[] = [
    `[Deep docs — ${result.dapp} @ ${result.source}]`,
    result.answer.slice(0, 1500),
  ];
  return lines.join("\n").trim();
}
