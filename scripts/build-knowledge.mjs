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

console.log(`Chunked knowledge into ${chunks.length} chunks.`);

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

let result = null;
const errors = [];
if (OPENAI_KEY) {
  try { result = await embedOpenAI(chunks.map((c) => c.text)); }
  catch (e) { errors.push(`OpenAI: ${e.message}`); console.warn(`OpenAI embeddings failed (${e.message}) — trying Gemini`); }
}
if (!result && GEMINI_KEY) {
  try { result = await embedGemini(chunks.map((c) => c.text)); }
  catch (e) { errors.push(`Gemini: ${e.message}`); }
}
if (!result) {
  console.error("All embedding providers failed:\n  " + errors.join("\n  "));
  process.exit(1);
}

const out = chunks.map((c, i) => ({ ...c, embedding: normalize(result.vectors[i]) }));

const outPath = path.join(ROOT, "lib", "knowledge-vectors.json");
writeFileSync(
  outPath,
  JSON.stringify({ provider: result.provider, model: result.model, dimensions: EMBEDDING_DIM, chunks: out })
);
console.log(`Embedded with ${result.provider}/${result.model}.`);
console.log(`Wrote ${out.length} embedded chunks → lib/knowledge-vectors.json`);
