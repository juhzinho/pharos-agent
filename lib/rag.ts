// Lightweight TypeScript RAG over lib/knowledge-vectors.json.
// The index is built offline by scripts/build-knowledge.mjs (npm run build:knowledge).
// At query time we embed the user message with the SAME provider/model used at
// build time, then rank chunks by cosine similarity (vectors are pre-normalized,
// so cosine = dot product). Works both client-side and in API routes.

import vectorIndex from "./knowledge-vectors.json";

export interface RetrievedChunk {
  id: string;
  text: string;
  source: string;
  url?: string;
  score: number;
}

interface VectorIndex {
  provider: "openai" | "gemini";
  model: string;
  dimensions: number;
  chunks: Array<{ id: string; text: string; source: string; url?: string; embedding: number[] }>;
}

const INDEX = vectorIndex as VectorIndex;
const EMBED_TIMEOUT_MS = 8_000;

// Small cache so repeated/refined questions don't re-pay the embedding call.
const queryCache = new Map<string, number[]>();
const QUERY_CACHE_MAX = 50;

function openaiKey(): string | undefined {
  return process.env.OPENAI_API_KEY;
}
function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMBED_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function embedQueryOpenAI(query: string): Promise<number[]> {
  const key = openaiKey();
  if (!key) throw new Error("OpenAI key not configured");
  const res = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: INDEX.model, dimensions: INDEX.dimensions, input: query }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI embeddings HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.data?.[0]?.embedding ?? [];
}

async function embedQueryGemini(query: string): Promise<number[]> {
  const key = geminiKey();
  if (!key) throw new Error("Gemini key not configured");
  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${INDEX.model}:embedContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${INDEX.model}`,
        content: { parts: [{ text: query }] },
        outputDimensionality: INDEX.dimensions,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini embeddings HTTP ${res.status}`);
  }
  const data = await res.json();
  return data?.embedding?.values ?? [];
}

function normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length && i < b.length; i++) s += a[i] * b[i];
  return s;
}

async function embedQuery(query: string): Promise<number[]> {
  const cached = queryCache.get(query);
  if (cached) return cached;

  const raw = INDEX.provider === "openai" ? await embedQueryOpenAI(query) : await embedQueryGemini(query);
  if (raw.length === 0) throw new Error("Empty query embedding");
  const vec = normalize(raw);

  if (queryCache.size >= QUERY_CACHE_MAX) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(query, vec);
  return vec;
}

// Returns the topK most relevant knowledge chunks for the query.
// Throws on embedding failure — callers should catch and fall back to the
// keyword-based knowledge injection (see lib/groq.ts).
export async function retrieveKnowledge(query: string, topK = 4): Promise<RetrievedChunk[]> {
  const qVec = await embedQuery(query);
  return INDEX.chunks
    .map((c) => ({ id: c.id, text: c.text, source: c.source, url: c.url, score: dot(qVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// Formats retrieved chunks as a system-prompt section, tagging each chunk with
// its source so the model can cite it in the "sources" output field.
export function formatRagContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return (
    "\n── RETRIEVED KNOWLEDGE (top matches from the Pharos knowledge base) ──────\n" +
    chunks
      .map((c) => `[source: ${c.source}${c.url ? ` — ${c.url}` : ""}]\n${c.text.trim()}`)
      .join("\n\n") +
    "\n── END RETRIEVED KNOWLEDGE ──────\n"
  );
}
