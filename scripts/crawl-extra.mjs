// Crawl the remaining Pharos knowledge sources and APPEND to lib/crawled-docs.json:
//  • GitHub PharosNetwork repo READMEs (via the GitHub API readme endpoint)
//  • Official Pharos technical deep-dive blog
//  • Bitget Academy article
//  • Research/Medium deep-dives (best-effort — several bot-block with 403)
//
// Idempotent: re-running replaces these sources' chunks without touching the
// existing GitBook/SPA crawl output.
// Run:  node scripts/crawl-extra.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib", "crawled-docs.json");
const DELAY_MS = 500;
const MAX_CHUNK_CHARS = 1200;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];

async function fetchText(url, headers = {}, timeoutMs = 18000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...headers } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, text: await res.text() };
  } catch (e) {
    return { ok: false, status: String(e.name || e) };
  } finally {
    clearTimeout(t);
  }
}

function chunkText(text, title, url, idPrefix, isMarkdown) {
  const paras = isMarkdown
    ? text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : null;
  const chunks = [];
  if (paras) {
    let cur = "";
    for (const p of paras) {
      if (cur && cur.length + p.length + 2 > MAX_CHUNK_CHARS) { chunks.push(cur); cur = p; }
      else cur = cur ? `${cur}\n\n${p}` : p;
    }
    if (cur) chunks.push(cur);
  } else {
    for (let k = 0; k < text.length; k += MAX_CHUNK_CHARS) chunks.push(text.slice(k, k + MAX_CHUNK_CHARS).trim());
  }
  return chunks
    .map((c) => c.trim())
    .filter((c) => c.replace(/[#>*\-\s|]/g, "").length >= 40)
    .map((c, j) => ({ id: `${idPrefix}-${j}`, text: c.startsWith("#") ? c : `# ${title}\n\n${c}`, source: title, title, url }));
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const htmlTitle = (html) => (html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").replace(/\s*[|·–-].*$/, "").trim();

const collected = [];

// ── GitHub PharosNetwork READMEs ─────────────────────────────────────────────
async function crawlGitHub() {
  const gh = { Accept: "application/vnd.github+json" };
  const list = await fetchText("https://api.github.com/orgs/PharosNetwork/repos?per_page=100", gh);
  if (!list.ok) { report.push(`GitHub repo list: FAIL (${list.status})`); return; }
  const repos = JSON.parse(list.text);
  let ok = 0, none = 0;
  for (const repo of repos) {
    const meta = await fetchText(`https://api.github.com/repos/PharosNetwork/${repo.name}/readme`, gh);
    await sleep(DELAY_MS);
    if (!meta.ok) { none++; continue; }
    const dl = JSON.parse(meta.text).download_url;
    if (!dl) { none++; continue; }
    const raw = await fetchText(dl);
    await sleep(DELAY_MS);
    if (!raw.ok || raw.text.length < 80) { none++; continue; }
    const title = `PharosNetwork/${repo.name} (GitHub)`;
    const md = raw.text.replace(/\r/g, "");
    collected.push(...chunkText(md, title, repo.html_url, `gh-${repo.name}`, true));
    ok++;
  }
  report.push(`GitHub PharosNetwork: OK — ${ok} repo READMEs (${none} had none), ${repos.length} repos total`);
}

// ── single HTML article ──────────────────────────────────────────────────────
async function crawlArticle(url, label, idPrefix) {
  const r = await fetchText(url, { Referer: "https://www.google.com/" });
  await sleep(DELAY_MS);
  if (!r.ok) { report.push(`${label}: FAIL (HTTP ${r.status})`); return; }
  const text = htmlToText(r.text);
  if (text.length < 400) { report.push(`${label}: PARTIAL (little extractable text, ${text.length} chars)`); return; }
  const title = htmlTitle(r.text) || label;
  const chunks = chunkText(text, title, url, idPrefix, false);
  collected.push(...chunks);
  report.push(`${label}: OK — ${chunks.length} chunks`);
}

await crawlGitHub();
await crawlArticle("https://www.pharos.xyz/blog/a-comprehensive-technical-deep-dive-into-pharos-network-architecture", "Pharos Tech Deep-Dive (blog)", "blog-techdeepdive");
await crawlArticle("https://web3.bitget.com/en/academy/what-is-pharos-network-pharos-a-high-throughput-evm-layer-1-for-real-world-asset-tokenization-and-defi-lLending", "Bitget Academy", "bitget");
await crawlArticle("https://www.gate.com/learn/articles/pharos-network-deep-dive-architecture-scalability-interoperability-and-security/9662", "Gate Learn", "gate");
await crawlArticle("https://www.mexc.com/learn/article/what-is-pharos-network-pros-coin-a-deep-dive-into-pharos-networks-realfi-layer-1-ecosystem/1", "MEXC Learn", "mexc");
await crawlArticle("https://medium.com/@PujiAnggraini/exploring-pharos-network-a-beacon-for-real-world-finance-in-blockchain-7c874206a0ab", "Medium — Exploring Pharos", "medium1");
await crawlArticle("https://lithiumdigital.medium.com/pharos-network-bridging-traditional-finance-and-web3-with-deep-parallel-performance-5339ad373749", "Medium — Lithium Digital", "medium2");

// ── merge into existing crawled-docs.json (idempotent) ───────────────────────
let existing = [];
try { existing = JSON.parse(readFileSync(OUT, "utf8")); } catch { /* none */ }
const newPrefixes = ["gh-", "blog-techdeepdive", "bitget", "gate", "mexc", "medium1", "medium2"];
const kept = existing.filter((c) => !newPrefixes.some((p) => String(c.id).startsWith(p)));
const merged = [...kept, ...collected];
writeFileSync(OUT, JSON.stringify(merged, null, 0));

console.log("\n──────── EXTRA SOURCES ────────");
for (const line of report) console.log(`  ${line.includes(": OK") ? "✓" : line.includes("PARTIAL") ? "~" : "✗"} ${line}`);
console.log(`\nExisting kept: ${kept.length} · New from extra sources: ${collected.length} · Total: ${merged.length} → lib/crawled-docs.json`);
