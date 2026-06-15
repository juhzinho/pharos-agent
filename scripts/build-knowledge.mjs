// Build-time RAG indexer.
// Reads CORE_KNOWLEDGE + DETAILED_KNOWLEDGE from lib/knowledge.ts, chunks them
// (~300 tokens per chunk), embeds each chunk (OpenAI text-embedding-3-small,
// falling back to Gemini embeddings if OpenAI is unavailable/over quota) and
// writes lib/knowledge-vectors.json for runtime cosine-similarity retrieval.
//
// Run with:  node --experimental-strip-types scripts/build-knowledge.mjs
// (package.json script: npm run build:knowledge)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── env ────────────────────────────────────────────────────────────────────
function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch { /* .env.local optional if env already set */ }
}
loadEnvLocal();

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

// EMBEDDING_DIM must match lib/rag.ts. 256 dims keeps the vectors file small
// (~70KB) with negligible retrieval-quality loss at this scale.
const EMBEDDING_DIM = 256;

// ── load knowledge (knowledge.ts has no imports, so strip-types can load it) ─
const { CORE_KNOWLEDGE, DETAILED_KNOWLEDGE } = await import(
  new URL("../lib/knowledge.ts", import.meta.url).href
);

// ── chunking ───────────────────────────────────────────────────────────────
// Human-readable source labels shown as citations under agent replies.
const SOURCE_LABELS = {
  r25:        "Pharos Docs — R25",
  faroo:      "Faroo Docs",
  zona:       "Zona Docs",
  aquaflux:   "AquaFlux Docs",
  bitverse:   "Bitverse Wiki",
  faroswap:   "FaroSwap Docs",
  ember:      "Pharos Docs — Ember",
  centrifuge: "Pharos Docs — Centrifuge",
  rwa:        "RWA Education",
  defi:       "DeFi Concepts",
  ccip:       "Chainlink CCIP Docs",
  pros:       "PROS Tokenomics",
  interport:  "InterPort Docs",
  cctp:       "Circle CCTP v2 (on-chain)",
  stargate:   "Stargate / LayerZero Docs",
  github:     "github.com/PharosNetwork",
  exchanges:  "Bitget Academy",
  architecture: "Research (Gate Learn / Medium)",
  // Educational
  amm:                      "DeFi Concepts — AMMs",
  liquidity_pools:          "DeFi Concepts — Liquidity Pools",
  impermanent_loss:         "DeFi Concepts — Impermanent Loss",
  yield_farming:            "DeFi Concepts — Yield",
  staking_concepts:         "DeFi Concepts — Staking",
  lending_borrowing:        "DeFi Concepts — Lending",
  liquidations:             "DeFi Concepts — Liquidations",
  stablecoins:              "DeFi Concepts — Stablecoins",
  dex_cex:                  "DeFi Concepts — DEX vs CEX",
  mev_slippage:             "DeFi Concepts — Slippage & MEV",
  concentrated_liquidity_v3:"DeFi Concepts — Concentrated Liquidity",
  governance_dao:           "DeFi Concepts — Governance & DAOs",
  wrapped_tokens:           "DeFi Concepts — Wrapped Tokens",
  rwa_tokenization:         "RWA Education — Tokenization",
  rwa_assets:               "RWA Education — Asset Types",
  rwa_yield_oracles:        "RWA Education — Yield & Oracles",
  erc4626_vaults:           "RWA Education — ERC-4626 Vaults",
  institutional_defi:       "RWA Education — Institutional DeFi",
  tradfi_instruments:       "TradFi Concepts — Instruments",
  tradfi_settlement:        "TradFi Concepts — Settlement & Custody",
  market_makers_liquidity:  "TradFi Concepts — Market Making",
  blockchain_basics:        "Crypto Fundamentals — Blockchain",
  consensus:                "Crypto Fundamentals — Consensus",
  l1_l2_rollups:            "Crypto Fundamentals — L1/L2 & Rollups",
  gas_evm_contracts:        "Crypto Fundamentals — Gas & EVM",
  erc_standards:            "Crypto Fundamentals — ERC Standards",
  wallets_keys:             "Crypto Fundamentals — Wallets & Keys",
  cross_chain_messaging:    "Crypto Fundamentals — Cross-chain",
  realfi_vision:            "Pharos RealFi",
  // Official pharos.xyz homepage
  pharos_tech:              "pharos.xyz — Tech Specs",
  pharos_compliance:        "pharos.xyz — Compliance",
  pharos_spn:               "pharos.xyz — SPN",
  pharos_positioning:       "pharos.xyz — Positioning",
  pharos_metrics:           "pharos.xyz — Metrics & Backing",
  pharos_site:              "pharos.xyz — Site Map",
  airdrop:                  "Pharos Airdrop",
  campaigns:                "Pharos Campaigns",
  pns:                      "Pharos Name Service",
  agent_center:             "Pharos Agent Center",
  research:                 "Pharos Research",
  dapps_extra:              "Pharos Ecosystem dApps",
};

// ~300 tokens ≈ ~1200 chars. Split a long text on blank lines, then greedily
// regroup paragraphs into chunks under the limit.
const MAX_CHUNK_CHARS = 1200;
function splitIntoChunks(text) {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks = [];
  let current = "";
  for (const p of paras) {
    if (current && (current.length + p.length + 2) > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const chunks = [];

const coreBody = CORE_KNOWLEDGE
  .replace(/=== PHAROS CORE KNOWLEDGE ===/g, "")
  .replace(/=== END CORE KNOWLEDGE ===/g, "")
  .trim();
for (const [i, text] of splitIntoChunks(coreBody).entries()) {
  chunks.push({ id: `core-${i}`, text, source: "Pharos Docs — Core" });
}

for (const [key, body] of Object.entries(DETAILED_KNOWLEDGE)) {
  const source = SOURCE_LABELS[key] ?? `Pharos Docs — ${key}`;
  const parts = splitIntoChunks(body.trim());
  for (const [i, text] of parts.entries()) {
    chunks.push({ id: parts.length > 1 ? `${key}-${i}` : key, text, source });
  }
}

const curatedCount = chunks.length;
console.log(`Curated (lib/knowledge.ts): ${curatedCount} chunks.`);

// ── merge crawled docs (lib/crawled-docs.json) with near-dup removal ─────────
// Curated chunks are authoritative and always kept; crawled chunks are added
// unless near-identical to something already included.
function dedupKey(text) {
  return text.toLowerCase().replace(/[#>*`_\-\s]+/g, " ").trim().slice(0, 160);
}
const seen = new Set(chunks.map((c) => dedupKey(c.text)));

let crawledAdded = 0, crawledDup = 0;
try {
  const crawled = JSON.parse(readFileSync(path.join(ROOT, "lib", "crawled-docs.json"), "utf8"));
  for (const c of crawled) {
    if (!c?.text || c.text.length < 40) continue;
    const k = dedupKey(c.text);
    if (seen.has(k)) { crawledDup++; continue; }
    seen.add(k);
    chunks.push({ id: c.id, text: c.text, source: c.source || c.title || "Pharos Docs", url: c.url });
    crawledAdded++;
  }
  console.log(`Crawled (lib/crawled-docs.json): +${crawledAdded} added, ${crawledDup} near-dups skipped.`);
} catch {
  console.warn("No lib/crawled-docs.json found — run scripts/crawl-docs.mjs first. Embedding curated only.");
}

console.log(`Total: ${chunks.length} chunks (curated ${curatedCount} + crawled ${crawledAdded}).`);

// ── embedding providers ─────────────────────────────────────────────────────

async function embedOpenAI(texts) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", dimensions: EMBEDDING_DIM, input: texts }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI HTTP ${res.status}`);
  }
  const data = await res.json();
  return { provider: "openai", model: "text-embedding-3-small", vectors: data.data.map((d) => d.embedding) };
}

async function embedGemini(texts) {
  const model = "gemini-embedding-001";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIM,
        })),
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini HTTP ${res.status}`);
  }
  const data = await res.json();
  return { provider: "gemini", model, vectors: data.embeddings.map((e) => e.values) };
}

// Truncated/reduced-dim embeddings are not unit-length — normalize so runtime
// cosine similarity is a plain dot product regardless of provider.
function normalize(v) {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => Math.round((x / norm) * 1e6) / 1e6);
}

// Embed in batches. Each item counts against the provider's rate limit (Gemini
// free tier = 100 embed requests/min), so we keep batches ≤90 and wait ~62s
// between them, with a 429/quota retry that respects the suggested backoff.
const BATCH = 80;
const INTER_BATCH_MS = 62_000;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function embedBatchWithRetry(embedFn, slice, tries = 4) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      return await embedFn(slice);
    } catch (e) {
      const msg = String(e.message ?? e);
      const isRate = /quota|rate.?limit|\b429\b|exceeded/i.test(msg);
      if (!isRate || attempt === tries) throw e;
      const secs = Number(msg.match(/retry in ([\d.]+)s/i)?.[1]) || 60;
      console.warn(`  rate-limited — waiting ${Math.ceil(secs) + 3}s then retrying batch (attempt ${attempt}/${tries})…`);
      await sleep((Math.ceil(secs) + 3) * 1000);
    }
  }
  throw new Error("unreachable");
}

const outPath = path.join(ROOT, "lib", "knowledge-vectors.json");

// ── incremental cache: reuse embeddings already computed in a prior run ──────
// Embedding APIs are rate/quota limited, so we never re-embed text we've already
// embedded. The existing vectors file is the cache (keyed by normalized text).
const cache = new Map(); // dedupKey(text) → embedding
let cacheModel = null, cacheProvider = null;
try {
  const prev = JSON.parse(readFileSync(outPath, "utf8"));
  if (prev?.dimensions === EMBEDDING_DIM) {
    cacheModel = prev.model; cacheProvider = prev.provider;
    for (const c of prev.chunks ?? []) if (c.embedding) cache.set(dedupKey(c.text), c.embedding);
  }
} catch { /* no prior file */ }
console.log(`Embedding cache: ${cache.size} reusable vectors from previous build.`);

const toEmbed = chunks.filter((c) => !cache.has(dedupKey(c.text)));
// Embed-order priority so the highest-value sources go first and survive any
// daily quota cap: curated → GitHub/blog/Bitget/research extras → dapp docs → rest.
const priority = (c) => {
  if (!c.url) return 0;                                           // curated
  if (/^(gh-|blog-|bitget|gate|mexc|medium)/.test(String(c.id))) return 1; // new extra sources
  if (/aquaflux|faroo|zona|bitverse/.test(c.url)) return 2;       // dapp docs
  return 3;                                                       // pharos docs / SPA
};
toEmbed.sort((a, b) => priority(a) - priority(b));
console.log(`Need to embed ${toEmbed.length} new chunks (${chunks.length - toEmbed.length} reused from cache).`);

// Embed the missing ones in throttled batches, persisting after EACH batch so a
// quota cutoff never loses progress and the next run resumes.
const newVecs = new Map(); // dedupKey → embedding
let provider = cacheProvider, model = cacheModel;

function persist() {
  const out = [];
  for (const c of chunks) {
    const k = dedupKey(c.text);
    const embedding = cache.get(k) ?? newVecs.get(k);
    if (!embedding) continue; // not yet embedded — include on a later run
    out.push({ id: c.id, text: c.text, source: c.source, ...(c.url ? { url: c.url } : {}), embedding });
  }
  writeFileSync(outPath, JSON.stringify({ provider: provider ?? "gemini", model: model ?? "gemini-embedding-001", dimensions: EMBEDDING_DIM, chunks: out }));
  return out.length;
}

async function embedMissing(embedFn, tries) {
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const slice = toEmbed.slice(i, i + BATCH);
    const r = await embedBatchWithRetry(embedFn, slice.map((c) => c.text), tries);
    provider = r.provider; model = r.model;
    slice.forEach((c, j) => newVecs.set(dedupKey(c.text), normalize(r.vectors[j])));
    const written = persist(); // save progress after every batch
    console.log(`  embedded ${Math.min(i + BATCH, toEmbed.length)}/${toEmbed.length} new · file now has ${written} chunks`);
    if (i + BATCH < toEmbed.length) await sleep(INTER_BATCH_MS);
  }
}

if (toEmbed.length === 0) {
  const n = persist();
  console.log(`All chunks already cached. Wrote ${n} chunks → lib/knowledge-vectors.json`);
} else {
  const errors = [];
  let done = false;
  if (OPENAI_KEY) {
    try { await embedMissing(embedOpenAI, 1); done = true; }
    catch (e) { errors.push(`OpenAI: ${e.message}`); console.warn(`OpenAI failed (${e.message}) — trying Gemini`); }
  }
  if (!done && GEMINI_KEY) {
    try { await embedMissing(embedGemini, 5); done = true; }
    catch (e) { errors.push(`Gemini: ${e.message}`); }
  }
  const written = persist();
  if (done) {
    console.log(`Embedded with ${provider}/${model}. Wrote ${written} chunks → lib/knowledge-vectors.json`);
  } else {
    console.warn(`Embedding stopped early (provider quota). Wrote ${written}/${chunks.length} chunks (partial). Re-run to embed the rest.\n  ${errors.join("\n  ")}`);
  }
}
